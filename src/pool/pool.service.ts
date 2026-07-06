import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PoolService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? '') === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      tls: { minVersion: 'TLSv1.2' },
    });
  }

  private async sendApprovalEmail(to: string, fullName: string, driverId: number) {
    const appName = process.env.APP_NAME || 'CMJL';
    const from =
      process.env.MAIL_FROM ||
      `"${appName} (no-reply)" <no-reply@${process.env.MAIL_DOMAIN || 'example.com'}>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>Your driver account has been <strong>approved</strong>! You can now log in to the driver portal.</p>
        <p>Your Driver ID is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;color:#1e293b">${driverId}</p>
        <p>Use this Driver ID along with your password to log in.</p>
        <p>Welcome to the team!</p>
        <p style="color:#64748b;font-size:12px">— ${appName} Team</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: `Your ${appName} Driver Account is Approved — Driver ID: ${driverId}`,
        text: `Hi ${fullName}, your driver account has been approved. Your Driver ID is: ${driverId}. Use this to log in to the driver portal.`,
        html,
      });
    } catch (err) {
      console.error('[PoolService] Failed to send approval email:', err);
    }
  }

  async submitDocument(userId: number, docUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true, phoneNumber: true, poolStatus: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.poolStatus !== 'pending' && user.poolStatus !== 'rejected') {
      throw new BadRequestException('Document submission is not allowed in this state.');
    }

    // If re-submitting after rejection, reset status back to pending
    if (user.poolStatus === 'rejected') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { poolStatus: 'pending' },
      });
    }

    const existingPoolEntry = await this.prisma.driverPool.findUnique({
      where: { userId },
    });

    if (existingPoolEntry) {
      return this.prisma.driverPool.update({
        where: { userId },
        data: { docUrl, status: 'pending' },
      });
    } else {
      return this.prisma.driverPool.create({
        data: {
          userId,
          fullName: user.fullName || 'Unknown',
          email: user.email,
          phoneNumber: user.phoneNumber,
          docName: "Driver's License",
          docUrl,
        },
      });
    }
  }

  async getMyStatus(userId: number) {
    const entry = await this.prisma.driverPool.findUnique({
      where: { userId },
    });
    if (!entry) {
      return { status: 'not_submitted', docName: null };
    }
    return {
      status: entry.status,
      docName: entry.docName,
      docUrl: entry.docUrl,
    };
  }

  async getAllPending() {
    return this.prisma.driverPool.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAll(status?: string) {
    return this.prisma.driverPool.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextDriverId(): Promise<{ nextId: number }> {
    const result = await this.prisma.user.aggregate({
      _max: { driverId: true },
    });
    const maxId = result._max.driverId ?? 100000;
    return { nextId: maxId + 1 };
  }

  async approve(id: number, assignedDriverId: number) {
    const entry = await this.prisma.driverPool.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Pool entry not found.');

    const existingDriver = await this.prisma.user.findFirst({
      where: { driverId: assignedDriverId },
    });

    if (existingDriver && existingDriver.id !== entry.userId) {
      throw new ConflictException('This Driver ID is already assigned to another user.');
    }

    const updatedEntry = await this.prisma.driverPool.update({
      where: { id },
      data: { status: 'approved', assignedDriverId },
    });

    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { driverId: assignedDriverId, poolStatus: 'approved' },
    });

    // Store the pool document as a verified DriverDocument so it appears in profile + driver directory
    const storedName = entry.docUrl.split('/').pop() ?? entry.docName;
    const existingDoc = await this.prisma.driverDocument.findFirst({
      where: { driverId: assignedDriverId, storedName },
    });
    if (!existingDoc) {
      await this.prisma.driverDocument.create({
        data: {
          driverId: assignedDriverId,
          fileName: storedName,       // actual filename with extension (used for image detection)
          storedName,
          description: entry.docName, // human-readable: "Driver's License"
          fileUrl: entry.docUrl,      // "/pool/file/:filename" — served by pool file endpoint
          status: 'verified',
        },
      });
    }

    // Send email with assigned driver ID
    await this.sendApprovalEmail(entry.email, entry.fullName, assignedDriverId);

    return updatedEntry;
  }

  async reject(id: number) {
    const entry = await this.prisma.driverPool.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Pool entry not found.');

    const updatedEntry = await this.prisma.driverPool.update({
      where: { id },
      data: { status: 'rejected' },
    });

    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { poolStatus: 'rejected' },
    });

    return updatedEntry;
  }
}
