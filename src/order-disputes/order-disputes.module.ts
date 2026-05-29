import { Module } from '@nestjs/common';
import { OrderDisputesController } from './order-disputes.controller';
import { OrderDisputesService } from './order-disputes.service';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

@Module({
  controllers: [OrderDisputesController],
  providers: [OrderDisputesService, PrismaService, PushService],
})
export class OrderDisputesModule {}
