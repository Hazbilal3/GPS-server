import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SpecialOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(body: {
    routeName: string;
    stops: number;
    date: string;
    price: number;
    targetType: 'specific' | 'all';
    targetDriverIds?: number[];
  }) {
    return this.prisma.specialOrder.create({
      data: {
        routeName: body.routeName,
        stops: body.stops,
        date: new Date(body.date),
        price: body.price,
        targetType: body.targetType,
        targetDriverIds: body.targetDriverIds ?? Prisma.JsonNull,
        status: 'pending',
      },
    });
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
      // Hide accepted orders from everyone else
      if (order.status !== 'pending') return false;
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

    return this.prisma.specialOrder.update({
      where: { id },
      data: { status: 'accepted', acceptedBy: driverId, acceptedByName: driverName },
    });
  }

  async remove(id: number) {
    const order = await this.prisma.specialOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.specialOrder.delete({ where: { id } });
  }
}
