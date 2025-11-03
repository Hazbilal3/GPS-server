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
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { Param } from '@nestjs/common';



// We get this type from the service now, which reads from the DB
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

    // This service method now handles saving uploads AND calculating payroll
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
    // This service method now handles deletion AND recalculating payroll
    return this.uploadService.deleteByDriverAndDate(driverId, date);
  }

  @Get('payroll')
  async getPayroll(): Promise<any[]> {
    // This now reads from the 'Payroll' table
    const data = await this.uploadService.getDriverPayroll();
    return data;
  }

  @Get('payroll/:driverId')
  async getPayrollByDriver(
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<any[]> {
    // This now reads from the 'Payroll' table
    const data = await this.uploadService.getPayrollByDriver(driverId);
    return data;
  }

  @Patch('payroll/deduction')
  async updatePayrollDeduction(
    @Body() body: { driverId: number; weekNumber: number; totalDeduction: number },
  ) {
    // This will now work as 'Payroll' records exist in the DB
    return this.uploadService.updatePayrollDeduction(body);
  }

  // --- NEW ENDPOINT ---
  @Post('payroll/calculate')
  async recalculateAllPayroll() {
    // Triggers the global recalculation for all drivers
    return this.uploadService.recalculateAllPayroll();
  }
  // --------------------

  @Get('customroute')
  async getRoute(): Promise<any[]> {
    // This correctly reads routes from the 'Route' table in our DB
    const data = await this.uploadService.getAirtableRoutes();
    return data;
  }
}
