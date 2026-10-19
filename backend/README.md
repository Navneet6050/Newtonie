# Newtonite Backend

Modular monolith backend for Newtonite built with Spring Boot 3.5.0 and Java 25.

## Technology Stack

- **Java**: 25 (OpenJDK / Eclipse Adoptium)
- **Framework**: Spring Boot 3.5.0
- **Database**: PostgreSQL 16 (via Docker Compose)
- **Database Migrations**: Flyway (`flyway-core` + `flyway-database-postgresql`)
- **Persistence**: Spring Data JPA / Hibernate (`ddl-auto: validate`)
- **Security**: Spring Security 6 (development baseline permitting actuator health and API access)
- **Validation**: Jakarta Bean Validation (`hibernate-validator`)
- **Monitoring**: Spring Boot Actuator (`/actuator/health`, `/actuator/info`)
- **Build Tool**: Apache Maven (via Maven Wrapper `mvnw`)

## Package Architecture

```
com.newtonite
├── NewtoniteApplication.java        # Spring Boot application entrypoint
├── config/                          # Infrastructure & security configuration
│   ├── SecurityConfig.java          # Security filter chain and endpoint authorization
│   └── WebConfig.java               # Cross-Origin Resource Sharing (CORS) rules
├── common/
│   ├── error/                       # Consistent API error representation
│   │   ├── ApiError.java            # Structured JSON error payload
│   │   ├── GlobalExceptionHandler.java # RestControllerAdvice handling validation & conflicts
│   │   └── *Exception.java          # Domain exception hierarchy (404, 409)
│   └── identity/                    # Actor identity resolution
│       ├── CurrentUserProvider.java # Provider interface
│       └── DevelopmentCurrentUserProvider.java # Explicit dev fixture (Alex Morgan)
├── workitem/                        # Work items domain module
│   ├── WorkItem.java                # JPA entity with optimistic locking (@Version)
│   ├── WorkItemType.java            # INCIDENT, TASK, BUG, OPS
│   ├── WorkItemStatus.java          # OPEN, IN_PROGRESS, REVIEW_NEEDED, COMPLETED, BLOCKED
│   ├── WorkItemPriority.java        # URGENT, HIGH, MEDIUM, LOW
│   ├── WorkItemRepository.java      # JPA Repository with atomic claim query & tracking sequence
│   ├── WorkItemSpecification.java   # Dynamic Criteria filter & free-text search
│   ├── WorkItemService.java         # Transactional domain logic, transitions & claims
│   ├── WorkItemController.java      # REST controller with pagination & optimistic preconditions
│   └── dto/                         # DTOs: CreateWorkItemRequest, UpdateWorkItemRequest, WorkItemResponse
├── team/                            # Team and identity membership module
│   ├── User.java & Team.java        # Core JPA entities
│   └── UserRepository.java & TeamRepository.java
└── activity/                        # Audit and idempotency module
    ├── ActivityLog.java             # Immutable audit trail entity
    ├── ActivityLogRepository.java   # Paginated audit log repository
    ├── ActivityLogService.java      # Transactional audit logging
    ├── IdempotencyRecord.java       # Deduplication tracking entity
    ├── IdempotencyRecordRepository.java
    └── IdempotencyService.java      # SHA-256 payload hashing & replay detection
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

Migrations are managed with Flyway and located in `src/main/resources/db/migration/`:
- `V1__initial_schema.sql`: Initial schema containing `users`, `teams`, `team_memberships`, `work_items`, `comments`, `activity_logs`, and `idempotency_records`, along with compound indexes and initial seed data.
- `V2__standardize_enums_and_sequence.sql`: Standardizes enums to uppercase, establishes `work_item_seq` sequence for atomic `NEW-XXXX` tracking numbers, and configures unclaimed items for local test fixtures.
