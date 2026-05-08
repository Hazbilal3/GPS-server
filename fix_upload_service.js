const fs = require('fs');
const path = 'd:/Office/GPS- carlos/GPS/backend/src/upload/upload.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Find the corrupted updatePayrollDeduction method
const startMarker = 'async updatePayrollDeduction({';
const endMarker = 'async updatePayrollBonus({';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

const fixedMethod = `async updatePayrollDeduction({
    driverId,
    weekNumber,
    totalDeduction,
  }: {
    driverId: number;
    weekNumber: number;
    totalDeduction: number;
  }) {
    const existing = await this.prisma.payroll.findUnique({
      where: {
        driverId_weekNumber: { driverId, weekNumber },
      },
    });

    if (!existing) {
      this.logger.error(
        \`Payroll not found for driverId \${driverId}, week \${weekNumber}\`,
      );
      throw new NotFoundException(
        \`Payroll record not found for driver \${driverId}, week \${weekNumber}. It may need to be calculated first.\`,
      );
    }

    const netPay = existing.amount - totalDeduction + (existing.totalBonus || 0);

    try {
      return await this.prisma.payroll.update({
        where: {
          id: existing.id,
        },
        data: {
          totalDeduction,
          netPay,
        },
      });
    } catch (error) {
      this.logger.error(
        \`Failed to update deduction for driver \${driverId}, week \${weekNumber}\`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update payroll.');
    }
  }

  `;

content = content.substring(0, startIndex) + fixedMethod + content.substring(endIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully fixed updatePayrollDeduction and restored missing code.');
