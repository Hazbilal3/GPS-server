import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { OrderDisputesService } from './order-disputes.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { basename, resolve, join } from 'path';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { createS3Storage, S3File } from '../s3.storage';

const localUploadDir = join(__dirname, '../../uploads/order-disputes');
const orderDisputeStorage = createS3Storage('order-disputes');

@Controller('order-disputes')
export class OrderDisputesController {
  constructor(private service: OrderDisputesService) {}

  @Get('file/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(localUploadDir);
    const fullPath = join(root, safeName);
    if (!fullPath.startsWith(root)) throw new ForbiddenException();
    return res.sendFile(fullPath);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: orderDisputeStorage }))
  async create(
    @Req() req: any,
    @Body('driverId') driverIdRaw: string,
    @Body('driverName') driverName: string,
    @Body('date') date: string,
    @Body('orderNumber') orderNumber: string,
    @Body('expectedLocation') expectedLocation: string,
    @Body('deliveredLocation') deliveredLocation: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file ? ((file as S3File).location || `/order-disputes/file/${file.filename}`) : undefined;
    return this.service.create({
      driverId: parseInt(driverIdRaw, 10),
      driverName,
      date,
      orderNumber,
      expectedLocation,
      deliveredLocation,
      imageUrl,
      createdByAdminId: req.user?.sub,
    });
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  getAll() {
    return this.service.getAll();
  }

  @Get('metrics/:driverId')
  @UseGuards(AuthGuard)
  async getMetrics(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Req() req: any,
  ) {
    if (req.user.role !== 1 && req.user.role !== 3 && req.user.role !== 4 && req.user.driverId !== driverId) {
      throw new ForbiddenException();
    }
    return this.service.getMetrics(driverId);
  }

  @Get('driver/:driverId')
  @UseGuards(AuthGuard)
  async getByDriver(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Req() req: any,
  ) {
    if (req.user.role !== 1 && req.user.role !== 3 && req.user.role !== 4 && req.user.driverId !== driverId) {
      throw new ForbiddenException();
    }
    return this.service.getByDriver(driverId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: orderDisputeStorage }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body('date') date?: string,
    @Body('orderNumber') orderNumber?: string,
    @Body('expectedLocation') expectedLocation?: string,
    @Body('deliveredLocation') deliveredLocation?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file ? ((file as S3File).location || `/order-disputes/file/${file.filename}`) : undefined;
    return this.service.update(id, {
      date,
      orderNumber,
      expectedLocation,
      deliveredLocation,
      imageUrl,
    });
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, AdminGuard)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { status: 'open' | 'investigating' | 'resolved_no_fault' | 'confirmed' },
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
