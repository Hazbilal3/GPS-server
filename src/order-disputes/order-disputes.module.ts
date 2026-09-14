import { Module } from '@nestjs/common';
import { OrderDisputesController } from './order-disputes.controller';
import { OrderDisputesService } from './order-disputes.service';
import { PushService } from '../push/push.service';

@Module({
  controllers: [OrderDisputesController],
  providers: [OrderDisputesService, PushService],
})
export class OrderDisputesModule {}
