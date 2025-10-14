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
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

// Remove the local PayrollRecord interface and import the correct one from the service or shared model
import { PayrollRecord } from './upload.service';

@Controller('uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('driverId', ParseIntPipe) driverId: number,
    @Body('date') date?: string, // <-- optional YYYY-MM-DD (UTC)
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException(
          'date must be in YYYY-MM-DD format (UTC day)',
        );
      }
      const d = new Date(`${date}T00:00:00.000Z`);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Invalid date value');
      }
    }

    return this.uploadService.processExcel(file, driverId, date);
  }

  @Delete()
  async deleteByDriverAndDate(
    @Query('driverId', ParseIntPipe) driverId: number,
    @Query('date') date: string, // YYYY-MM-DD (UTC)
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'date must be in YYYY-MM-DD format (UTC day)',
      );
    }
    return this.uploadService.deleteByDriverAndDate(driverId, date);
  }

  @Get('payroll')
  async getPayroll(): Promise<PayrollRecord[]> {
    const data = await this.uploadService.getDriverPayroll();
    return data;
  }

  @Get('customroute')
  async getRoute(): Promise<any[]> {
    const data = await this.uploadService.getAirtableRoutes();
    return data;
  }
}
