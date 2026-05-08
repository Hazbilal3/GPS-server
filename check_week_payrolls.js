const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payrolls = await prisma.payroll.findMany({
    where: { weekNumber: 202617 },
    select: { driverId: true, driverName: true, totalBonus: true, totalDeduction: true }
  });
  console.log(JSON.stringify(payrolls, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
