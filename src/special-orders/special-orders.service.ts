import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';
import { parseEstDate } from '../utils/date';
import { getPayrollWeekKey } from '../utils/payroll-week';
import { DriverNotificationsService } from '../driver-notifications/driver-notifications.service';

const ADMIN_EMAIL = 'c.taveras@expeditedtransportservices.net';
const ROUTES_EMAIL = 'ets.routes@gmail.com';

@Injectable()
export class SpecialOrdersService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private mail: MailService,
    private notifService: DriverNotificationsService,
  ) {}

  async create(body: {
    routeName: string;
    stops: number;
    date: string;
    price: number;
    description?: string;
    targetType: 'specific' | 'all';
    targetDriverIds?: number[];
    pickupAddress?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    dropoffTime?: string;
    vehicleSize?: string;
    miles?: number;
    pieces?: number;
    itemWeight?: number;
    pickupPersonName?: string;
    pickupPersonPhone?: string;
    dropoffPersonName?: string;
    dropoffPersonPhone?: string;
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
        pickupAddress: body.pickupAddress || null,
        deliveryAddress: body.deliveryAddress || null,
        pickupTime: body.pickupTime || null,
        dropoffTime: body.dropoffTime || null,
        vehicleSize: body.vehicleSize || null,
        miles: body.miles ?? null,
        pieces: body.pieces ?? null,
        itemWeight: body.itemWeight ?? null,
        pickupPersonName: body.pickupPersonName || null,
        pickupPersonPhone: body.pickupPersonPhone || null,
        dropoffPersonName: body.dropoffPersonName || null,
        dropoffPersonPhone: body.dropoffPersonPhone || null,
      },
    });

    this.sendOrderNotification(order, body.targetType, body.targetDriverIds);

    return order;
  }

  private async sendOrderNotification(
    order: any,
    targetType: 'specific' | 'all',
    targetDriverIds?: number[],
  ) {
    try {
      const where =
        targetType === 'all'
          ? { driverId: { not: null }, pushToken: { not: null } }
          : { driverId: { in: targetDriverIds ?? [] }, pushToken: { not: null } };

      const drivers = await this.prisma.user.findMany({ where, select: { pushToken: true, driverId: true } });
      const tokens = drivers.map((d) => d.pushToken).filter(Boolean) as string[];

      const parts: string[] = [];
      if (order.pickupAddress && order.deliveryAddress) {
        parts.push(`${order.pickupAddress} → ${order.deliveryAddress}`);
      } else {
        parts.push(order.routeName);
      }
      parts.push(`${order.stops} Stop${order.stops !== 1 ? 's' : ''}`);
      parts.push(`$${order.price}`);
      if (order.pieces != null) parts.push(`${order.pieces} pcs`);
      if (order.miles != null) parts.push(`${order.miles} mi`);
      if (order.vehicleSize) parts.push(order.vehicleSize);
      if (order.itemWeight != null) parts.push(`${order.itemWeight} lbs`);

      const msg = parts.join(' | ');
      await this.push.sendToMany(tokens, 'Route Available', msg, { type: 'new_order', orderId: order.id });
      for (const d of drivers) {
        if (d.driverId) {
          await this.notifService.create(d.driverId, 'Route Available', msg, 'new_order', order.id).catch(() => {});
        }
      }
    } catch (_) {}
  }

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.specialOrder.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.specialOrder.count(),
    ]);
    return { data, total, page, pageSize };
  }

  async findForDriver(driverId: number) {
    const all = await this.prisma.specialOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return all.filter((order) => {
      if (order.status === 'accepted' && order.acceptedBy === driverId) return true;
      if (order.status !== 'pending') return false;
      const rejected = (order.rejectedBy as number[]) || [];
      if (rejected.includes(driverId)) return false;
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

    const appName = process.env.APP_NAME || 'CMJL';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
        <p>A driver has accepted a special order.</p>
        <table style="border-collapse:collapse;width:100%;max-width:480px">
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Order #</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${id}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Route</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.routeName}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Driver</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${driverName} (ID: ${driverId})</td></tr>
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Date</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.date ? new Date(order.date).toDateString() : '—'}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Stops</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.stops}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Price</td><td style="padding:6px 12px;border:1px solid #e2e8f0">$${order.price}</td></tr>
          ${order.pickupAddress ? `<tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Pickup</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.pickupAddress}</td></tr>` : ''}
          ${order.deliveryAddress ? `<tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Delivery</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.deliveryAddress}</td></tr>` : ''}
          ${order.description ? `<tr><td style="padding:6px 12px;font-weight:600;background:#f8fafc;border:1px solid #e2e8f0">Notes</td><td style="padding:6px 12px;border:1px solid #e2e8f0">${order.description}</td></tr>` : ''}
        </table>
        <p style="color:#64748b;font-size:12px;margin-top:16px">— ${appName} System</p>
      </div>
    `;
    const isRoute = !order.pickupAddress;
    const recipients = isRoute ? [ADMIN_EMAIL, ROUTES_EMAIL] : ADMIN_EMAIL;
    this.mail.send(
      recipients,
      `${appName} — Order #${id} Accepted by ${driverName}`,
      html,
      `Driver ${driverName} (ID: ${driverId}) has accepted Order #${id} — ${order.routeName}.`,
    ).catch(err => console.error('[SpecialOrders] Failed to send accept email:', err));

    return updated;
  }

  async markPickedUp(id: number, driverId: number, pickupPhotoUrl: string) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.acceptedBy !== driverId) throw new ForbiddenException();
    if (order.driverStatus === 'delivered') throw new BadRequestException('Already delivered');

    return this.prisma.specialOrder.update({
      where: { id },
      data: { driverStatus: 'picked_up', pickupPhotoUrl },
    });
  }

  async markDelivered(id: number, driverId: number, deliveryPhotoUrl: string) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.acceptedBy !== driverId) throw new ForbiddenException();
    if (order.driverStatus !== 'picked_up') throw new BadRequestException('Must mark as picked up first');

    return this.prisma.specialOrder.update({
      where: { id },
      data: { driverStatus: 'delivered', deliveryPhotoUrl, payrollStatus: 'pending' },
    });
  }

  async getPendingPayrolls() {
    return this.prisma.specialOrder.findMany({
      where: { payrollStatus: 'pending' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPendingPayrollCount() {
    return this.prisma.specialOrder.count({ where: { payrollStatus: 'pending' } });
  }

  async approvePayroll(id: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.payrollStatus !== 'pending') throw new BadRequestException('Not pending approval');

    await this.prisma.specialOrder.update({
      where: { id },
      data: { payrollStatus: 'approved' },
    });

    // Create SpecialOrderEarning now (approval = pay)
    const orderDate = new Date(order.date);
    const { key: weekNumber } = getPayrollWeekKey(orderDate);
    const existingEarning = await (this.prisma as any).specialOrderEarning.findUnique({
      where: { specialOrderId: id },
    });
    if (!existingEarning) {
      await (this.prisma as any).specialOrderEarning.create({
        data: {
          specialOrderId: id,
          driverId: order.acceptedBy!,
          weekNumber,
          date: orderDate,
          amount: order.price,
          routeName: order.routeName,
          stops: order.stops,
        },
      });
    }

    // Notify driver
    try {
      const approveMsg = `Your delivery for ${order.routeName} has been approved. $${order.price} added to your settlements.`;
      await this.notifService.create(order.acceptedBy!, 'Delivery Approved', approveMsg, 'payroll_approved', id).catch(() => {});
      const driver = await this.prisma.user.findFirst({
        where: { driverId: order.acceptedBy! },
        select: { pushToken: true },
      });
      if (driver?.pushToken) {
        await this.push.sendToMany([driver.pushToken], 'Delivery Approved', approveMsg, { type: 'payroll_approved', orderId: id });
      }
    } catch (_) {}

    return { success: true };
  }

  async rejectPayroll(id: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.payrollStatus !== 'pending') throw new BadRequestException('Not pending approval');

    await this.prisma.specialOrder.update({
      where: { id },
      data: { payrollStatus: 'rejected' },
    });

    // Notify driver
    try {
      const rejectMsg = `Your delivery proof for ${order.routeName} was not approved. No payment will be issued.`;
      await this.notifService.create(order.acceptedBy!, 'Delivery Rejected', rejectMsg, 'payroll_rejected', id).catch(() => {});
      const driver = await this.prisma.user.findFirst({
        where: { driverId: order.acceptedBy! },
        select: { pushToken: true },
      });
      if (driver?.pushToken) {
        await this.push.sendToMany([driver.pushToken], 'Delivery Rejected', rejectMsg, { type: 'payroll_rejected', orderId: id });
      }
    } catch (_) {}

    return { success: true };
  }

  async cancelOrder(id: number, reason: string, tonuAmount: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'accepted') throw new BadRequestException('This order cannot be cancelled (status: ' + order.status + ')');
    if (order.driverStatus === 'delivered') throw new BadRequestException('Cannot cancel an order that has already been delivered');

    const { key: weekNumber } = getPayrollWeekKey(new Date());
    const today = new Date().toISOString().slice(0, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.specialOrder.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      if (tonuAmount > 0 && order.acceptedBy) {
        await tx.payrollAdjustment.create({
          data: {
            driverId: order.acceptedBy,
            weekNumber,
            date: today,
            type: 'bonus',
            amount: tonuAmount,
            reason: `Tonu — cancelled order: ${order.routeName}${reason ? ` (${reason})` : ''}`,
          },
        });
      }
    });

    // Recalculate payroll bonus totals so the tonu appears in the payroll table
    if (tonuAmount > 0 && order.acceptedBy) {
      try {
        const allAdj = await this.prisma.payrollAdjustment.findMany({
          where: { driverId: order.acceptedBy, weekNumber },
        });
        const totalDeduction = Number(
          allAdj.filter((a) => a.type === 'deduction').reduce((s, a) => s + a.amount, 0).toFixed(2),
        );
        const totalBonus = Number(
          allAdj.filter((a) => a.type === 'bonus').reduce((s, a) => s + a.amount, 0).toFixed(2),
        );

        const existing = await this.prisma.payroll.findUnique({
          where: { driverId_weekNumber: { driverId: order.acceptedBy, weekNumber } },
        });

        if (existing) {
          const netPay = Number(((existing as any).amount - totalDeduction + totalBonus).toFixed(2));
          await this.prisma.payroll.update({
            where: { driverId_weekNumber: { driverId: order.acceptedBy, weekNumber } },
            data: { totalBonus, totalDeduction, netPay } as any,
          });
        } else {
          // No regular payroll record this week — create a stub so the tonu is visible
          const { periodStart, periodEnd } = getPayrollWeekKey(new Date());
          const payPeriod = `${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`;
          const driverUser = await this.prisma.user.findFirst({
            where: { driverId: order.acceptedBy },
            select: { fullName: true },
          });
          await this.prisma.payroll.create({
            data: {
              driverId: order.acceptedBy,
              driverName: driverUser?.fullName || (order as any).acceptedByName || '',
              weekNumber,
              payPeriod,
              salaryType: 'Regular',
              totalDeliveries: 0,
              stopsCompleted: 0,
              amount: 0,
              totalDeduction,
              totalBonus,
              netPay: totalBonus - totalDeduction,
              zipCode: null,
              zipBreakdown: Prisma.JsonNull,
            } as any,
          });
        }
      } catch (_) {}
    }

    if (order.acceptedBy) {
      try {
        const cancelMsg = tonuAmount > 0
          ? `${order.routeName} has been cancelled. $${tonuAmount} tonu added to your settlements.`
          : `${order.routeName} has been cancelled.`;
        await this.notifService.create(order.acceptedBy, 'Order Cancelled', cancelMsg, 'order_cancelled', id).catch(() => {});
        const driver = await this.prisma.user.findFirst({
          where: { driverId: order.acceptedBy },
          select: { pushToken: true },
        });
        if (driver?.pushToken) {
          await this.push.sendToMany([driver.pushToken], 'Order Cancelled', cancelMsg, { type: 'order_cancelled', orderId: id });
        }
      } catch (_) {}
    }

    return { success: true };
  }

  async reject(id: number, driverId: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'accepted') throw new BadRequestException('Order already accepted');

    const currentRejected = (order.rejectedBy as number[]) || [];
    if (currentRejected.includes(driverId)) return order;

    const rejectedBy = [...currentRejected, driverId];

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
