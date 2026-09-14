import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { PushService } from '../push/push.service';

@Module({
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, PushService],
})
export class LeaveRequestsModule {}
