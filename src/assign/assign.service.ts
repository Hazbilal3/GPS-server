import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';
import * as nodemailer from 'nodemailer';

interface AssignmentRow {
  driverId: number;
  routes: string[];
}

@Injectable()
export class AssignService {
  private readonly logger = new Logger(AssignService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = (process.env.SMTP_SECURE ?? '') === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: { minVersion: 'TLSv1.2' },
    });
  }

  private get from(): string {
    const appName = process.env.APP_NAME || 'GPS';
    return (
      process.env.MAIL_FROM ||
      `"${appName}" <no-reply@${process.env.MAIL_DOMAIN || 'example.com'}>`
    );
  }

  async sendAssignments(assignments: AssignmentRow[]): Promise<void> {
    const adminEmail = 'ets.routes@gmail.com';
    const appName = process.env.APP_NAME || 'GPS';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Fetch all relevant drivers in one query
    const driverIds = assignments.map((a) => a.driverId);
    const drivers = await this.prisma.user.findMany({
      where: { driverId: { in: driverIds } },
      select: { driverId: true, fullName: true, email: true, pushToken: true },
    });
    const driverMap = new Map(drivers.map((d) => [d.driverId, d]));

    const summaryHtmlRows: string[] = [];
    const summaryTextLines: string[] = [];

    for (const { driverId, routes } of assignments) {
      const driver = driverMap.get(driverId);
      if (!driver) continue;

      const routeList = routes.join(', ');
      const routeListItems = routes
        .map((r) => `<li style="margin-bottom:6px;font-weight:600">${r}</li>`)
        .join('');

      // ── Email to driver ────────────────────────────────────────────────────
      if (driver.email) {
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#212529">
            <p>Hi <strong>${driver.fullName}</strong>,</p>
            <p>You have been assigned the following route(s) for <strong>${today}</strong>:</p>
            <ul style="margin:12px 0;padding-left:20px">${routeListItems}</ul>
            <p>Please ensure all assigned routes are completed. Contact your dispatcher if you have questions.</p>
            <p style="margin-top:28px;color:#6c757d;font-size:12px">${appName} · Route Assignment</p>
          </div>`;

        await this.transporter
          .sendMail({
            from: this.from,
            to: driver.email,
            subject: `Your Route Assignment for ${today} — ${appName}`,
            html,
            text: `Hi ${driver.fullName}, you have been assigned the following routes for ${today}: ${routeList}.`,
          })
          .catch((err) =>
            this.logger.error(`Driver email failed for ${driver.email}`, err),
          );
      }

      // ── Push notification to driver ────────────────────────────────────────
      if (driver.pushToken) {
        await this.push.sendToMany(
          [driver.pushToken],
          'Route Assigned',
          `Your routes for today: ${routeList}`,
          { type: 'route_assigned' },
        );
      }

      // Collect for admin summary
      summaryHtmlRows.push(`
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#212529">
            ${driver.fullName}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#495057">
            ${routeList}
          </td>
        </tr>`);
      summaryTextLines.push(`${driver.fullName}: ${routeList}`);
    }

    // ── Summary email to admin ─────────────────────────────────────────────
    const adminHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#212529">
        <h2 style="margin-bottom:4px;color:#212529">Daily Route Assignment Summary</h2>
        <p style="color:#6c757d;margin-top:0">${today}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f8f9fa">
              <th style="padding:10px 14px;text-align:left;border-bottom:2px solid #dee2e6;font-size:13px">Driver</th>
              <th style="padding:10px 14px;text-align:left;border-bottom:2px solid #dee2e6;font-size:13px">Assigned Routes</th>
            </tr>
          </thead>
          <tbody>${summaryHtmlRows.join('')}</tbody>
        </table>
        <p style="margin-top:28px;color:#6c757d;font-size:12px">${appName} · Route Assignment Summary</p>
      </div>`;

    await this.transporter
      .sendMail({
        from: this.from,
        to: adminEmail,
        subject: `Route Assignment Summary — ${today}`,
        html: adminHtml,
        text: `Daily Route Assignments (${today}):\n\n${summaryTextLines.join('\n')}`,
      })
      .catch((err) => this.logger.error('Admin summary email failed', err));
  }

  // ── Draft CRUD ────────────────────────────────────────────────────────────

  async createDraft(name: string, rows: { driverId: number; routes: string[] }[]) {
    return this.prisma.assignDraft.create({ data: { name, rows } });
  }

  async listDrafts() {
    return this.prisma.assignDraft.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async updateDraft(id: number, name: string, rows: { driverId: number; routes: string[] }[]) {
    return this.prisma.assignDraft.update({ where: { id }, data: { name, rows } });
  }

  async deleteDraft(id: number) {
    return this.prisma.assignDraft.delete({ where: { id } });
  }
}
