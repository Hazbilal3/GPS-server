import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class PoolService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private async sendApprovalEmail(to: string, fullName: string, driverId: number) {
    const appName = process.env.APP_NAME || 'CMJL';
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
      await this.mail.send(
        to,
        `Your ${appName} Driver Account is Approved — Driver ID: ${driverId}`,
        html,
        `Hi ${fullName}, your driver account has been approved. Your Driver ID is: ${driverId}. Use this to log in to the driver portal.`,
      );
    } catch (err) {
      console.error('[PoolService] Failed to send approval email:', err);
    }
  }

  async submitCard(
    userId: number,
    cardType: 'insurance' | 'registration' | 'license',
    data: { number: string; expiry: string; docUrl: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true, phoneNumber: true, poolStatus: true, state: true, operatingType: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.poolStatus !== 'pending' && user.poolStatus !== 'rejected') {
      throw new BadRequestException('Document submission is not allowed in this state.');
    }

    if (user.poolStatus === 'rejected') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { poolStatus: 'pending' },
      });
    }

    const cardDataMap = {
      insurance: {
        insuranceNumber: data.number,
        insuranceExpiry: new Date(data.expiry),
        insuranceDocUrl: data.docUrl,
      },
      registration: {
        registrationNumber: data.number,
        registrationExpiry: new Date(data.expiry),
        registrationDocUrl: data.docUrl,
      },
      license: {
        licenseNumber: data.number,
        licenseExpiry: new Date(data.expiry),
        licenseDocUrl: data.docUrl,
      },
    };

    const existing = await this.prisma.driverPool.findUnique({ where: { userId } });

    if (existing) {
      return this.prisma.driverPool.update({
        where: { userId },
        data: { ...cardDataMap[cardType], status: 'pending' },
      });
    } else {
      return this.prisma.driverPool.create({
        data: {
          userId,
          fullName: user.fullName || 'Unknown',
          email: user.email,
          phoneNumber: user.phoneNumber,
          state: user.state,
          operatingType: user.operatingType,
          status: 'pending',
          ...cardDataMap[cardType],
        },
      });
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
    const entry = await this.prisma.driverPool.findUnique({ where: { userId } });
    if (!entry) {
      return { status: 'not_submitted' };
    }
    return {
      status: entry.status,
      insuranceNumber: entry.insuranceNumber,
      insuranceExpiry: entry.insuranceExpiry,
      insuranceDocUrl: entry.insuranceDocUrl,
      registrationNumber: entry.registrationNumber,
      registrationExpiry: entry.registrationExpiry,
      registrationDocUrl: entry.registrationDocUrl,
      licenseNumber: entry.licenseNumber,
      licenseExpiry: entry.licenseExpiry,
      licenseDocUrl: entry.licenseDocUrl,
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
      data: {
        driverId: assignedDriverId,
        poolStatus: 'approved',
        state: entry.state,
        operatingType: entry.operatingType,
        insuranceNumber: entry.insuranceNumber,
        insuranceExpiry: entry.insuranceExpiry,
        registrationNumber: entry.registrationNumber,
        registrationExpiry: entry.registrationExpiry,
        licenseNumber: entry.licenseNumber,
        licenseExpiry: entry.licenseExpiry,
      },
    });

    // Replace any existing DriverDocument records for this driverId (handles reused IDs / orphaned records)
    await this.prisma.driverDocument.deleteMany({ where: { driverId: assignedDriverId } });

    const docs = [
      { name: 'Insurance', url: entry.insuranceDocUrl },
      { name: 'Registration', url: entry.registrationDocUrl },
      { name: "Driver's License", url: entry.licenseDocUrl },
      ...(entry.docUrl ? [{ name: entry.docName ?? "Driver's License", url: entry.docUrl }] : []),
    ];

    for (const doc of docs) {
      if (!doc.url) continue;
      const storedName = doc.url.split('/').pop() ?? doc.name;
      await this.prisma.driverDocument.create({
        data: {
          driverId: assignedDriverId,
          fileName: storedName,
          storedName,
          description: doc.name,
          fileUrl: doc.url,
          status: 'verified',
        },
      });
    }

    // Send email with assigned driver ID
    await this.sendApprovalEmail(entry.email, entry.fullName, assignedDriverId);

    return updatedEntry;
  }

  private async sendRejectionEmail(to: string, fullName: string) {
    const appName = process.env.APP_NAME || 'CMJL';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>We have reviewed your driver verification application and unfortunately we were unable to approve it at this time.</p>
        <p>Your application has been <strong style="color:#dc2626">rejected</strong>.</p>
        <p>If you believe this is a mistake or would like more information, please contact our support team.</p>
        <p style="color:#64748b;font-size:12px">— ${appName} Team</p>
      </div>
    `;
    try {
      await this.mail.send(
        to,
        `Your ${appName} Driver Application Status`,
        html,
        `Hi ${fullName}, your driver verification application has been rejected. Please contact support for more information.`,
      );
    } catch (err) {
      console.error('[PoolService] Failed to send rejection email:', err);
    }
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

    await this.sendRejectionEmail(entry.email, entry.fullName);

    return updatedEntry;
  }
}
