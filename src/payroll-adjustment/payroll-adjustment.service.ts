import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PayrollAdjustmentService {
  constructor(private readonly prisma: PrismaService) {}

  async addAdjustment(dto: {
    driverId: number;
    weekNumber: number;
    date: string;
    type: 'deduction' | 'bonus';
    amount: number;
    reason: string;
  }) {
    const { driverId, weekNumber, date, type, amount, reason } = dto;

    const payroll = await this.prisma.payroll.findUnique({
      where: { driverId_weekNumber: { driverId, weekNumber } },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found for this driver/week');

    const adj = await this.prisma.payrollAdjustment.create({
      data: { driverId, weekNumber, date, type, amount, reason },
    });

    return this.recalcAndReturn(driverId, weekNumber, adj);
  }

  async getAdjustments(driverId: number, weekNumber: number) {
    return this.prisma.payrollAdjustment.findMany({
      where: { driverId, weekNumber },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async deleteAdjustment(id: number) {
    const adj = await this.prisma.payrollAdjustment.findUnique({ where: { id } });
    if (!adj) throw new NotFoundException('Adjustment not found');
    await this.prisma.payrollAdjustment.delete({ where: { id } });
    return this.recalcAndReturn(adj.driverId, adj.weekNumber, null);
  }

  private async recalcAndReturn(driverId: number, weekNumber: number, newAdj: any) {
    const allAdj = await this.prisma.payrollAdjustment.findMany({
      where: { driverId, weekNumber },
    });

    const totalDeduction = Number(
      allAdj.filter((a) => a.type === 'deduction').reduce((s, a) => s + a.amount, 0).toFixed(2),
    );
    const totalBonus = Number(
      allAdj.filter((a) => a.type === 'bonus').reduce((s, a) => s + a.amount, 0).toFixed(2),
    );

    const payroll = await this.prisma.payroll.findUnique({
      where: { driverId_weekNumber: { driverId, weekNumber } },
    });
    if (!payroll) return { adjustment: newAdj, totalDeduction, totalBonus, netPay: 0 };

    const netPay = Number((payroll.amount - totalDeduction + totalBonus).toFixed(2));

    await this.prisma.payroll.update({
      where: { driverId_weekNumber: { driverId, weekNumber } },
      data: { totalDeduction, totalBonus, netPay },
    });

    return { adjustment: newAdj, totalDeduction, totalBonus, netPay };
  }
}
