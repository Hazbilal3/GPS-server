import { Module } from '@nestjs/common';
import { EarlyPayoutController } from './early-payout.controller';
import { EarlyPayoutService } from './early-payout.service';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [EarlyPayoutController],
  providers: [EarlyPayoutService, PrismaService, MailService],
})
export class EarlyPayoutModule {}
