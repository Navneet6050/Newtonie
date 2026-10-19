-- Newtonite Schema Migration V1: Initial Relational Foundation

-- 1. Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    avatar_initials VARCHAR(10),
    system_role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Team Memberships
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_memberships_team_user UNIQUE (team_id, user_id)
);

-- 4. Work Items
CREATE TABLE work_items (
    id UUID PRIMARY KEY,
    tracking_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    system_area VARCHAR(100) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Comments
CREATE TABLE comments (
    id UUID PRIMARY KEY,
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Activity Logs (Append-Only Audit Trail)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY,
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50),
    from_value VARCHAR(255),
    to_value VARCHAR(255),
    metadata TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Idempotency Records
CREATE TABLE idempotency_records (
    key VARCHAR(255) PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    status_code INT NOT NULL,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Performance Indexes
CREATE INDEX idx_work_items_team_status ON work_items(team_id, status, priority, updated_at DESC);
CREATE INDEX idx_work_items_assignee_status ON work_items(assignee_id, status, updated_at DESC);
CREATE INDEX idx_work_items_status ON work_items(status, updated_at DESC);
CREATE INDEX idx_work_items_tracking_number ON work_items(tracking_number);
CREATE INDEX idx_comments_work_item ON comments(work_item_id, created_at ASC);
CREATE INDEX idx_activity_logs_work_item ON activity_logs(work_item_id, timestamp DESC);
CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);

-- Initial Workspace Baseline Seed Data
INSERT INTO users (id, email, name, avatar_initials, system_role, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'alex.morgan@acme.internal', 'Alex Morgan', 'AM', 'ADMIN', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'sarah.chen@acme.internal', 'Sarah Chen', 'SC', 'USER', NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'marcus.bell@acme.internal', 'Marcus Bell', 'MB', 'USER', NOW(), NOW()),
    ('44444444-4444-4444-4444-444444444444', 'elena.rostova@acme.internal', 'Elena Rostova', 'ER', 'USER', NOW(), NOW());

INSERT INTO teams (id, name, description, created_at, updated_at)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Studio', 'Primary operations and engineering command center', NOW(), NOW()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Acme Platform', 'Core distributed infrastructure and runtime platform', NOW(), NOW()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Acme Cloud Infra', 'Site reliability and cloud telemetry operations', NOW(), NOW());

INSERT INTO team_memberships (id, team_id, user_id, role, created_at)
VALUES
    ('99999999-9999-9999-9999-999999999901', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'TEAM_LEAD', NOW()),
    ('99999999-9999-9999-9999-999999999902', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'MEMBER', NOW()),
    ('99999999-9999-9999-9999-999999999903', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'MEMBER', NOW()),
    ('99999999-9999-9999-9999-999999999904', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'MEMBER', NOW());

INSERT INTO work_items (id, tracking_number, title, description, type, status, priority, system_area, team_id, assignee_id, reporter_id, due_date, version, created_at, updated_at)
VALUES
    ('d0000001-0000-0000-0000-000000000001', 'NEW-1042', 'Database connection pool exhaustion during peak ingest', 'HikariCP active connections saturated at peak burst causing ingest queuing.', 'Incident', 'in_progress', 'urgent', 'Data Pipeline', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '1 day', 0, NOW(), NOW()),
    ('d0000002-0000-0000-0000-000000000002', 'NEW-1038', 'Refactor Kafka consumer rebalance listener for partition loss', 'Handle cooperative sticky assignor revocations cleanly during broker maintenance.', 'Task', 'review_needed', 'high', 'Event Bus', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NOW() + INTERVAL '2 days', 0, NOW(), NOW()),
    ('d0000003-0000-0000-0000-000000000003', 'NEW-1035', 'Provision multi-region Redis cluster for distributed session cache', 'Deploy replica pairs across availability zones with automatic failover.', 'Task', 'in_progress', 'high', 'Infrastructure', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '3 days', 0, NOW(), NOW()),
    ('d0000004-0000-0000-0000-000000000004', 'NEW-1029', 'Audit CORS wildcard policy on internal telemetry edge gateway', 'Restrict allowed origins to trusted internal domain roots and enforce preflight caches.', 'Bug', 'review_needed', 'high', 'Security Gateway', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '4 days', 0, NOW(), NOW()),
    ('d0000005-0000-0000-0000-000000000005', 'NEW-1024', 'Rotate expiring TLS root authority certificates on metrics proxy', 'Update intermediate CA cert bundle before cert expiry on Oct 25.', 'Ops', 'todo', 'medium', 'Telemetry', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '5 days', 0, NOW(), NOW()),
    ('d0000006-0000-0000-0000-000000000006', 'NEW-1017', 'Benchmark gRPC serialization throughput under synthetic 50k RPS', 'Profile memory allocation hotspots and thread contention during heavy batch calls.', 'Task', 'todo', 'low', 'Core Engine', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', NOW() + INTERVAL '7 days', 0, NOW(), NOW());
