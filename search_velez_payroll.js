const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const payrolls = await prisma.payroll.findMany({
    where: { 
      driverName: { contains: 'Velez', mode: 'insensitive' }
    }
  });
  console.log(JSON.stringify(payrolls, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
