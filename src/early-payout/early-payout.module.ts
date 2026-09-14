import { Module } from '@nestjs/common';
import { EarlyPayoutController } from './early-payout.controller';
import { EarlyPayoutService } from './early-payout.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [EarlyPayoutController],
  providers: [EarlyPayoutService, MailService],
})
export class EarlyPayoutModule {}
