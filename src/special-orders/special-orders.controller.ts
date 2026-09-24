import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpecialOrdersService } from './special-orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { uploadBufferToS3 } from '../s3.storage';

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
      description?: string;
      targetType: 'specific' | 'all';
      targetDriverIds?: number[];
      pickupAddress?: string;
      deliveryAddress?: string;
      pickupTime?: string;
      dropoffTime?: string;
      vehicleSize?: string;
      miles?: number;
      pieces?: number;
      itemWeight?: number;
      pickupPersonName?: string;
      pickupPersonPhone?: string;
      dropoffPersonName?: string;
      dropoffPersonPhone?: string;
    },
  ) {
    return this.service.create(body);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll(Number(page) || 1, Number(pageSize) || 20);
  }

  @Get('pending-payrolls')
  @UseGuards(AuthGuard, AdminGuard)
  getPendingPayrolls() {
    return this.service.getPendingPayrolls();
  }

  @Get('pending-payrolls/count')
  @UseGuards(AuthGuard, AdminGuard)
  getPendingPayrollCount() {
    return this.service.getPendingPayrollCount();
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

  @Patch(':id/pickup')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  async markPickedUp(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new ForbiddenException('Pickup photo is required');
    let pickupPhotoUrl = '';
    try {
      pickupPhotoUrl = await uploadBufferToS3('pickup-proofs', file.buffer, file.originalname, file.mimetype);
    } catch {
      throw new ForbiddenException('Failed to upload pickup photo to S3');
    }
    return this.service.markPickedUp(id, req.user.driverId, pickupPhotoUrl);
  }

  @Patch(':id/deliver')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  async markDelivered(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new ForbiddenException('Delivery photo is required');
    let photoUrl = '';
    try {
      photoUrl = await uploadBufferToS3('delivery-proofs', file.buffer, file.originalname, file.mimetype);
    } catch {
      throw new ForbiddenException('Failed to upload delivery photo to S3');
    }
    return this.service.markDelivered(id, req.user.driverId, photoUrl);
  }

  @Patch(':id/approve-payroll')
  @UseGuards(AuthGuard, AdminGuard)
  approvePayroll(@Param('id', ParseIntPipe) id: number) {
    return this.service.approvePayroll(id);
  }

  @Patch(':id/reject-payroll')
  @UseGuards(AuthGuard, AdminGuard)
  rejectPayroll(@Param('id', ParseIntPipe) id: number) {
    return this.service.rejectPayroll(id);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard, AdminGuard)
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string; tonuAmount: number },
  ) {
    return this.service.cancelOrder(id, body.reason, body.tonuAmount);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { driverId: number },
  ) {
    return this.service.reject(id, body.driverId);
  }

  @Patch(':id/view')
  @UseGuards(AuthGuard)
  view(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { driverId: number; driverName: string },
  ) {
    return this.service.view(id, body.driverId, body.driverName);
  }

  @Get(':id/engagement')
  @UseGuards(AuthGuard, AdminGuard)
  getEngagement(@Param('id', ParseIntPipe) id: number) {
    return this.service.getEngagement(id);
  }

  @Get(':id/sms-recipients')
  @UseGuards(AuthGuard, AdminGuard)
  getSmsRecipients(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSmsRecipients(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
