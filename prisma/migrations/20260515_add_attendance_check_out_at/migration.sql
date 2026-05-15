DO $$
BEGIN
  IF to_regclass('public."Attendance"') IS NOT NULL THEN
    ALTER TABLE "Attendance"
    ADD COLUMN IF NOT EXISTS "checkOutAt" TIMESTAMP(3);
  END IF;
END $$;
