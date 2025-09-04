import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseIntPipe,
  BadRequestException,
  Delete,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('driverId', ParseIntPipe) driverId: number,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.uploadService.processExcel(file, driverId);
  }

  @Delete()
  async deleteByDriverAndDate(
    @Query('driverId', ParseIntPipe) driverId: number,
    @Query('date') date: string, // YYYY-MM-DD (UTC)
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format (UTC day)');
    }
    return this.uploadService.deleteByDriverAndDate(driverId, date);
  }
}
