import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { DriverScheduleService } from './driver-schedule.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('driver-schedule')
export class DriverScheduleController {
  constructor(private service: DriverScheduleService) {}

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  getWeekSchedule(@Query('weekStart') weekStart: string) {
    return this.service.getWeekSchedule(weekStart ?? '');
  }

  @Get('month')
  @UseGuards(AuthGuard, AdminGuard)
  getMonthSchedule(@Query('year') year: string, @Query('month') month: string) {
    return this.service.getMonthSchedule(Number(year), Number(month));
  }

  @Post('bulk')
  @UseGuards(AuthGuard, AdminGuard)
  saveWeekSchedule(
    @Body()
    body: {
      entries: { driverId: number; driverName: string; date: string; status: string }[];
      weekDates: string[];
    },
  ) {
    return this.service.saveWeekSchedule(body.entries ?? [], body.weekDates ?? []);
  }
}
