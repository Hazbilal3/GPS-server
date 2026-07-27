import { Module } from '@nestjs/common';
import { EarlyPayoutController } from './early-payout.controller';
import { EarlyPayoutService } from './early-payout.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EarlyPayoutController],
  providers: [EarlyPayoutService, PrismaService],
})
export class EarlyPayoutModule {}
