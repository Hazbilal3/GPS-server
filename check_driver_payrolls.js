const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payrolls = await prisma.payroll.findMany({
    where: { driverId: 254309 },
    select: { id: true, weekNumber: true, totalBonus: true, totalDeduction: true, amount: true },
    orderBy: { weekNumber: 'desc' }
  });
  console.log(JSON.stringify(payrolls, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
