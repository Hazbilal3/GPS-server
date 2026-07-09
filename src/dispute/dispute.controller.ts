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
} from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { basename, resolve, join } from 'path';
import type { Response } from 'express';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { createS3Storage, S3File } from '../s3.storage';

const localUploadDir = './uploads/disputes';
export const disputeStorage = createS3Storage('disputes');

@Controller('disputes')
export class DisputeController {
  constructor(private disputeService: DisputeService) {}

  @Get('file/:filename')
  @UseGuards(AuthGuard)
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(localUploadDir);
    const fullPath = join(root, safeName);
    if (!fullPath.startsWith(root)) throw new ForbiddenException();
    return res.sendFile(fullPath);
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('attachment', { storage: disputeStorage }))
  async create(
    @Body('driverId') driverIdRaw: any,
    @Body('driverName') driverName: string,
    @Body('title') title: string,
    @Body('content') content: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const driverId = parseInt(driverIdRaw, 10);
    const attachmentUrl = file ? ((file as S3File).location || `/disputes/file/${file.filename}`) : undefined;
    return this.disputeService.createDispute(
      driverId,
      driverName,
      title,
      content,
      attachmentUrl,
    );
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getAll() {
    return this.disputeService.getAllDisputes();
  }

  @Get('driver/:driverId')
  @UseGuards(AuthGuard)
  async getByDriver(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.disputeService.getDriverDisputes(driverId);
  }

  @Get('unseen-count')
  @UseGuards(AuthGuard, AdminGuard)
  async getUnseenCount() {
    const count = await this.disputeService.getUnseenCount();
    return { count };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.disputeService.getDisputeById(id);
  }

  @Post(':id/messages')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('attachment', { storage: disputeStorage }))
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('senderRole') senderRole: 'admin' | 'driver',
    @Body('senderName') senderName: string,
    @Body('content') content: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentUrl = file ? ((file as S3File).location || `/disputes/file/${file.filename}`) : undefined;
    return this.disputeService.addMessage(id, senderRole, senderName, content, attachmentUrl);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, AdminGuard)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'open' | 'resolved' },
  ) {
    return this.disputeService.updateDisputeStatus(id, body.status);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.disputeService.deleteDispute(id);
  }
}
