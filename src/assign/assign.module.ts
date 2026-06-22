import { Module } from '@nestjs/common';
import { AssignController } from './assign.controller';
import { AssignService } from './assign.service';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';

@Module({
  controllers: [AssignController],
  providers: [AssignService, PrismaService, PushService],
})
export class AssignModule {}
