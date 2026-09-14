import { Module } from '@nestjs/common';
import { DriverNotificationsController } from './driver-notifications.controller';
import { DriverNotificationsService } from './driver-notifications.service';

@Module({
  controllers: [DriverNotificationsController],
  providers: [DriverNotificationsService],
  exports: [DriverNotificationsService],
})
export class DriverNotificationsModule {}
