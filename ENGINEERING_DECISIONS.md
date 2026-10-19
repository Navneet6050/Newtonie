# Newtonite Architecture & Engineering Decisions

This document records the foundational architectural decisions, trade-offs, and design patterns established in Newtonite.

---

### Decision 1: Modular Monolith Domain Architecture

- **Context**: Newtonite requires cohesive domain management (work items, team workspaces, activity audits) for an operations control center.
- **Decision**: Implemented a modular monolith in Spring Boot 3.5 with clean package boundaries (`com.newtonite.workitem`, `com.newtonite.team`, `com.newtonite.activity`, `com.newtonite.config`, and `com.newtonite.common`).
- **Trade-offs & Rationale**: Avoids operational complexity, distributed transaction overhead, and eventual consistency delays of microservices. Domain modules interact through well-defined service interfaces and participate in shared database transactions when audit logs and entities mutate together.

---

### Decision 2: Database-Level Atomic Claiming

- **Context**: Multiple operators may simultaneously attempt to claim an unassigned work item from the queue.
- **Decision**: Implemented atomic claiming using a conditional SQL update:
  ```sql
  UPDATE work_items 
  SET assignee_id = :userId, updated_at = :now, version = version + 1 
  WHERE id = :id AND assignee_id IS NULL;
  ```
- **Trade-offs & Rationale**: Never relies on a preliminary read followed by an unconditional write. PostgreSQL acquires an exclusive row-level lock during the statement evaluation; exactly one transaction updates the row (`affectedRows == 1`), while any concurrent contender finds `assignee_id IS NOT NULL` and affects 0 rows, triggering an immediate `409 Conflict`.

---

### Decision 3: Dual-Layer Optimistic Concurrency Control

- **Context**: Distributed operators reading dashboard queues concurrently must not silently overwrite each other's updates.
- **Decision**: Combined explicit client version preconditions (`expectedVersion` in request body or `If-Match` HTTP header) with JPA `@Version` optimistic locking.
- **Trade-offs & Rationale**: Optimistic locking maximizes throughput by avoiding persistent row-locking. If a client attempts an update with a stale version, the application rejects it with `409 Conflict`, preserves the winning update, and suppresses erroneous audit history entries.

---

### Decision 4: Transactional Idempotency via SHA-256 Request Hashing

- **Context**: Network hiccups or client retries during work item creation could produce duplicate items and confusing audit logs.
- **Decision**: Backed the `Idempotency-Key` header with an `idempotency_records` table storing a SHA-256 hash of the request body, response status, and serialized response.
- **Trade-offs & Rationale**: Replaying the exact same request returns the cached `201 Created` response with zero duplicate database rows or audit events. Attempting to reuse an existing idempotency key with a differing payload is detected and rejected with `409 Conflict`.

---

### Decision 5: Explicit Development Identity Isolation (`CurrentUserProvider`)

- **Context**: Real JWT/OAuth2 authentication and authorization were scheduled for Milestone M3. In M2, the server still needed to associate created items, claims, and activity logs with an actor.
- **Decision**: Created a `CurrentUserProvider` abstraction with a development-only implementation (`DevelopmentCurrentUserProvider`) that resolved to seeded development administrator Alex Morgan (`11111111-1111-1111-1111-111111111111`).
- **Trade-offs & Rationale**: Strictly avoided trusting arbitrary, spoofable client headers (such as `X-User-Id`). It created a clear security boundary: the controller and service layer always obtain identity from the provider, allowing seamless drop-in replacement with Spring Security principal resolution in M3 without modifying business logic.

---

### Decision 6: Stateless JWT Authentication & BCrypt Password Verification (M3)

- **Context**: Newtonite operations require authenticated user sessions where the identity of the caller is verified against securely stored account data. Plaintext passwords or spoofable identity headers are strictly unacceptable.
- **Decision**: Implemented Spring Security filter chain with signed HMAC-SHA256 JWT access tokens (`io.jsonwebtoken:jjwt:0.12.6`) and `BCryptPasswordEncoder` (10 rounds). Tokens store `sub` (User UUID), `email`, and `systemRole`, signed by a configurable `JWT_SECRET`.
- **Trade-offs & Rationale**:
  - Stateless tokens eliminate server-side session affinity requirements and database session tables while providing sub-millisecond cryptographic verification on protected routes.
  - Development passwords (`NewtoniteDev2026!`) are stored exclusively as BCrypt hashes in Flyway migration V3.
  - Client identity headers (`X-User-Id`, etc.) are ignored. `SecurityCurrentUserProvider` resolves the acting user exclusively from the verified `SecurityContextHolder` principal.

---

### Decision 7: Multi-Tenant Team-Scoped Authorization Matrix (M3)

- **Context**: Operators from Team A must not be able to read, update, claim, or audit work items belonging to Team B unless their system role explicitly grants cross-team privileges (`ADMIN`).
- **Decision**: Enforced team-scoped permissions directly within `WorkItemService` and JPA Specifications using `team_memberships`:
  - **ADMIN** (`system_role = 'ADMIN'`): Global access across all teams.
  - **MEMBER / TEAM_LEAD**: Strictly restricted to teams they belong to (`teamMembershipRepository.existsByTeamIdAndUserId`).
  - **Cross-Team Assignment Prevention**: A work item cannot be assigned to any user who is not a member of the item's team (returns `400 Bad Request`).
  - **Team Filter Scoping**: Querying `GET /api/work-items?teamId=...` for a team the user does not belong to is rejected with `403 Forbidden`. If no team filter is supplied, queries are automatically scoped to `team_id IN (userTeamIds)`.
  - **Activity Log Inheritance**: Audit logs can only be read if the caller has team access to the parent work item (`403 Forbidden` otherwise).

---

### Decision 8: User-Scoped Idempotency Records & Conflict Isolation (M3)

- **Context**: In M2, idempotency records were keyed solely by the client-provided key. A key collision or malicious key replay between two different operators could leak cached responses across user boundaries.
- **Decision**: Migrated `idempotency_records` in Flyway V3 to use a composite primary key `(user_id, key)`.
- **Trade-offs & Rationale**: Guarantees that idempotency cache hits and conflict checks are isolated per user. Operator B replaying Operator A's key does not receive Operator A's cached response; each operator owns their own idempotency namespace.

---

### Decision 9: Authorization Disclosure Policy: 403 Forbidden vs. 404 Not Found

- **Context**: Deciding whether to hide resource existence (404) or report authorization denial (403) when an operator accesses a work item outside their team.
- **Decision**: Newtonite returns `403 Forbidden` with a structured `ApiError` when an authenticated operator attempts an unauthorized action against an existing resource belonging to another team, and returns `404 Not Found` only when the resource ID does not exist in the database.
- **Trade-offs & Rationale**: For internal engineering operations platforms, clear distinction between broken UUID links (404) and organizational permission boundaries (403) prevents developer confusion and simplifies incident triaging. Resource existence leakage is acceptable within an internal enterprise tenant compared to public consumer applications.

