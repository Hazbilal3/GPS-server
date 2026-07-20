import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DriverNotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(driverId: number, title: string, body: string, type?: string, orderId?: number) {
    return (this.prisma as any).driverNotification.create({
      data: { driverId, title, body, type: type ?? null, orderId: orderId ?? null },
    });
  }

  async getForDriver(driverId: number) {
    return (this.prisma as any).driverNotification.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  }

  async getUnreadCount(driverId: number): Promise<number> {
    return (this.prisma as any).driverNotification.count({ where: { driverId, isRead: false } });
  }

  async markRead(id: number, driverId: number) {
    return (this.prisma as any).driverNotification.updateMany({
      where: { id, driverId },
      data: { isRead: true },
    });
  }

  async markAllRead(driverId: number) {
    return (this.prisma as any).driverNotification.updateMany({
      where: { driverId, isRead: false },
      data: { isRead: true },
    });
  }
}
