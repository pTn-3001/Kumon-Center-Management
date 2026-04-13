DO $$
BEGIN
	IF to_regclass('public."Staff"') IS NOT NULL THEN
		ALTER TABLE "Staff"
		ADD COLUMN IF NOT EXISTS "username" TEXT,
		ADD COLUMN IF NOT EXISTS "email" TEXT,
		ADD COLUMN IF NOT EXISTS "phone" TEXT;

		CREATE UNIQUE INDEX IF NOT EXISTS "Staff_username_key" ON "Staff"("username");
		CREATE UNIQUE INDEX IF NOT EXISTS "Staff_email_key" ON "Staff"("email");
	END IF;
END $$;
