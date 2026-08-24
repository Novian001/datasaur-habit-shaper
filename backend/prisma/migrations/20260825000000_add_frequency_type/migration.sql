-- Add flexible frequency support for BUILD habits.
-- Existing habits default to DAILY with no weekly target.
-- BREAK habits use DAILY (frequencyType is ignored for BREAK).

-- Step 1: Add the enum type.
ALTER TABLE `habits` ADD COLUMN `frequency_type` ENUM('DAILY', 'TIMES_PER_WEEK')
    NOT NULL DEFAULT 'DAILY';

-- Step 2: Add the weekly target column (nullable for DAILY).
ALTER TABLE `habits` ADD COLUMN `weekly_target` TINYINT UNSIGNED NULL;

-- Step 3: Range guard for weekly_target (0-255 covers 1-7; NULL means no constraint).
-- Application layer enforces 1-7 for TIMES_PER_WEEK.
ALTER TABLE `habits` ADD CONSTRAINT `chk_weekly_target_range`
    CHECK (`weekly_target` IS NULL OR `weekly_target` BETWEEN 1 AND 7);