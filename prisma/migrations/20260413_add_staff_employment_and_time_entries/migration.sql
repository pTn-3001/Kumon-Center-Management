DO $$
BEGIN
  CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  IF to_regclass('public."Staff"') IS NOT NULL THEN
    ALTER TABLE "Staff"
    ADD COLUMN IF NOT EXISTS "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(14,0);

    CREATE TABLE IF NOT EXISTS "StaffTimeEntry" (
      "id" SERIAL PRIMARY KEY,
      "staffId" INTEGER NOT NULL,
      "workDate" TIMESTAMP(3) NOT NULL,
      "clockIn" TIMESTAMP(3) NOT NULL,
      "clockOut" TIMESTAMP(3),
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StaffTimeEntry_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "StaffTimeEntry_staffId_workDate_idx" ON "StaffTimeEntry"("staffId", "workDate");
  END IF;
END $$;
