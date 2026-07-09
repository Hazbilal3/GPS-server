import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // Runs every day at 6 AM EST (UTC-5 = 11:00 UTC)
  @Cron('0 11 * * *')
  async sendGoodMorning() {
    this.logger.log('Sending good morning notifications...');

    const drivers = await (this.prisma.user as any).findMany({
      where: { pushToken: { not: null }, userRole: 2 },
      select: { pushToken: true, fullName: true },
    });

    for (const driver of drivers as any[]) {
      const firstName = (driver.fullName ?? 'Driver').split(' ')[0];
      await this.push.sendToMany(
        [driver.pushToken],
        `Good Morning, ${firstName}!`,
        'Have a great day out there!',
      );
    }

    this.logger.log(`Good morning sent to ${drivers.length} driver(s)`);
  }

  // Runs every day at 8 AM EST (UTC-5 = 13:00 UTC; covers EST and handles EDT automatically)
  @Cron('0 13 * * *')
  async checkDocumentExpiry() {
    this.logger.log('Running document expiry check...');

    const now = new Date();
    const targets = [7, 3];

    for (const daysAhead of targets) {
      const targetDate = new Date(now);
      targetDate.setUTCDate(now.getUTCDate() + daysAhead);
      const dateStr = targetDate.toISOString().slice(0, 10);

      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

      const users = await (this.prisma.user as any).findMany({
        where: {
          pushToken: { not: null },
          userRole: 2,
          OR: [
            { insuranceExpiry:     { gte: dayStart, lte: dayEnd } },
            { registrationExpiry:  { gte: dayStart, lte: dayEnd } },
            { licenseExpiry:       { gte: dayStart, lte: dayEnd } },
          ],
        },
        select: {
          pushToken: true,
          fullName: true,
          insuranceExpiry: true,
          registrationExpiry: true,
          licenseExpiry: true,
        },
      });

      for (const user of users as any[]) {
        const expiring: string[] = [];
        if (user.insuranceExpiry) {
          const d = new Date(user.insuranceExpiry);
          if (d >= dayStart && d <= dayEnd) expiring.push('Insurance');
        }
        if (user.registrationExpiry) {
          const d = new Date(user.registrationExpiry);
          if (d >= dayStart && d <= dayEnd) expiring.push('Registration');
        }
        if (user.licenseExpiry) {
          const d = new Date(user.licenseExpiry);
          if (d >= dayStart && d <= dayEnd) expiring.push('License');
        }

        if (expiring.length > 0 && user.pushToken) {
          const docList = expiring.join(' & ');
          await this.push.sendToMany(
            [user.pushToken],
            'Document Expiring Soon',
            `Your ${docList} expires in ${daysAhead} day${daysAhead > 1 ? 's' : ''}. Please renew it.`,
          );
        }
      }

      this.logger.log(`Expiry check for +${daysAhead} days: notified ${users.length} driver(s)`);
    }
  }
}
