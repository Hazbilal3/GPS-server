import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PayrollOverrideService {
  constructor(private readonly prisma: PrismaService) {}

  async applyOverride(dto: {
    driverId: number;
    weekNumber: number;
    zipCode: string;
    date: string;
    newRate: number;
    changedBy: string;
  }) {
    const { driverId, weekNumber, zipCode, date, newRate, changedBy } = dto;

    const payroll = await this.prisma.payroll.findUnique({
      where: { driverId_weekNumber: { driverId, weekNumber } },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found');

    const breakdown = (payroll.zipBreakdown as any[]) || [];
    const idx = breakdown.findIndex((b) => b.zip === zipCode && b.date === date);
    if (idx === -1) throw new NotFoundException('Zip entry not found in breakdown');

    const originalRate = breakdown[idx].rate as number;
    const newAmount = Number((breakdown[idx].stops * newRate).toFixed(2));

    const newBreakdown = [...breakdown];
    newBreakdown[idx] = { ...newBreakdown[idx], rate: newRate, amount: newAmount };

    const newSubtotal = Number(
      newBreakdown.reduce((sum: number, b: any) => sum + (b.amount ?? 0), 0).toFixed(2),
    );
    const newNetPay = Number(
      (newSubtotal - (payroll.totalDeduction || 0) + (payroll.totalBonus || 0)).toFixed(2),
    );

    await this.prisma.payroll.update({
      where: { driverId_weekNumber: { driverId, weekNumber } },
      data: { zipBreakdown: newBreakdown, amount: newSubtotal, netPay: newNetPay },
    });

    // Upsert override log — keep originalRate as the very first rate before any override
    const override = await this.prisma.payrollRateOverride.upsert({
      where: { driverId_zipCode_date: { driverId, zipCode, date } },
      create: { driverId, zipCode, date, originalRate, newRate, changedBy },
      update: { newRate, changedBy, changedAt: new Date() },
    });

    return {
      zipBreakdown: newBreakdown,
      subtotal: newSubtotal,
      netPay: newNetPay,
      override: {
        zipCode: override.zipCode,
        date: override.date,
        originalRate: override.originalRate,
        newRate: override.newRate,
        changedBy: override.changedBy,
        changedAt: override.changedAt,
      },
    };
  }

  async getOverrides(driverId: number, weekNumber: number) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { driverId_weekNumber: { driverId, weekNumber } },
      select: { zipBreakdown: true },
    });
    if (!payroll) return [];

    const breakdown = (payroll.zipBreakdown as any[]) || [];
    const dates = [...new Set(breakdown.map((b: any) => b.date).filter(Boolean))] as string[];
    if (dates.length === 0) return [];

    return this.prisma.payrollRateOverride.findMany({
      where: { driverId, date: { in: dates } },
    });
  }
}
