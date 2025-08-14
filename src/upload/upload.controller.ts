// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { DeliveryService } from './upload.service';
import { AuthGuard } from '../auth/auth.guard'; // Your auth guard
import * as path from 'path';
import * as xlsx from 'xlsx';
@Controller('upload')
export class UploadController {
  constructor(private deliveryService: DeliveryService) {}

  @UseGuards(AuthGuard) // Ensure the AuthGuard is protecting this route
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = `${Date.now()}-${file.originalname}`;
          cb(null, filename);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('driverId') driverId: number,
  ) {
    const filePath = path.resolve(file.path);

    let deliveries;
    if (file.originalname.endsWith('.csv')) {
      deliveries = await this.deliveryService.processCSV(filePath, driverId);
    } else if (
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      deliveries = await this.deliveryService.processExcel(filePath, driverId);
    } else {
      return { message: 'Unsupported file type', count: 0, data: [] };
    }

    return {
      message: 'File processed',
      count: deliveries.length,
      data: deliveries,
    };
  }
}
