import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

@Module({
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, PrismaService, PushService],
})
export class LeaveRequestsModule {}
