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

- **Context**: Real JWT/OAuth2 authentication and authorization are scheduled for Milestone M3. In M2, the server must still associate created items, claims, and activity logs with an actor.
- **Decision**: Created a `CurrentUserProvider` abstraction with a development-only implementation (`DevelopmentCurrentUserProvider`) that resolves to the seeded development administrator Alex Morgan (`11111111-1111-1111-1111-111111111111`).
- **Trade-offs & Rationale**: Strictly avoids trusting arbitrary, spoofable client headers (such as `X-User-Id`). It creates a clear security boundary: the controller and service layer always obtain identity from the provider, allowing seamless drop-in replacement with Spring Security principal resolution in M3 without modifying business logic.
