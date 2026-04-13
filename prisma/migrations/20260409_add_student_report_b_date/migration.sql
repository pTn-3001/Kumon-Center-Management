-- Add Report B date column for student profile editing/filtering.
DO $$
BEGIN
	IF to_regclass('public."Student"') IS NOT NULL THEN
		ALTER TABLE "Student"
		ADD COLUMN IF NOT EXISTS "reportBDate" TIMESTAMP(3);
	END IF;
END $$;
