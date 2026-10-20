# Newtonite Architecture & Engineering Decisions

This document records the five core architectural decisions, concurrency models, security controls, and trade-offs governing Newtonite.

---

### Decision 1: Modular Monolith Domain Architecture & Transactional Consistency

- **Context**: Newtonite is an internal operations and command-center platform requiring cohesive coordination across work items, team workspaces, collaboration discussions, and append-only activity auditing.
- **Decision**: Implemented a modular monolith in Spring Boot 3.5 (Java 25) with strict domain package boundaries (`com.newtonite.workitem`, `com.newtonite.team`, `com.newtonite.activity`, `com.newtonite.config`, and `com.newtonite.common`). Domain mutations and their corresponding audit logs or comment updates participate in shared, atomic database transactions (`@Transactional`).
- **Trade-offs & Rationale**:
  - Avoided the operational latency, network failures, distributed transaction overhead (2PC/Saga), and eventual consistency drift inherent to microservices.
  - Domain modules communicate via explicit Java service contracts.
  - Relational integrity is enforced at the database level using PostgreSQL 16 foreign keys (`ON DELETE CASCADE` on child logs and comments) and Flyway versioned migrations.

---

### Decision 2: Concurrency Control: Atomic Claiming & Dual-Layer Optimistic Locking

- **Context**: Multiple operations engineers triage the live work queue concurrently. The system must prevent race conditions during item claiming and avoid lost updates when multiple operators edit item details simultaneously.
- **Decision**: Implemented a two-tier concurrency control model:
  1. **Database-Level Atomic Claiming**: Claiming bypasses check-then-act logic and executes as an atomic conditional SQL update:
     ```sql
     UPDATE work_items 
     SET assignee_id = :userId, updated_at = :now, version = version + 1 
     WHERE id = :id AND assignee_id IS NULL;
     ```
     PostgreSQL evaluates this with an exclusive row lock; exactly one transaction modifies the row (`affectedRows == 1`), while concurrent contenders find `assignee_id IS NOT NULL`, affecting 0 rows and triggering an immediate `409 Conflict`.
  2. **Dual-Layer Optimistic Concurrency Control**: Modifying operations enforce version checks via HTTP `If-Match` entity tags (RFC 7232 strong numeric ETags or wildcard `*`) and JPA `@Version` column checks. Weak ETags (`W/"..."`) are explicitly rejected for state-modifying conditional updates. Stale versions reject with `409 Conflict`, preserving existing data and preventing misleading audit entries.

---

### Decision 3: Transactional User-Scoped Idempotency Pipeline

- **Context**: Unreliable networks or automated retries during work-item mutations can trigger duplicate items and cluttered audit trails. Furthermore, multi-operator environments risk cache poisoning if idempotency keys are shared or replayed across accounts.
- **Decision**: Backed the `Idempotency-Key` HTTP header with an `idempotency_records` table storing the request endpoint, a SHA-256 hash of the payload, HTTP response status, and serialized response body. In Flyway V3, the primary key was migrated to a composite key: `(user_id, key)`.
- **Trade-offs & Rationale**:
  - **Identical Retries**: Replaying the exact same request within the expiration window returns the cached HTTP response (`201 Created` or `200 OK`) without re-executing domain logic or generating duplicate database rows.
  - **Payload Mismatch Detection**: Reusing an active key with a modified request body is detected via SHA-256 hash disagreement and immediately rejected with `409 Conflict`.
  - **Operator Isolation**: Partitioning by `user_id` ensures that Operator B replaying Operator A's key cannot read Operator A's cached response, isolating cached replay data per authenticated operator.

---

### Decision 4: Stateless JWT Authentication & Multi-Tenant Team Authorization Matrix

- **Context**: Newtonite operations require authenticated user sessions and strict tenant isolation between organizational engineering teams (e.g., Acme Studio vs. Acme Platform). Plaintext credentials, spoofable client headers, and cross-team data access are unacceptable.
- **Decision**: Implemented Spring Security stateless authentication paired with server-enforced team authorization:
  - **Cryptographic Authentication**: Issues signed HMAC-SHA256 JWT tokens containing `sub` (User UUID), `email`, and `systemRole`. Stored user password hashes are verified using BCrypt (10 rounds); plaintext passwords are never persisted.
  - **Principal Resolution**: `SecurityCurrentUserProvider` resolves the acting user exclusively from the verified `SecurityContextHolder` principal. Client-supplied headers (`X-User-Id`, etc.) are ignored.
  - **Team Scoping Matrix**:
    - `ADMIN` (`system_role = 'ADMIN'`): Global visibility and mutation privileges across all teams.
    - `MEMBER` / `TEAM_LEAD`: Restricted strictly to their assigned teams (`team_memberships`). Cross-team reads, updates, claiming, comments, and audit log access return `403 Forbidden`. Cross-team assignments return `400 Bad Request`.
    - Unfiltered queue queries automatically filter by `team_id IN (userTeamIds)`.
  - **Authorization Disclosure Policy (403 vs 404)**: Unauthorized access to existing foreign-team assets yields `403 Forbidden`, while non-existent UUIDs yield `404 Not Found`. For internal enterprise platforms, clearly separating permission boundaries from broken links prevents operational triage confusion.

---

### Decision 5: Unified Command-Center Design, Honest Authentication & Persistent Collaboration

- **Context**: The user experience required an enterprise-grade command-center aesthetic suitable for executive presentations, combined with real team discussion capabilities, honest authentication disclosures, and responsive interaction without heavy client dependencies.
- **Decision**:
  - **Unified Authentication Experience**: Created a dedicated split-screen `/login` command center route, while sharing the identical `<AuthCard />` inside the in-app re-auth `<LoginDialog />`.
  - **Session Persistence Synchronization**: The "Remember session on this device" control directly dictates whether tokens are stored in `localStorage` (persisting across restarts) or `sessionStorage` (ephemeral to the tab). Switching the option cleanly purges stale tokens from the opposite storage.
  - **Honest Disclosures & No Mocked OAuth**: Avoided non-functional external OAuth buttons. Enterprise SSO (SAML 2.0 / OIDC) prerequisites are transparently explained, and unsubstantiated compliance badges (`SOC 2 Type II`, `ISO/IEC 27001`) were replaced with real architectural guarantees (ACID transactions, E-Tag preconditions, append-only audit, server-enforced RBAC).
  - **Persistent Work-Item Comments**: Activated the relational `comments` table via JPA `Comment` entity and custom `CommentRepository` with `JOIN FETCH c.author` to eliminate N+1 queries. Comment author identity is derived strictly from the authenticated principal, validation enforces non-empty content under 5,000 characters, and comments are returned in deterministic chronological order (`createdAt ASC`).
  - **Lightweight Design System**: Implemented a 4-tier dark command center token system (`.surface-subtle`, `.surface-elevated`, `.surface-overlay`) with CSS 3D perspective meters and tabular numerals (`tabular-nums`), eliminating bulky WebGL/Three.js bundles and supporting standard keyboard navigation without requiring client WebGL runtime support.
