import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private service: LeaveRequestsService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() body: { driverId: number; driverName: string; date: string; reason: string }) {
    return this.service.create(body);
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get('driver/:driverId')
  @UseGuards(AuthGuard)
  findByDriver(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.findByDriver(driverId);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, AdminGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
