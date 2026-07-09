import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async broadcast(title: string, body: string, driverIds?: number[]) {
    const where = driverIds && driverIds.length > 0
      ? { driverId: { in: driverIds }, pushToken: { not: null } }
      : { pushToken: { not: null }, userRole: 2 };

    const users = await this.prisma.user.findMany({
      where: where as any,
      select: { pushToken: true },
    });

    const tokens = users.map((u: any) => u.pushToken).filter(Boolean) as string[];
    const noToken = users.length - tokens.length;
    await this.push.sendToMany(tokens, title, body);
    return { sent: tokens.length, found: users.length, noToken };
  }
}
