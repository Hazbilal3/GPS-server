import { Module } from '@nestjs/common';
import { DriverNotificationsController } from './driver-notifications.controller';
import { DriverNotificationsService } from './driver-notifications.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DriverNotificationsController],
  providers: [DriverNotificationsService, PrismaService],
  exports: [DriverNotificationsService],
})
export class DriverNotificationsModule {}
