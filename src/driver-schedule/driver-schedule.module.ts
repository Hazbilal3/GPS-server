import { Module } from '@nestjs/common';
import { DriverScheduleController } from './driver-schedule.controller';
import { DriverScheduleService } from './driver-schedule.service';

@Module({
  controllers: [DriverScheduleController],
  providers: [DriverScheduleService],
})
export class DriverScheduleModule {}
