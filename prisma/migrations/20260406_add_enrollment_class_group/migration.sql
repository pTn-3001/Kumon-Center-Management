-- Add class-group linkage to enrollments so student-class assignments are persisted.
DO $$
BEGIN
  IF to_regclass('public."Enrollment"') IS NOT NULL THEN
    ALTER TABLE "Enrollment"
    ADD COLUMN IF NOT EXISTS "classGroupId" INTEGER;

    IF to_regclass('public."ClassGroup"') IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Enrollment_classGroupId_fkey'
    ) THEN
      ALTER TABLE "Enrollment"
      ADD CONSTRAINT "Enrollment_classGroupId_fkey"
      FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS "Enrollment_classGroupId_idx" ON "Enrollment"("classGroupId");
  END IF;
END $$;
