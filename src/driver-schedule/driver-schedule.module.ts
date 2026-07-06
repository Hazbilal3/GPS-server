import { Module } from '@nestjs/common';
import { DriverScheduleController } from './driver-schedule.controller';
import { DriverScheduleService } from './driver-schedule.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DriverScheduleController],
  providers: [DriverScheduleService, PrismaService],
})
export class DriverScheduleModule {}
