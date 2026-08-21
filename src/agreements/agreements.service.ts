import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgreementsService {
  constructor(private prisma: PrismaService) {}

  async signAgreements(userId: number, signatureName: string) {
    const now = new Date();
    await this.prisma.driverAgreement.upsert({
      where: { userId_agreementType: { userId, agreementType: 'TERMS_OF_USE' } },
      update: { signedAt: now, signatureName, version: '1.0' },
      create: { userId, agreementType: 'TERMS_OF_USE', signedAt: now, signatureName, version: '1.0' },
    });
    await this.prisma.driverAgreement.upsert({
      where: { userId_agreementType: { userId, agreementType: 'IC_AGREEMENT' } },
      update: { signedAt: now, signatureName, version: '1.0' },
      create: { userId, agreementType: 'IC_AGREEMENT', signedAt: now, signatureName, version: '1.0' },
    });
    return { success: true };
  }

  async getStatus(userId: number): Promise<{ agreementsSigned: boolean }> {
    const count = await this.prisma.driverAgreement.count({
      where: { userId, agreementType: { in: ['TERMS_OF_USE', 'IC_AGREEMENT'] } },
    });
    return { agreementsSigned: count >= 2 };
  }
}
