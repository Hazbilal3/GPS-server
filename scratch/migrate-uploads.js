
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating uploads...');
  
  // 1. Default all nulls to Regular
  const res1 = await prisma.upload.updateMany({
    where: { salaryType: null },
    data: { salaryType: 'Regular' }
  });
  console.log(`Updated ${res1.count} uploads to Regular.`);

  // 2. Set DRIVER TEST (12345) from 23rd April to Fixed Rate
  const res2 = await prisma.upload.updateMany({
    where: {
      driverId: 12345,
      createdAt: { gte: new Date('2026-04-23T00:00:00Z') }
    },
    data: {
      salaryType: 'Fixed Rate',
      rate: 500
    }
  });
  console.log(`Updated ${res2.count} uploads for DRIVER TEST to Fixed Rate.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
