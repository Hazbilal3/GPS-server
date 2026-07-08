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
import { diskStorage } from 'multer';
import { extname, basename, resolve, join } from 'path';
import type { Response } from 'express';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

const uploadDir = './uploads/driver-documents';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const docStorage = diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const randomName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${randomName}${extname(file.originalname)}`);
  },
});

@Controller('driver-documents')
export class DriverDocumentsController {
  constructor(private service: DriverDocumentsService) {}

  @Get('file/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(uploadDir);
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
