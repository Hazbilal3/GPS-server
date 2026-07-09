import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';
import { parseEstDate } from '../utils/date';

@Injectable()
export class LeaveRequestsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async create(body: { driverId: number; driverName: string; date: string; reason: string }) {
    return this.prisma.leaveRequest.create({
      data: {
        driverId: body.driverId,
        driverName: body.driverName,
        date: parseEstDate(body.date),
        reason: body.reason,
        status: 'pending',
      },
    });
  }

  async findAll() {
    return this.prisma.leaveRequest.findMany({ orderBy: { date: 'asc' } });
  }

  async findByDriver(driverId: number) {
    return this.prisma.leaveRequest.findMany({
      where: { driverId },
      orderBy: { date: 'desc' },
    });
  }

  async updateStatus(id: number, status: 'approved' | 'rejected') {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    const updated = await this.prisma.leaveRequest.update({ where: { id }, data: { status } });

    const user = await (this.prisma.user as any).findFirst({
      where: { driverId: req.driverId },
      select: { pushToken: true },
    });
    if (user?.pushToken) {
      const dateStr = new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
      const title = status === 'approved' ? 'Time Off Approved' : 'Time Off Rejected';
      const body  = status === 'approved'
        ? `Your time-off request for ${dateStr} has been approved.`
        : `Your time-off request for ${dateStr} was not approved.`;
      await this.push.sendToMany([user.pushToken], title, body);
    }

    return updated;
  }

  async remove(id: number) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    return this.prisma.leaveRequest.delete({ where: { id } });
  }
}
