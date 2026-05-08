import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(body: { driverId: number; driverName: string; date: string; reason: string }) {
    return this.prisma.leaveRequest.create({
      data: {
        driverId: body.driverId,
        driverName: body.driverName,
        date: new Date(body.date),
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
    return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
  }

  async remove(id: number) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    return this.prisma.leaveRequest.delete({ where: { id } });
  }
}
