-- Newtonite Schema Migration V2: Standardize Enums, Sequences, and Local Development Fixtures

-- 1. Standardize types to uppercase
UPDATE work_items SET type = UPPER(type);

-- 2. Standardize statuses to uppercase (mapping legacy 'todo' to 'OPEN')
UPDATE work_items SET status = 'OPEN' WHERE LOWER(status) = 'todo' OR LOWER(status) = 'open';
UPDATE work_items SET status = UPPER(status) WHERE status != 'OPEN';

-- 3. Standardize priorities to uppercase
UPDATE work_items SET priority = UPPER(priority);

-- 4. Atomic sequence for human-readable work item tracking numbers (NEW-XXXX)
CREATE SEQUENCE IF NOT EXISTS work_item_seq START WITH 1050;

-- 5. Set NEW-1024 as unassigned so local development has an immediate unclaimed work item
UPDATE work_items SET assignee_id = NULL WHERE tracking_number = 'NEW-1024';
