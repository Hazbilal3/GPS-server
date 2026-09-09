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
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#1e293b;max-width:600px">
        <p style="font-size:18px;font-weight:700;margin-bottom:4px">CMJL DRIVER APPLICATION – NEXT STEPS</p>

        <p>Congratulations! Your driver application through the CMJL app has been approved. Your Driver ID is: <strong style="font-size:16px;color:#1f6feb">${driverId}</strong></p>

        <p>There are <strong>2 final steps</strong> that must be completed before you can be fully activated and begin accepting routes.</p>

        <p>You will receive <strong>2 separate emails:</strong></p>

        <p style="margin-top:16px"><strong>1. GUSTO – Payment / Direct Deposit Setup</strong></p>
        <p style="margin-top:4px">
          You will receive an invitation from Gusto. Please complete the setup and enter your banking information for direct deposit.
          This is how your driver payments will be processed.
        </p>

        <p style="margin-top:16px"><strong>2. OPENFORCE – OnTrac Verification</strong></p>
        <p style="margin-top:4px">
          You will also receive an invitation from Openforce to complete the required OnTrac verification, including your background, driver's license, and other required information.
        </p>

        <hr style="border:none;border-top:2px solid #fbbf24;margin:24px 0"/>

        <p style="font-size:15px;font-weight:700">⚠️ IMPORTANT – PLEASE READ BEFORE COMPLETING OPENFORCE</p>
        <p>When Openforce asks:</p>
        <ul style="padding-left:20px;line-height:2">
          <li><strong>Are you a subworker?</strong> → Select <strong>YES</strong><br/>
            <span style="color:#dc2626">Selecting "No" may cause your application to be canceled.</span>
          </li>
          <li><strong>Who pays you?</strong> → Enter: <strong>Expedited Transport Services</strong></li>
        </ul>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

        <p>Please complete both Gusto and Openforce as soon as you receive the emails. Your driver account <strong>cannot be fully activated</strong> until both steps are completed and approved.</p>

        <p>If you do not see the emails, please check your <strong>Spam/Junk folder</strong> before contacting us.</p>

        <p style="margin-top:24px">
          Thank you,<br/>
          <strong>CMJL Driver Support</strong>
        </p>
      </div>
    `;
    const text = `CMJL DRIVER APPLICATION – NEXT STEPS\n\nCongratulations! Your driver application through the CMJL app has been approved. Your Driver ID is: ${driverId}\n\nThere are 2 final steps that must be completed before you can be fully activated and begin accepting routes.\n\n1. GUSTO – Payment / Direct Deposit Setup\nYou will receive an invitation from Gusto to set up your direct deposit.\n\n2. OPENFORCE – OnTrac Verification\nYou will receive an invitation from Openforce to complete the OnTrac verification.\n\n⚠️ IMPORTANT – PLEASE READ BEFORE COMPLETING OPENFORCE\n- Are you a subworker? → Select YES (selecting No may cancel your application)\n- Who pays you? → Enter: Expedited Transport Services\n\nPlease complete both as soon as you receive the emails. If you do not see them, check your Spam/Junk folder.\n\nThank you,\nCMJL Driver Support`;
    try {
      await this.mail.send(
        to,
        `CMJL Driver Application Approved — Driver ID: ${driverId}`,
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

  async checkDriverId(id: number): Promise<{ available: boolean }> {
    const existing = await this.prisma.user.findFirst({ where: { driverId: id } });
    return { available: !existing };
  }

  async toggleOpenforceInvite(id: number): Promise<{ openforceInvite: boolean }> {
    const entry = await this.prisma.driverPool.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Pool entry not found.');
    const updated = await this.prisma.driverPool.update({
      where: { id },
      data: { openforceInvite: !entry.openforceInvite },
    });
    return { openforceInvite: updated.openforceInvite };
  }

  async toggleGustoInvite(id: number): Promise<{ gustoInvite: boolean }> {
    const entry = await this.prisma.driverPool.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Pool entry not found.');
    const updated = await this.prisma.driverPool.update({
      where: { id },
      data: { gustoInvite: !entry.gustoInvite },
    });
    return { gustoInvite: updated.gustoInvite };
  }

  async approve(id: number, assignedDriverId: number, salaryType?: string, fixedSalary?: number) {
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
        salaryType: salaryType ?? null,
        fixedSalary: salaryType === 'fixed' ? (fixedSalary ?? null) : null,
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
