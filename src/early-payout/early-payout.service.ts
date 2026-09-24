import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';

const ADMIN_EMAIL = 'c.taveras@expeditedtransportservices.net';

@Injectable()
export class EarlyPayoutService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  async create(driverId: number, payrollId: number | null, weekNumber: number, driverName: string, reason: string, requestedDates: string[] = []) {
    // 1. One submission per calendar day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const submittedToday = await (this.prisma as any).earlyPayoutRequest.findFirst({
      where: { driverId, createdAt: { gte: todayStart, lte: todayEnd } },
    });
    if (submittedToday) throw new BadRequestException('You have already submitted a request today. Please try again tomorrow.');

    // 2. No day overlap with existing pending or approved requests this week
    if (requestedDates.length > 0) {
      const existing = await (this.prisma as any).earlyPayoutRequest.findMany({
        where: { driverId, weekNumber, status: { in: ['pending', 'approved'] } },
      });
      const lockedDays = new Set<string>(existing.flatMap((r: any) => r.requestedDates as string[]));
      const overlap = requestedDates.filter(d => lockedDays.has(d));
      if (overlap.length > 0) throw new BadRequestException(`Days already requested: ${overlap.join(', ')}`);
    }

    const request = await (this.prisma as any).earlyPayoutRequest.create({
      data: { driverId, payrollId: payrollId ?? null, weekNumber, driverName, reason, requestedDates },
    });

    const daysLabel = requestedDates.length > 0 ? requestedDates.join(', ') : '—';
    this.mail.send(
      ADMIN_EMAIL,
      `Early Payout Request — ${driverName}`,
      `<p>A driver has submitted an early payout request.</p>
       <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
         <tr><td><strong>Name</strong></td><td>${driverName}</td></tr>
         <tr><td><strong>Driver ID</strong></td><td>${driverId}</td></tr>
         <tr><td><strong>Requested Days</strong></td><td>${daysLabel}</td></tr>
         <tr><td><strong>Reason</strong></td><td>${reason}</td></tr>
       </table>`,
    ).catch(() => {});

    return request;
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

  async approve(id: number, adminNote?: string, paidAmount?: number) {
    const req = await (this.prisma as any).earlyPayoutRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found.');
    return (this.prisma as any).earlyPayoutRequest.update({
      where: { id },
      data: {
        status: 'approved',
        adminNote: adminNote ?? null,
        paidDates: req.requestedDates,
        paidAmount: paidAmount ?? null,
        fee: 2,
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
