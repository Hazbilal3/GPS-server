import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { DeliveryService } from './upload.service';
import { AuthGuard } from '../auth/auth.guard'; // Your auth guard
import { parse } from 'csv-parse';
import * as fs from 'fs';
import * as path from 'path';

@Controller('upload')
export class UploadController {
  constructor(private deliveryService: DeliveryService) {}

  @UseGuards(AuthGuard) // assuming you attach driverId to req.user
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
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req) {
    const filePath = path.resolve(file.path);
    const driverId = req.user.id;

    // Save deliveries to DB
    const deliveries = await this.deliveryService.processCSV(filePath, driverId);

    return { message: 'File processed', count: deliveries.length };
  }
}
