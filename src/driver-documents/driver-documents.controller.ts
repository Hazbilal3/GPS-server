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
} from '@nestjs/common';
import { DriverDocumentsService } from './driver-documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import * as fs from 'fs';

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
    return res.sendFile(filename, { root: './uploads/driver-documents' });
  }

  @Get(':driverId')
  getDocuments(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.service.getDocuments(driverId);
  }

  @Post(':driverId')
  @UseInterceptors(FileInterceptor('file', { storage: docStorage }))
  uploadDocument(
    @Param('driverId', ParseIntPipe) driverId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description: string,
  ) {
    return this.service.createDocument(driverId, file, description);
  }

  @Delete(':id')
  deleteDocument(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDocument(id);
  }

  @Patch(':id/approve')
  approveDocument(@Param('id', ParseIntPipe) id: number) {
    return this.service.approveDocument(id);
  }
}