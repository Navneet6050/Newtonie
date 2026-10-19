# Newtonite Backend

Modular monolith backend for Newtonite built with Spring Boot 3.5.0 and Java 25.

## Technology Stack

- **Java**: 25 (OpenJDK / Eclipse Adoptium)
- **Framework**: Spring Boot 3.5.0
- **Database**: PostgreSQL 16 (via Docker Compose)
- **Database Migrations**: Flyway (`flyway-core` + `flyway-database-postgresql`)
- **Persistence**: Spring Data JPA / Hibernate (`ddl-auto: validate`)
- **Security**: Spring Security 6 with stateless signed HMAC-SHA256 JWT tokens and BCrypt password encoding
- **Validation**: Jakarta Bean Validation (`hibernate-validator`)
- **Monitoring**: Spring Boot Actuator (`/actuator/health`, `/actuator/info`)
- **Build Tool**: Apache Maven (via Maven Wrapper `mvnw`)

## Package Architecture

```
com.newtonite
├── NewtoniteApplication.java        # Spring Boot application entrypoint
├── config/                          # Infrastructure & security configuration
│   ├── SecurityConfig.java          # Security filter chain, JWT filter & authorization rules
│   └── WebConfig.java               # Cross-Origin Resource Sharing (CORS) rules
├── security/                        # Authentication & JWT security
│   ├── AuthController.java          # /api/auth/login and /api/auth/me endpoints
│   ├── JwtService.java              # HMAC-SHA256 token generation and claim validation
│   ├── JwtAuthenticationFilter.java # OncePerRequestFilter extracting Bearer tokens
│   ├── UserPrincipal.java           # Spring Security UserDetails implementation
│   ├── RestAuthenticationEntryPoint.java # 401 Unauthorized structured JSON formatter
│   ├── RestAccessDeniedHandler.java # 403 Forbidden structured JSON formatter
│   └── dto/                         # LoginRequest, LoginResponse, AuthUserResponse
├── common/
│   ├── error/                       # Consistent API error representation
│   │   ├── ApiError.java            # Structured JSON error payload
│   │   ├── GlobalExceptionHandler.java # RestControllerAdvice handling validation, conflicts & 403/401
│   │   └── *Exception.java          # Domain exception hierarchy (404, 409)
│   └── identity/                    # Actor identity resolution
│       ├── CurrentUserProvider.java # Provider interface
│       └── SecurityCurrentUserProvider.java # Production provider backed by SecurityContext
├── workitem/                        # Work items domain module
│   ├── WorkItem.java                # JPA entity with optimistic locking (@Version)
│   ├── WorkItemType.java            # INCIDENT, TASK, BUG, OPS
│   ├── WorkItemStatus.java          # OPEN, IN_PROGRESS, REVIEW_NEEDED, COMPLETED, BLOCKED
│   ├── WorkItemPriority.java        # URGENT, HIGH, MEDIUM, LOW
│   ├── WorkItemRepository.java      # JPA Repository with atomic claim query & tracking sequence
│   ├── WorkItemSpecification.java   # Dynamic Criteria filter, team-scoped filtering & search
│   ├── WorkItemService.java         # Domain logic, team authorization, transitions & claims
│   ├── WorkItemController.java      # REST controller with pagination & If-Match preconditions
│   └── dto/                         # DTOs: CreateWorkItemRequest, UpdateWorkItemRequest, WorkItemResponse
├── team/                            # Team and identity membership module
│   ├── User.java & Team.java        # Core JPA entities
│   ├── TeamMembership.java          # Team membership relationship entity
│   └── *Repository.java             # UserRepository, TeamRepository, TeamMembershipRepository
└── activity/                        # Audit and idempotency module
    ├── ActivityLog.java             # Immutable audit trail entity
    ├── ActivityLogRepository.java   # Paginated audit log repository
    ├── ActivityLogService.java      # Transactional audit logging
    ├── IdempotencyRecord.java       # User-scoped deduplication entity (user_id, key)
    ├── IdempotencyRecordRepository.java
    └── IdempotencyService.java      # SHA-256 payload hashing & scoped replay detection
```

## Configuration & Environment Variables

All sensitive and environment-specific settings are externalized:

| Variable | Default Value | Description |
|---|---|---|
| `SERVER_PORT` | `8080` | HTTP port for Spring Boot application |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/newtonite` | PostgreSQL JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME` | `newtonite` | PostgreSQL username |
| `SPRING_DATASOURCE_PASSWORD` | `newtonite` | PostgreSQL password |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3000` | Allowed frontend origin for CORS |
| `JWT_SECRET` | *(safe local default)* | 256-bit signing key for HMAC-SHA256 JWTs |
| `JWT_EXPIRATION_MS` | `86400000` (24h) | JWT access token lifetime |

## Development Accounts & Credentials

Local development accounts provisioned in Flyway migrations:

- **Password**: `NewtoniteDev2026!` (BCrypt hashed)
- **Accounts**:
  - `alex.morgan@acme.internal` (System Admin, Acme Studio Lead)
  - `sarah.chen@acme.internal` (User, Acme Studio Member)
  - `marcus.bell@acme.internal` (User, Acme Studio Member)
  - `elena.rostova@acme.internal` (User, Acme Studio Member)
  - `liam.vance@acme.internal` (User, Acme Platform Lead)

## Local Development Workflow

### 1. Prerequisites
- JDK 25 installed.
- Docker running for the PostgreSQL service.

### 2. Set JDK 25 in Terminal Session
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot"
```

### 3. Build & Run Tests
```powershell
.\mvnw.cmd clean test
```

### 4. Package Artifact
```powershell
.\mvnw.cmd package
```

The resulting executable JAR will be located at `target/backend-0.0.1-SNAPSHOT.jar`.

### 5. Run Backend Locally
```powershell
.\mvnw.cmd spring-boot:run
```

Verify backend health:
```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
```

Expected response:
```json
{
  "status": "UP"
}
```

## Database Migrations

Migrations are managed with Flyway in `src/main/resources/db/migration/`:
- `V1__initial_schema.sql`: Initial schema containing `users`, `teams`, `team_memberships`, `work_items`, `comments`, `activity_logs`, and `idempotency_records`.
- `V2__standardize_enums_and_sequence.sql`: Standardizes enums to uppercase, creates `work_item_seq` sequence for atomic `NEW-XXXX` tracking numbers, and configures unclaimed items.
- `V3__auth_and_user_credentials.sql`: Adds `password_hash` and `enabled` to `users`, seeds BCrypt credentials for local accounts, adds cross-team user Liam Vance and work item, and migrates `idempotency_records` to composite primary key `(user_id, key)`.
