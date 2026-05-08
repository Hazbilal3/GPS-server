const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payrolls = await prisma.payroll.findMany({
    where: { 
      driverId: 254309,
      createdAt: { gte: new Date('2026-04-20') }
    }
  });
  console.log(JSON.stringify(payrolls, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
