import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AvailableDriversService } from './available-drivers.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('available-drivers')
export class AvailableDriversController {
  constructor(private service: AvailableDriversService) {}

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  getAll() {
    return this.service.getAll();
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  saveAll(@Body() body: { driverIds: number[] }) {
    return this.service.saveAll(body.driverIds ?? []);
  }
}
