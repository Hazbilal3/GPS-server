import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PayrollOverrideService } from './payroll-override.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('payroll-override')
@UseGuards(AuthGuard, AdminGuard)
export class PayrollOverrideController {
  constructor(private readonly service: PayrollOverrideService) {}

  @Post()
  applyOverride(
    @Body()
    body: {
      driverId: number;
      weekNumber: number;
      zipCode: string;
      date: string;
      newRate: number;
      changedBy: string;
    },
  ) {
    return this.service.applyOverride(body);
  }

  @Get()
  getOverrides(
    @Query('driverId', ParseIntPipe) driverId: number,
    @Query('weekNumber', ParseIntPipe) weekNumber: number,
  ) {
    return this.service.getOverrides(driverId, weekNumber);
  }
}
