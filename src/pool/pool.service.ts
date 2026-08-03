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
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;max-width:600px">
        <p>Dear Driver,</p>

        <p>Thank you for applying through the <strong>CMJL Driver App</strong>.</p>

        <p>Your application has been received by <strong>Expedited Transport Services</strong>, our affiliated transportation company, which manages customer contracts and driver onboarding.</p>

        <p style="margin-top:20px">
          <strong>Your Driver ID:</strong>
          <span style="display:block;font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 20px;color:#1f6feb">${driverId}</span>
          Please keep this ID — you will need it to log in to the driver portal once your account is fully activated.
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

        <p>
          <strong>Action Required:</strong> To activate your driver account, you must complete the two onboarding steps below.
          You will receive two separate invitation emails from our trusted partners.
          Please complete each invitation <strong>within 24 hours</strong> of receiving it to avoid delays in activating your account.
        </p>

        <p style="margin-top:20px"><strong>Step 1: Gusto – Direct Deposit Setup</strong></p>
        <p>
          Gusto is our secure payroll provider. You will receive an email asking you to set up your direct deposit by entering your banking information.<br/>
          <span style="color:#64748b">Expected sender: Gusto (gusto.com)</span>
        </p>

        <p style="margin-top:20px"><strong>Step 2: Openforce – Driver Verification</strong></p>
        <p>
          Openforce manages our independent contractor verification process. Their email will guide you through submitting your driver's license, vehicle registration, and completing your enrollment.<br/>
          <span style="color:#64748b">Expected sender: Openforce (oforce.com)</span>
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

        <p><strong>Before You Begin</strong></p>
        <p>Please have the following ready:</p>
        <ul style="padding-left:20px;line-height:2">
          <li>Banking information (for Gusto)</li>
          <li>Valid driver's license</li>
          <li>Current vehicle registration</li>
        </ul>

        <p style="margin-top:20px"><strong>Important Reminders</strong></p>
        <ul style="padding-left:20px;line-height:2">
          <li>Both emails are legitimate and expected. Please do not mark them as spam.</li>
          <li>If you do not receive an email within a few hours, please check your Spam or Junk folder.</li>
          <li>The two invitations may arrive at different times. Complete each one as soon as it arrives.</li>
          <li>Each invitation must be completed within 24 hours of receipt.</li>
          <li>Your account cannot be activated until both steps have been successfully completed and approved.</li>
        </ul>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

        <p>If you have any questions or do not receive either invitation, please contact us.</p>
        <p><strong>Phone:</strong> 860-988-3887</p>

        <p style="margin-top:24px">Thank you for choosing CMJL and Expedited Transport Services. We look forward to having you on the team!</p>

        <p style="margin-top:24px">
          Sincerely,<br/>
          <strong>Expedited Transport Services</strong><br/>
          <span style="color:#64748b">In partnership with CMJL Driver App</span>
        </p>
      </div>
    `;
    const text = `Dear Driver,\n\nThank you for applying through the CMJL Driver App.\n\nYour Driver ID is: ${driverId}\n\nTo activate your account, complete two onboarding steps:\n1. Gusto (gusto.com) – Direct Deposit Setup\n2. Openforce (oforce.com) – Driver Verification\n\nComplete each invitation within 24 hours of receipt.\n\nPhone: 860-988-3887\n\nSincerely,\nExpedited Transport Services\nIn partnership with CMJL Driver App`;
    try {
      await this.mail.send(
        to,
        `Welcome to CMJL — Your Driver ID: ${driverId} & Next Steps`,
        html,
        text,
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

    let saved;
    if (existing) {
      saved = await this.prisma.driverPool.update({
        where: { userId },
        data: cardDataMap[cardType],
      });
    } else {
      saved = await this.prisma.driverPool.create({
        data: {
          userId,
          fullName: user.fullName || 'Unknown',
          email: user.email,
          phoneNumber: user.phoneNumber,
          state: user.state,
          operatingType: user.operatingType,
          status: 'draft',
          ...cardDataMap[cardType],
        },
      });
    }

    // Only promote to pending (visible to admin) when all 3 required docs are present
    if (saved.status !== 'approved' && saved.status !== 'rejected') {
      const allDocsPresent = !!(saved.insuranceDocUrl && saved.registrationDocUrl && saved.licenseDocUrl);
      const targetStatus = allDocsPresent ? 'pending' : 'draft';
      if (saved.status !== targetStatus) {
        saved = await this.prisma.driverPool.update({
          where: { userId },
          data: { status: targetStatus },
        });
      }
    }

    return saved;
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

  async finalize(userId: number) {
    const entry = await this.prisma.driverPool.findUnique({ where: { userId } });

    if (!entry) throw new BadRequestException('No documents uploaded yet. Please upload your documents first.');

    const missing: string[] = [];
    if (!entry.insuranceDocUrl)    missing.push('Insurance');
    if (!entry.registrationDocUrl) missing.push('Registration');
    if (!entry.licenseDocUrl)      missing.push("Driver's License");

    if (missing.length > 0) {
      throw new BadRequestException(
        `Please upload all required documents before submitting: ${missing.join(', ')}.`,
      );
    }

    return this.prisma.driverPool.update({
      where: { userId },
      data: { status: 'pending' },
    });
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
      w9DocUrl: entry.w9DocUrl,
      docName: entry.docName,
      docUrl: entry.docUrl,
    };
  }

  async submitW9(userId: number, docUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true, phoneNumber: true, poolStatus: true, state: true, operatingType: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.poolStatus !== 'pending' && user.poolStatus !== 'rejected') {
      throw new BadRequestException('Document submission is not allowed in this state.');
    }

    if (user.poolStatus === 'rejected') {
      await this.prisma.user.update({ where: { id: userId }, data: { poolStatus: 'pending' } });
    }

    const existing = await (this.prisma as any).driverPool.findUnique({ where: { userId } });

    if (existing) {
      return (this.prisma as any).driverPool.update({
        where: { userId },
        data: { w9DocUrl: docUrl, status: 'pending' },
      });
    } else {
      return (this.prisma as any).driverPool.create({
        data: {
          userId,
          fullName: user.fullName || 'Unknown',
          email: user.email,
          phoneNumber: user.phoneNumber,
          state: user.state,
          operatingType: user.operatingType,
          status: 'pending',
          w9DocUrl: docUrl,
        },
      });
    }
  }

  async getAllPending() {
    return this.prisma.driverPool.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAll(status?: string) {
    const entries = await this.prisma.driverPool.findMany({
      where: status ? { status } : { status: { not: 'draft' } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { vehicleSize: true } } },
    });
    return entries.map(e => ({ ...e, vehicleSize: e.user?.vehicleSize ?? null, user: undefined }));
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

    // Replace any existing DriverDocument records — use DB user.id (not business driverId)
    // so getDocuments() can find them correctly
    await this.prisma.driverDocument.deleteMany({ where: { driverId: entry.userId } });

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
          driverId: entry.userId,
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
