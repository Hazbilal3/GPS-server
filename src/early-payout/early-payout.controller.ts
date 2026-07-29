import { Controller, Post, Get, Patch, Param, Body, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { EarlyPayoutService } from './early-payout.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('early-payout')
export class EarlyPayoutController {
  constructor(private service: EarlyPayoutService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Req() req: any,
    @Body() body: { payrollId?: number; weekNumber: number; driverName: string; reason: string },
  ) {
    return this.service.create(req.user.driverId, body.payrollId ?? null, body.weekNumber, body.driverName, body.reason);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  async getMyRequests(@Req() req: any) {
    return this.service.getMyRequests(req.user.driverId);
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getAll() {
    return this.service.getAll();
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard, AdminGuard)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote?: string,
  ) {
    return this.service.approve(id, adminNote);
  }

  @Patch(':id/deny')
  @UseGuards(AuthGuard, AdminGuard)
  async deny(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote: string,
  ) {
    return this.service.deny(id, adminNote);
  }
}
