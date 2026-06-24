import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PushService } from '../push/push.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OrderDisputesService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async create(data: {
    driverId: number;
    driverName: string;
    date: string;
    orderNumber: string;
    expectedLocation: string;
    deliveredLocation: string;
    imageUrl?: string;
  }) {
    const dispute = await this.prisma.orderDispute.create({
      data: {
        driverId: data.driverId,
        driverName: data.driverName,
        date: new Date(data.date),
        orderNumber: data.orderNumber,
        expectedLocation: data.expectedLocation,
        deliveredLocation: data.deliveredLocation,
        imageUrl: data.imageUrl,
        status: 'open',
      },
    });

    // Send push notification to driver
    const user = await this.prisma.user.findFirst({
      where: { driverId: data.driverId },
      select: { pushToken: true },
    });
    if (user?.pushToken) {
      await this.push.sendToMany(
        [user.pushToken],
        'New Order Dispute Filed',
        `A dispute was opened for order #${data.orderNumber}`,
        { type: 'order_dispute', disputeId: dispute.id },
      );
    }

    return dispute;
  }

  async getAll() {
    return this.prisma.orderDispute.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async getByDriver(driverId: number) {
    return this.prisma.orderDispute.findMany({
      where: { driverId },
      orderBy: { date: 'desc' },
    });
  }

  async getMetrics(driverId: number) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [confirmedCount, uploads, disputes] = await Promise.all([
      this.prisma.orderDispute.count({
        where: {
          driverId,
          status: 'confirmed',
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.upload.findMany({
        where: {
          driverId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { pieces: true },
      }),
      this.prisma.orderDispute.findMany({
        where: { driverId },
        orderBy: { date: 'desc' },
      }),
    ]);

    const totalPackages = uploads.reduce((s, u) => s + (u.pieces ?? 1), 0);
    const dpmo =
      totalPackages > 0
        ? Math.round((confirmedCount / totalPackages) * 1_000_000)
        : 0;

    let band: string;
    if (dpmo <= 500) band = 'Outstanding';
    else if (dpmo <= 1000) band = 'Good';
    else if (dpmo <= 1500) band = 'Warning';
    else band = 'At Risk';

    return { dpmo, band, totalPackages, confirmedCount, disputes };
  }

  async update(
    id: number,
    data: {
      date?: string;
      orderNumber?: string;
      expectedLocation?: string;
      deliveredLocation?: string;
      imageUrl?: string;
    },
  ) {
    const existing = await this.prisma.orderDispute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order dispute ${id} not found`);
    return this.prisma.orderDispute.update({
      where: { id },
      data: {
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.orderNumber ? { orderNumber: data.orderNumber } : {}),
        ...(data.expectedLocation ? { expectedLocation: data.expectedLocation } : {}),
        ...(data.deliveredLocation ? { deliveredLocation: data.deliveredLocation } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
    });
  }

  async updateStatus(
    id: number,
    status: 'open' | 'investigating' | 'resolved_no_fault' | 'confirmed',
  ) {
    const existing = await this.prisma.orderDispute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order dispute ${id} not found`);
    return this.prisma.orderDispute.update({ where: { id }, data: { status } });
  }

  async delete(id: number) {
    const existing = await this.prisma.orderDispute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Order dispute ${id} not found`);

    // Remove image file if present
    if (existing.imageUrl) {
      const filename = existing.imageUrl.split('/').pop();
      if (filename) {
        const filePath = path.join('./uploads/order-disputes', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    return this.prisma.orderDispute.delete({ where: { id } });
  }
}
