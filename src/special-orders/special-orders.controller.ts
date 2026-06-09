import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SpecialOrdersService } from './special-orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('special-orders')
export class SpecialOrdersController {
  constructor(private service: SpecialOrdersService) {}

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  create(
    @Body()
    body: {
      routeName: string;
      stops: number;
      date: string;
      price: number;
      targetType: 'specific' | 'all';
      targetDriverIds?: number[];
    },
  ) {
    return this.service.create(body);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get('driver/:driverId')
  @UseGuards(AuthGuard)
  findForDriver(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.findForDriver(driverId);
  }

  @Patch(':id/accept')
  @UseGuards(AuthGuard)
  accept(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { driverId: number; driverName: string },
  ) {
    return this.service.accept(id, body.driverId, body.driverName);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { driverId: number },
  ) {
    return this.service.reject(id, body.driverId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
