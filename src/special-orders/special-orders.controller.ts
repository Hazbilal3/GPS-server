import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SpecialOrdersService } from './special-orders.service';

@Controller('special-orders')
export class SpecialOrdersController {
  constructor(private service: SpecialOrdersService) {}

  // Admin: create order
  @Post()
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

  // Admin: get all orders
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Driver: get available orders
  @Get('driver/:driverId')
  findForDriver(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.findForDriver(driverId);
  }

  // Driver: accept order
  @Patch(':id/accept')
  accept(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { driverId: number; driverName: string },
  ) {
    return this.service.accept(id, body.driverId, body.driverName);
  }

  // Admin: delete order
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
