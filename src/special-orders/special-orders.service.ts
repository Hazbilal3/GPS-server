import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { PushService } from '../push/push.service';
import { parseEstDate } from '../utils/date';
import { getPayrollWeekKey } from '../utils/payroll-week';

@Injectable()
export class SpecialOrdersService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  async create(body: {
    routeName: string;
    stops: number;
    date: string;
    price: number;
    description?: string;
    targetType: 'specific' | 'all';
    targetDriverIds?: number[];
  }) {
    const order = await this.prisma.specialOrder.create({
      data: {
        routeName: body.routeName,
        stops: body.stops,
        date: parseEstDate(body.date),
        price: body.price,
        description: body.description || null,
        targetType: body.targetType,
        targetDriverIds: body.targetDriverIds ?? Prisma.JsonNull,
        status: 'pending',
      },
    });

    // Send push notifications to target drivers
    this.sendOrderNotification(order.id, body.routeName, body.stops, body.price, body.targetType, body.targetDriverIds);

    return order;
  }

  private async sendOrderNotification(
    orderId: number,
    routeName: string,
    stops: number,
    price: number,
    targetType: 'specific' | 'all',
    targetDriverIds?: number[],
  ) {
    try {
      const where =
        targetType === 'all'
          ? { driverId: { not: null }, pushToken: { not: null } }
          : { driverId: { in: targetDriverIds ?? [] }, pushToken: { not: null } };

      const drivers = await this.prisma.user.findMany({ where, select: { pushToken: true } });
      const tokens = drivers.map((d) => d.pushToken).filter(Boolean) as string[];

      await this.push.sendToMany(
        tokens,
        'Route Available',
        `${routeName} | ${stops} Stop${stops !== 1 ? 's' : ''} | $${price}`,
        { type: 'new_order', orderId },
      );
    } catch (_) {}
  }

  async findAll() {
    return this.prisma.specialOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForDriver(driverId: number) {
    const all = await this.prisma.specialOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return all.filter((order) => {
      // Always show orders this driver accepted (so they see their accepted badge)
      if (order.status === 'accepted' && order.acceptedBy === driverId) return true;
      // Hide non-pending orders
      if (order.status !== 'pending') return false;
      // Hide orders this driver already rejected
      const rejected = (order.rejectedBy as number[]) || [];
      if (rejected.includes(driverId)) return false;
      // Show pending orders targeted at this driver
      if (order.targetType === 'all') return true;
      const ids = (order.targetDriverIds as number[]) || [];
      return ids.includes(driverId);
    });
  }

  async accept(id: number, driverId: number, driverName: string) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'accepted') throw new BadRequestException('Order already accepted');

    const updated = await this.prisma.specialOrder.update({
      where: { id },
      data: { status: 'accepted', acceptedBy: driverId, acceptedByName: driverName },
    });

    // Create payroll earning for this driver — computed on-the-fly, not stored in Payroll table
    const orderDate = new Date(order.date);
    const { key: weekNumber } = getPayrollWeekKey(orderDate);
    await (this.prisma.specialOrderEarning as any).create({
      data: {
        specialOrderId: id,
        driverId,
        weekNumber,
        date: orderDate,
        amount: order.price,
        routeName: order.routeName,
        stops: order.stops,
      },
    });

    return updated;
  }

  async reject(id: number, driverId: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'accepted') throw new BadRequestException('Order already accepted');

    const currentRejected = (order.rejectedBy as number[]) || [];
    if (currentRejected.includes(driverId)) return order; // already rejected

    const rejectedBy = [...currentRejected, driverId];

    // Mark as rejected when all targeted specific drivers have rejected
    let newStatus = order.status;
    if (order.targetType === 'specific') {
      const targetIds = (order.targetDriverIds as number[]) || [];
      const allRejected = targetIds.length > 0 && targetIds.every((id) => rejectedBy.includes(id));
      if (allRejected) newStatus = 'rejected';
    }

    return this.prisma.specialOrder.update({
      where: { id },
      data: { rejectedBy, status: newStatus },
    });
  }

  async remove(id: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.specialOrder.delete({ where: { id } });
  }
}
