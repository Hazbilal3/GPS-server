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
} from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as fs from 'fs';

const uploadDir = './uploads/disputes';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const disputeStorage = diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const randomName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${randomName}${extname(file.originalname)}`);
  },
});

@Controller('disputes')
export class DisputeController {
  constructor(private disputeService: DisputeService) {}

  // To serve the file
  @Get('file/:filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    return res.sendFile(filename, { root: './uploads/disputes' });
  }

  // Driver: create a new dispute
  @Post()
  @UseInterceptors(FileInterceptor('attachment', { storage: disputeStorage }))
  async create(
    @Body('driverId') driverIdRaw: any,
    @Body('driverName') driverName: string,
    @Body('title') title: string,
    @Body('content') content: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const driverId = parseInt(driverIdRaw, 10);
    const attachmentUrl = file ? `/disputes/file/${file.filename}` : undefined;
    return this.disputeService.createDispute(
      driverId,
      driverName,
      title,
      content,
      attachmentUrl,
    );
  }

  // Admin: get all disputes
  @Get()
  async getAll() {
    return this.disputeService.getAllDisputes();
  }

  // Driver: get own disputes
  @Get('driver/:driverId')
  async getByDriver(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.disputeService.getDriverDisputes(driverId);
  }

  // Both: get single dispute with messages
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.disputeService.getDisputeById(id);
  }

  // Both: add a message to a dispute thread
  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('attachment', { storage: disputeStorage }))
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('senderRole') senderRole: 'admin' | 'driver',
    @Body('senderName') senderName: string,
    @Body('content') content: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const attachmentUrl = file ? `/disputes/file/${file.filename}` : undefined;
    return this.disputeService.addMessage(id, senderRole, senderName, content, attachmentUrl);
  }

  // Admin: update dispute status
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'open' | 'resolved' },
  ) {
    return this.disputeService.updateDisputeStatus(id, body.status);
  }

  // Admin: delete a dispute
  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.disputeService.deleteDispute(id);
  }
}
