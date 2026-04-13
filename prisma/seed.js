const { PrismaClient, Prisma } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  )
  LOOP
    EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
  `);
}

async function main() {
  await resetDatabase();

  const center = await prisma.center.create({
    data: {
      code: 'KUMON-GIAHOA',
      name: 'Kumon Gia Hòa',
      address: 'Việt Nam',
      phone: '0903313180',
    },
  });

  await prisma.staff.createMany({
    data: [
      {
        centerId: center.id,
        fullName: 'Dương Thị Mỹ Vân',
        username: 'kumongiahoa',
        role: 'ADMIN',
        employmentType: 'FULL_TIME',
        salary: new Prisma.Decimal(0),
        passwordHash: hashPassword('giahoa1234'),
        active: true,
      },
      {
        centerId: center.id,
        fullName: 'Owner Admin',
        username: 'admin',
        role: 'ADMIN',
        employmentType: 'FULL_TIME',
        salary: new Prisma.Decimal(0),
        passwordHash: hashPassword('30012004'),
        active: true,
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
