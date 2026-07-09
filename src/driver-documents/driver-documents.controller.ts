import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DriverDocumentsService } from './driver-documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { basename, resolve, join } from 'path';
import type { Response } from 'express';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { createS3Storage } from '../s3.storage';

const localUploadDir = join(__dirname, '../../uploads/driver-documents');
const docStorage = createS3Storage('driver-documents');

@Controller('driver-documents')
export class DriverDocumentsController {
  constructor(private service: DriverDocumentsService) {}

  @Get('file/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(localUploadDir);
    const fullPath = join(root, safeName);
    if (!fullPath.startsWith(root)) throw new ForbiddenException();
    return res.sendFile(fullPath);
  }

  @Get(':driverId')
  @UseGuards(AuthGuard)
  getDocuments(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getDocuments(driverId);
  }

  @Post(':driverId')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: docStorage }))
  uploadDocument(
    @Param('driverId', ParseIntPipe) driverId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
  ) {
    return this.service.createDocument(driverId, file, description);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  deleteDocument(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDocument(id);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard, AdminGuard)
  approveDocument(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveDocument(id);
  }
}
