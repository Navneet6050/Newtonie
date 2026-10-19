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

## Concurrency & Security Baseline

- **Atomic Claiming**: Evaluated at the database level using `UPDATE ... WHERE id = :id AND assignee_id IS NULL`. Guaranteed to prevent race conditions without table-wide locking.
- **Optimistic Locking**: Enforced via JPA `@Version` and explicit `expectedVersion` preconditions, returning `409 Conflict` on stale writes.
- **Request Idempotency**: Handled transactionally with SHA-256 payload hashing and cached response replay.
- **Security Boundary**: In Milestone M2, the server resolves the current actor via `CurrentUserProvider` (seeded developer Alex Morgan). Client-supplied headers like `X-User-Id` are deliberately not trusted as authenticated identity. Real authentication (JWT/OAuth2) and role authorization are scheduled for Milestone M3.

---

## Testing & Verification

### Running Automated Tests

Run the complete test suite against the PostgreSQL database:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot"
cd backend
.\mvnw.cmd test
```

Test coverage includes:
1. **`ConcurrentClaimingTests`**: Mandatory Scenario 1 — simultaneous claim requests, atomic winner selection, 409 conflict on loser, single audit entry.
2. **`OptimisticLockingTests`**: Mandatory Scenario 2 — stale write detection, 409 conflict, winner data preservation, zero ghost audit logs.
3. **`IdempotencyTests`**: Mandatory Scenario 3 — duplicate create retry replay, payload mismatch conflict detection (409).
4. **`WorkItemWorkflowTests`**: Full CRUD, validation error mapping, invalid state transition rejection, no-op update audit suppression.
5. **`NewtoniteApplicationTests` & `HealthEndpointTests`**: Database migration validation and actuator healthcheck.

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
