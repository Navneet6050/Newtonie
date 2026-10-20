# Newtonite

Newtonite is a high-performance internal operations and work-management platform for engineering teams. It provides real-time work-item tracking, team workspaces, activity auditing, and operational command dashboards.

## Repository Layout

```
newtonite/
├── .env.example              # Safe local environment variable defaults
├── .gitignore                # Git ignore rules for workspace, secrets, and build targets
├── compose.yaml              # Docker Compose service definition for PostgreSQL 16
├── ENGINEERING_DECISIONS.md  # Key architectural decisions, concurrency models & trade-offs
├── backend/                  # Spring Boot 3.5.0 modular monolith (Java 25)
│   ├── .mvn/wrapper/         # Maven Wrapper configuration
│   ├── mvnw / mvnw.cmd       # Maven Wrapper scripts
│   ├── pom.xml               # Backend dependencies and build configuration
│   ├── src/main/java/        # Application sources (com.newtonite.*)
│   │   ├── config/           # Security, Web & CORS configuration
│   │   ├── common/           # Error models and development identity provider
│   │   ├── workitem/         # Work item entity, service, repository, and REST API
│   │   ├── team/             # Teams and Users entity models and repositories
│   │   └── activity/         # Immutable audit logging and idempotency service
│   ├── src/main/resources/   # Configuration (application.yml) and Flyway migrations (V1, V2)
│   └── src/test/java/        # Integration, concurrency, idempotency & workflow tests
└── frontend/                 # Next.js 16 + TypeScript + Tailwind CSS application
    ├── src/app/              # App Router pages and layouts
    ├── src/components/       # UI components and dashboard shell
    └── src/lib/              # Typed API client and utility helpers
```

---

## Prerequisites

- **Java Development Kit (JDK) 25** (e.g. Eclipse Adoptium OpenJDK 25)
- **Docker Desktop** (for containerized PostgreSQL 16)
- **Node.js 18+** and **npm** (for frontend development)

---

## Quickstart & Local Development

### 1. Environment Setup

Copy `.env.example` to `.env` or use safe local defaults:

```powershell
Copy-Item .env.example .env
```

Default local development settings:
- **PostgreSQL Port**: `5433` (mapped to container port `5432` to avoid host service port collisions)
- **Database Name**: `newtonite`
- **Database User / Password**: `newtonite` / `newtonite`
- **Backend API URL**: `http://localhost:8080/api`
- **Frontend URL**: `http://localhost:3000`

### 2. Start PostgreSQL Database

Launch the containerized PostgreSQL 16 instance with persistent volume and healthcheck:

```powershell
docker compose up -d
```

Verify that the container is healthy:
```powershell
docker compose ps
```

### 3. Start Backend (Spring Boot)

Set your terminal session to JDK 25 without modifying global system environment variables:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot"
cd backend
.\mvnw.cmd spring-boot:run
```

On Linux / macOS:
```bash
export JAVA_HOME=/path/to/jdk-25
cd backend
./mvnw spring-boot:run
```

Health check endpoint:
- [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) (returns `{"status":"UP"}`)

### 4. Start Frontend (Next.js)

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Newtonite operations dashboard.

---

## Work-Item API Reference (Milestone M2)

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/work-items` | Create a new work item. Supports optional `Idempotency-Key` header. Returns `201 Created` with `Location`. |
| `GET` | `/api/work-items` | List & search work items with multi-field filtering and bounded pagination. |
| `GET` | `/api/work-items/{id}` | Retrieve a single work item by UUID or return `404 Not Found`. |
| `PATCH` | `/api/work-items/{id}` | Partial update with optimistic locking (`expectedVersion` or `If-Match` header). |
| `POST` | `/api/work-items/{id}/claim` | Atomically claim an unassigned work item. Rejects races with `409 Conflict`. |
| `GET` | `/api/work-items/{id}/activity`| Retrieve paginated immutable activity audit history for a work item. |

### Sample Requests & Responses

#### 1. Create a Work Item
```http
POST /api/work-items
Content-Type: application/json
Idempotency-Key: b7a3e9c1-8452-47e2-8921-2a912d7c0301

{
  "title": "Ingest pipeline memory leak investigation",
  "description": "Investigate heap dump after sustained 10k ingest spikes.",
  "type": "INCIDENT",
  "priority": "URGENT",
  "systemArea": "Data Pipeline",
  "teamId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "assigneeId": "22222222-2222-2222-2222-222222222222",
  "dueDate": "2026-10-25T18:00:00Z"
}
```
**Response (`201 Created`):**
```json
{
  "id": "e278fc62-6130-4bc3-8007-1872c7bf8418",
  "trackingNumber": "NEW-1050",
  "title": "Ingest pipeline memory leak investigation",
  "description": "Investigate heap dump after sustained 10k ingest spikes.",
  "type": "INCIDENT",
  "status": "OPEN",
  "priority": "URGENT",
  "systemArea": "Data Pipeline",
  "team": { "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "name": "Acme Studio" },
  "assignee": { "id": "22222222-2222-2222-2222-222222222222", "name": "Sarah Chen", "avatarInitials": "SC", "email": "sarah.chen@acme.internal" },
  "reporter": { "id": "11111111-1111-1111-1111-111111111111", "name": "Alex Morgan", "avatarInitials": "AM", "email": "alex.morgan@acme.internal" },
  "dueDate": "2026-10-25T18:00:00Z",
  "version": 0,
  "createdAt": "2026-10-20T01:05:00Z",
  "updatedAt": "2026-10-20T01:05:00Z"
}
```

#### 2. Query & Filter Work Items
```http
GET /api/work-items?status=OPEN&priority=URGENT&search=pipeline&page=0&size=20&sort=updatedAt,desc
```
**Response (`200 OK`):**
```json
{
  "content": [ ... ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

#### 3. Update Work Item with Optimistic Locking
```http
PATCH /api/work-items/e278fc62-6130-4bc3-8007-1872c7bf8418
Content-Type: application/json
If-Match: "0"

{
  "expectedVersion": 0,
  "status": "IN_PROGRESS"
}
```
*Note: If another client updated this item concurrently, the server returns `409 Conflict` with a version conflict explanation.*

#### 4. Atomically Claim Work Item
```http
POST /api/work-items/e278fc62-6130-4bc3-8007-1872c7bf8418/claim
```
*Note: If two operators attempt to claim simultaneously, exactly one succeeds (`200 OK`) and the second receives `409 Conflict`.*

#### 5. View Activity Audit History
```http
GET /api/work-items/e278fc62-6130-4bc3-8007-1872c7bf8418/activity
```
**Response (`200 OK`):**
```json
{
  "content": [
    {
      "id": "7f8b91a2-1111-4444-8888-999999999999",
      "workItemId": "e278fc62-6130-4bc3-8007-1872c7bf8418",
      "actor": { "id": "11111111-1111-1111-1111-111111111111", "name": "Alex Morgan" },
      "actionType": "STATUS_CHANGED",
      "fieldName": "status",
      "fromValue": "OPEN",
      "toValue": "IN_PROGRESS",
      "timestamp": "2026-10-20T01:10:00Z"
    },
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "workItemId": "e278fc62-6130-4bc3-8007-1872c7bf8418",
      "actor": { "id": "11111111-1111-1111-1111-111111111111", "name": "Alex Morgan" },
      "actionType": "CREATED",
      "metadata": "Work item created with tracking number NEW-1050",
      "timestamp": "2026-10-20T01:05:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 2,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

---

## State Transition Policy

Status changes must follow explicit operations transitions:
- `OPEN` ➔ `IN_PROGRESS`, `BLOCKED`
- `IN_PROGRESS` ➔ `REVIEW_NEEDED`, `COMPLETED`, `BLOCKED`
- `REVIEW_NEEDED` ➔ `IN_PROGRESS`, `COMPLETED`, `BLOCKED`
- `BLOCKED` ➔ `OPEN`, `IN_PROGRESS`, `REVIEW_NEEDED`
- `COMPLETED` ➔ Terminal state. Cannot be reopened by ordinary updates (returns `409 Conflict`).
- No-op updates (resubmitting existing status) are accepted cleanly without generating spurious activity entries.

---

---

## Authentication & Team-Level Authorization (Milestone M3)

### 1. Authentication Design
- **Protocol**: Stateless Bearer JWT using HMAC-SHA256 (`io.jsonwebtoken:jjwt:0.12.6`).
- **Password Hashing**: BCrypt with 10 rounds (`BCryptPasswordEncoder`).
- **Principal Resolution**: `SecurityCurrentUserProvider` extracts the authenticated `UserPrincipal` from `SecurityContextHolder`. Client-supplied identity headers (`X-User-Id`, etc.) are strictly ignored.
- **Error Handling**: Missing or invalid tokens return structured `401 Unauthorized`. Invalid login credentials return generic `401 Unauthorized` without revealing account existence.

### 2. Endpoints
- **`POST /api/auth/login`**: Validates email/password credentials and issues a signed JWT access token.
- **`GET /api/auth/me`**: Returns the authenticated user's ID, email, name, system role, and team memberships.

### 3. Team Authorization Matrix
- **ADMIN** (`system_role = 'ADMIN'`): Global access across all teams.
- **MEMBER / TEAM_LEAD**: Strictly restricted to teams they belong to.
- **Cross-Team Read/Write Restrictions**: Operators from Team A cannot read (`403`), update (`403`), claim (`403`), or inspect activity logs (`403`) for work items belonging to Team B.
- **Cross-Team Assignment Prevention**: Work items cannot be assigned to users who are not members of the item's team (`400 Bad Request`).
- **Team Filter Scoping**: `GET /api/work-items?teamId=...` for unauthorized teams returns `403 Forbidden`. Unfiltered queries automatically scope results to the operator's authorized teams.

### 4. User-Scoped Idempotency
- In Flyway migration `V3`, `idempotency_records` uses a composite primary key `(user_id, key)`.
- Cached responses and collision detection are scoped by composite key `(user_id, key)`, ensuring replay requests are isolated to the originating operator.

### 5. Local Development Accounts (Development-Only)
The following pre-seeded test accounts are provided strictly for local environment verification. All local development accounts use the development-only password:
**`NewtoniteDev2026!`** (hashed with BCrypt in Flyway migration `V3`). *These credentials must never be deployed to staging or production environments.*:

| Name | Email | System Role | Primary Team | Team Role |
| :--- | :--- | :--- | :--- | :--- |
| **Alex Morgan** | `alex.morgan@acme.internal` | `ADMIN` | Acme Studio | `TEAM_LEAD` |
| **Sarah Chen** | `sarah.chen@acme.internal` | `USER` | Acme Studio | `MEMBER` |
| **Marcus Bell** | `marcus.bell@acme.internal` | `USER` | Acme Studio | `MEMBER` |
| **Elena Rostova** | `elena.rostova@acme.internal` | `USER` | Acme Studio | `MEMBER` |
| **Liam Vance** | `liam.vance@acme.internal` | `USER` | Acme Platform | `TEAM_LEAD` |

---

## Concurrency & Guarantees
- **Atomic Claiming**: Evaluated at the database level using `UPDATE ... WHERE id = :id AND assignee_id IS NULL`.
- **Optimistic Locking**: Enforced via JPA `@Version` and explicit `expectedVersion` or `If-Match` preconditions (`409 Conflict`).
- **State Transitions**: Validated per state machine; terminal states (`COMPLETED`) cannot be reopened.

---

## Testing & Verification

### Running Automated Tests
Run the complete backend integration and security test suite:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot"
cd backend
.\mvnw.cmd test
```

Test coverage includes:
1. **`SecurityAuthTests`**: 15 security scenarios covering login success, 401 on bad credentials/unauthenticated requests, token expiry, identity spoofing defense, cross-team read/mutation isolation (403), cross-team assignment rejection (400), team filter scoping, and user-scoped idempotency.
2. **`WorkItemCommentTests`**: 5 persistent comment collaboration scenarios covering authorized team discussion, cross-team access denial (403), admin cross-team commenting, blank content validation rejection (400), and automated activity log generation.
3. **`ConcurrentClaimingTests`**: Concurrency under atomic claim with authenticated actors.
4. **`OptimisticLockingTests`**: Optimistic locking, stale version rejection, ETag preconditions.
5. **`IdempotencyTests`**: Transactional idempotency, payload mismatch conflict detection.
6. **`WorkItemWorkflowTests`**: Full lifecycle workflow, validation, and activity log auditing.
7. **`NewtoniteApplicationTests` & `HealthEndpointTests`**: Database migration validation and health probes.

Package executable JAR:
```powershell
.\mvnw.cmd package
```

Frontend verification:
```powershell
cd frontend
npm run lint
npm run build
```

---

## Current Limitations & Production-Hardening Requirements

1. **Enterprise SSO Registration**: Google Workspace and Microsoft Entra ID single sign-on require registered OAuth client IDs, client secrets, and authorized redirect URIs in production identity tenants. In this local sandbox, SSO prerequisites are clearly disclosed rather than mocked.
2. **Browser Automation Sandbox**: Headless browser automation via Playwright was constrained in this sandbox by external network driver download blocks (`playwright.azureedge.net` 404). Verification was executed via full integration suites and live REST client automation.
3. **Token Storage**: The frontend stores short-lived JWT tokens in `sessionStorage` or `localStorage` depending on operator preference. Production environments should use HTTP-only, SameSite=Strict cookies to guard against XSS token exfiltration.
4. **Token Revocation**: Stateless JWTs cannot be revoked prior to expiration without a distributed token blacklist (e.g. Redis).
5. **Brute Force Protection**: `/api/auth/login` does not currently implement IP or account rate-limiting / lockout. Production deployment should introduce Bucket4j or API gateway rate limiting.
6. **Secret Management**: `JWT_SECRET` must be set via secure environment variables or a secret vault (e.g., AWS Secrets Manager, HashiCorp Vault) rather than the fallback development secret.

