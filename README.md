# Newtonite

Newtonite is a high-performance internal operations and work-management platform for engineering teams. It provides real-time work-item tracking, team workspaces, activity auditing, and operational dashboards.

## Repository Layout

```
newtonite/
├── .env.example            # Safe local environment variable defaults
├── .gitignore              # Git ignore rules for workspace, secrets, and build targets
├── compose.yaml            # Docker Compose service definition for PostgreSQL 16
├── backend/                # Spring Boot 3.5.0 modular monolith (Java 25)
│   ├── .mvn/wrapper/       # Maven Wrapper configuration
│   ├── mvnw / mvnw.cmd     # Maven Wrapper scripts
│   ├── pom.xml             # Backend dependencies and build configuration
│   ├── src/main/java/      # Application sources (com.newtonite.*)
│   ├── src/main/resources/ # Configuration (application.yml) and Flyway migrations
│   └── src/test/java/      # Integration and health endpoint tests
└── frontend/               # Next.js 16 + TypeScript + Tailwind CSS application
    ├── src/app/            # App Router pages and layouts
    └── src/components/     # UI components and dashboard shell
```

---

## Prerequisites

- **Java Development Kit (JDK) 25** (e.g. Eclipse Adoptium OpenJDK 25)
- **Docker Desktop** (for containerized PostgreSQL 16)
- **Node.js 18+** and **npm** (for frontend development)

---

## Quickstart & Local Development

### 1. Environment Setup

Copy `.env.example` to `.env` or use the safe local defaults:

```powershell
Copy-Item .env.example .env
```

Default local development settings:
- **Database Port**: `5433` (mapped to container port `5432` to avoid host port collisions)
- **Database Name**: `newtonite`
- **Database User / Password**: `newtonite` / `newtonite`
- **Backend Port**: `8080`
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

Ensure your terminal session points to your JDK 25 installation (without altering global system environment variables):

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

Once started, verify the backend health endpoint:
- **Health Check**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health) (returns `{"status":"UP"}`)

### 4. Start Frontend (Next.js)

In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Newtonite dashboard.

---

## Testing & Verification

### Backend Tests

Run all unit and integration tests against the local database:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot"
cd backend
.\mvnw.cmd test
```

Build the production executable JAR:

```powershell
.\mvnw.cmd package
```

### Frontend Verification

Run linter and production build:

```powershell
cd frontend
npm run lint
npm run build
```

---

## Architecture & Domain Schema

The backend is built as a Spring Boot modular monolith with Flyway schema versioning. The initial schema (`V1__initial_schema.sql`) establishes:

- `users`: User identity and profile metadata
- `teams`: Workspace/team definitions
- `team_memberships`: User-to-team roles (`LEAD`, `MEMBER`, `VIEWER`)
- `work_items`: Tasks and tickets with title, description, status, priority, estimate, team, and assignee
- `comments`: Threaded comments on work items
- `activity_logs`: Immutable audit trails recording work item mutations
- `idempotency_records`: Request deduplication tracking for reliable API operations

Compound indexes are included for high-frequency queries:
- Team queue: `(team_id, status, priority, updated_at)`
- Assignee queue: `(assignee_id, status, updated_at)`
