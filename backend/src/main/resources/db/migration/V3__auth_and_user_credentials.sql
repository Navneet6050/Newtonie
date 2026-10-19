-- Newtonite Schema Migration V3: Authentication, User Credentials, and Scoped Idempotency

-- 1. Add authentication fields to users
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Populate development-only password hashes for seeded users
-- Password: NewtoniteDev2026!
-- BCrypt (10 rounds): $2a$10$eodjHsfSUscVSNrCVXv5ROb1jUdwDGNh8h.//SQedlxCpKYtqls92
UPDATE users 
SET password_hash = '$2a$10$eodjHsfSUscVSNrCVXv5ROb1jUdwDGNh8h.//SQedlxCpKYtqls92',
    enabled = TRUE
WHERE password_hash IS NULL;

-- 3. Provision additional distinct user in Acme Platform team for cross-team isolation tests
INSERT INTO users (id, email, name, avatar_initials, system_role, password_hash, enabled, created_at, updated_at)
VALUES 
    ('55555555-5555-5555-5555-555555555555', 'liam.vance@acme.internal', 'Liam Vance', 'LV', 'USER', '$2a$10$eodjHsfSUscVSNrCVXv5ROb1jUdwDGNh8h.//SQedlxCpKYtqls92', TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_memberships (id, team_id, user_id, role, created_at)
VALUES
    ('99999999-9999-9999-9999-999999999905', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'TEAM_LEAD', NOW())
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Seed an item for Acme Platform to verify team isolation
INSERT INTO work_items (id, tracking_number, title, description, type, status, priority, system_area, team_id, assignee_id, reporter_id, due_date, version, created_at, updated_at)
VALUES
    ('d0000007-0000-0000-0000-000000000007', 'NEW-1049', 'Platform Gateway Memory Optimization', 'Analyze off-heap Netty buffer leaks during sustained TLS connections.', 'INCIDENT', 'OPEN', 'URGENT', 'Gateway', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', NOW() + INTERVAL '3 days', 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Scope idempotency records to authenticated user (composite PK: user_id, key)
ALTER TABLE idempotency_records DROP CONSTRAINT idempotency_records_pkey;
ALTER TABLE idempotency_records ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
UPDATE idempotency_records SET user_id = '11111111-1111-1111-1111-111111111111' WHERE user_id IS NULL;
ALTER TABLE idempotency_records ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE idempotency_records ADD PRIMARY KEY (user_id, key);
