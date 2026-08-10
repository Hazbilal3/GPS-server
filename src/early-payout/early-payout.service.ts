import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EarlyPayoutService {
  constructor(private prisma: PrismaService) {}

  async create(driverId: number, payrollId: number | null, weekNumber: number, driverName: string, reason: string) {
    const existing = await (this.prisma as any).earlyPayoutRequest.findFirst({
      where: { driverId, weekNumber, status: { in: ['pending', 'approved'] } },
    });
    if (existing) throw new BadRequestException('A request already exists for this week.');

    return (this.prisma as any).earlyPayoutRequest.create({
      data: { driverId, payrollId: payrollId ?? null, weekNumber, driverName, reason },
    });
  }

  async getMyRequests(driverId: number) {
    return (this.prisma as any).earlyPayoutRequest.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAll() {
    return (this.prisma as any).earlyPayoutRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: number, adminNote?: string, paidDates?: string[], paidAmount?: number) {
    const req = await (this.prisma as any).earlyPayoutRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found.');
    return (this.prisma as any).earlyPayoutRequest.update({
      where: { id },
      data: {
        status: 'approved',
        adminNote: adminNote ?? null,
        paidDates: paidDates ?? [],
        paidAmount: paidAmount ?? null,
        paidAt: new Date(),
      },
    });
  }

  async deny(id: number, adminNote: string) {
    const req = await (this.prisma as any).earlyPayoutRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found.');
    return (this.prisma as any).earlyPayoutRequest.update({
      where: { id },
      data: { status: 'denied', adminNote },
    });
  }
}
