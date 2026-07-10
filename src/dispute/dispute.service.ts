import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class DisputeService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  // Driver submits a new dispute
  async createDispute(driverId: number, driverName: string, title: string, content: string, attachmentUrl?: string) {
    const dispute = await this.prisma.dispute.create({
      data: {
        driverId,
        driverName,
        title,
        status: 'open',
        messages: {
          create: {
            senderRole: 'driver',
            senderName: driverName,
            content,
            attachmentUrl,
          },
        },
      },
      include: { messages: true },
    });
    return dispute;
  }

  // Get all disputes for a specific driver
  async getDriverDisputes(driverId: number) {
    return this.prisma.dispute.findMany({
      where: { driverId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Admin: get all disputes
  async getAllDisputes() {
    return this.prisma.dispute.findMany({
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Get single dispute with messages
  async getDisputeById(id: number) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);
    return dispute;
  }

  // Add a message to an existing dispute (driver or admin)
  async addMessage(disputeId: number, senderRole: 'admin' | 'driver', senderName: string, content: string, attachmentUrl?: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);

    const message = await this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderRole,
        senderName,
        content,
        attachmentUrl,
      },
    });

    // Update the dispute's updatedAt and optionally re-open it if driver replies
    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        updatedAt: new Date(),
        status: senderRole === 'driver' ? 'open' : dispute.status,
      },
    });

    // Notify driver when admin sends a message
    if (senderRole === 'admin') {
      try {
        const driver = await this.prisma.user.findFirst({
          where: { id: dispute.driverId },
          select: { pushToken: true },
        });
        if (driver?.pushToken) {
          await this.push.sendToMany(
            [driver.pushToken],
            'New message from support',
            content.length > 80 ? content.slice(0, 77) + '…' : content,
            { type: 'support_message', disputeId },
          );
        }
      } catch (_) {}
    }

    return message;
  }

  // Admin: resolve/re-open a dispute
  async updateDisputeStatus(id: number, status: 'open' | 'resolved') {
    return this.prisma.dispute.update({
      where: { id },
      data: { status },
    });
  }

  // Admin: count open (unseen) disputes
  async getUnseenCount(): Promise<number> {
    return this.prisma.dispute.count({ where: { status: 'open' } });
  }

  // Admin: delete a dispute
  async deleteDispute(id: number) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);

    return this.prisma.dispute.delete({
      where: { id },
    });
  }
}
