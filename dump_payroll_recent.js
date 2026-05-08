const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payroll = await prisma.payroll.findMany({
    orderBy: { weekNumber: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(payroll, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
