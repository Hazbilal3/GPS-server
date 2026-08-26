import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);
  private lastMissingInfoDate: string | null = null;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private mail: MailService,
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

  // Runs every 5 minutes — expires pending orders with no accepted driver
  // 2 hours before their pickup time
  @Cron('*/5 * * * *')
  async expireUnacceptedOrders() {
    const now = new Date();

    const pending = await this.prisma.specialOrder.findMany({
      where: { status: 'pending', pickupTime: { not: null } },
      select: { id: true, date: true, pickupTime: true },
    });

    const toExpire: number[] = [];

    for (const order of pending) {
      if (!order.pickupTime || !order.date) continue;
      // date is stored at noon EST (UTC-5) so UTC date slice is always correct calendar day
      const dateStr = order.date.toISOString().slice(0, 10);
      try {
        const pickupDt = new Date(`${dateStr}T${order.pickupTime}:00-05:00`);
        if (isNaN(pickupDt.getTime())) continue;
        const expiresAt = new Date(pickupDt.getTime() - 2 * 60 * 60 * 1000);
        if (now >= expiresAt) toExpire.push(order.id);
      } catch (_) {}
    }

    if (toExpire.length === 0) return;

    await this.prisma.specialOrder.updateMany({
      where: { id: { in: toExpire }, status: 'pending' },
      data: { status: 'expired' },
    });

    this.logger.log(`Auto-expired ${toExpire.length} unaccepted order(s): [${toExpire.join(', ')}]`);
  }

  // Runs every day at 12 PM EST (UTC-5 = 17:00 UTC)
  @Cron('0 17 * * *')
  async sendMissingInfoEmails() {
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (this.lastMissingInfoDate === todayUtc) {
      this.logger.log('Missing-info email job already ran today, skipping.');
      return;
    }
    this.lastMissingInfoDate = todayUtc;
    this.logger.log('Running missing documents/profile email job...');

    const drivers = await (this.prisma.user as any).findMany({
      where: { userRole: 2, driverId: { not: null } },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        state: true,
        operatingType: true,
        salaryType: true,
      },
    });

    const allDocs = await (this.prisma as any).driverDocument.findMany({
      where: { driverId: { in: (drivers as any[]).map((d: any) => d.id) } },
      select: { driverId: true, description: true },
    });

    const docsByDriver = new Map<number, string[]>();
    for (const doc of allDocs as any[]) {
      if (!docsByDriver.has(doc.driverId)) docsByDriver.set(doc.driverId, []);
      docsByDriver.get(doc.driverId)!.push((doc.description ?? '').toLowerCase());
    }

    const appName = process.env.APP_NAME || 'CMJL';
    let emailsSent = 0;

    for (const driver of drivers as any[]) {
      if (!driver.email) continue;

      const missing: string[] = [];

      if (!driver.fullName)       missing.push('Full Name');
      if (!driver.phoneNumber)    missing.push('Phone Number');
      if (!driver.state)          missing.push('State');
      if (!driver.operatingType)  missing.push('Operating Type');
      if (!driver.salaryType)     missing.push('Salary / Pay Type');

      const docs = docsByDriver.get(driver.id) ?? [];
      if (!docs.some((d: string) => d.includes('insurance')))    missing.push('Insurance Document');
      if (!docs.some((d: string) => d.includes('registration'))) missing.push('Registration Document');
      if (!docs.some((d: string) => d.includes('license')))      missing.push('Driver\'s License Document');

      if (missing.length === 0) continue;

      const firstName = (driver.fullName ?? 'Driver').split(' ')[0];
      const listHtml = missing.map(item => `<li style="margin:4px 0">${item}</li>`).join('');
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
          <p>Hi ${firstName},</p>
          <p>This is a daily reminder that your driver profile is missing the following information or documents. Please update them as soon as possible to avoid any interruptions to your work.</p>
          <ul style="padding-left:20px;margin:12px 0">
            ${listHtml}
          </ul>
          <p>Please log in to the app and complete your profile.</p>
          <p style="color:#64748b;font-size:12px;margin-top:16px">— ${appName} Team</p>
        </div>
      `;

      await this.mail.send(
        driver.email,
        `${appName} — Action Required: Missing Profile Information`,
        html,
        `Hi ${firstName}, your profile is missing: ${missing.join(', ')}. Please log in to update.`,
      ).catch((err: any) => this.logger.error(`Failed to send missing-info email to ${driver.email}: ${err.message}`));

      emailsSent++;
    }

    this.logger.log(`Missing-info email job done: sent to ${emailsSent}/${(drivers as any[]).length} driver(s)`);
  }
}
