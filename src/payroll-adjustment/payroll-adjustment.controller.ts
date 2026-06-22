import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayrollAdjustmentService } from './payroll-adjustment.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('payroll-adjustments')
@UseGuards(AuthGuard, AdminGuard)
export class PayrollAdjustmentController {
  constructor(private readonly service: PayrollAdjustmentService) {}

  @Post()
  add(
    @Body()
    body: {
      driverId: number;
      weekNumber: number;
      date: string;
      type: 'deduction' | 'bonus';
      amount: number;
      reason: string;
    },
  ) {
    return this.service.addAdjustment(body);
  }

  @Get()
  get(
    @Query('driverId', ParseIntPipe) driverId: number,
    @Query('weekNumber', ParseIntPipe) weekNumber: number,
  ) {
    return this.service.getAdjustments(driverId, weekNumber);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAdjustment(id);
  }
}
