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
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { PayrollRecord } from './upload.service';

@Controller('uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('driverId', ParseIntPipe) driverId: number,
    @Body('date') date?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException('date must be in YYYY-MM-DD format');
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
    @Query('date') date: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    return this.uploadService.deleteByDriverAndDate(driverId, date);
  }

  @Get('payroll')
  async getPayroll(): Promise<any[]> {
    return this.uploadService.getDriverPayroll();
  }

  @Get('payroll/daily')
  async getDailyPayroll(): Promise<any[]> {
    return this.uploadService.getDailyPayroll();
  }

  @Get('payroll/daily/:driverId')
  async getDailyPayrollByDriver(
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<any[]> {
    return this.uploadService.getDailyPayroll(driverId);
  }

  @Get('payroll/:driverId')
  async getPayrollByDriver(
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<any[]> {
    return this.uploadService.getPayrollByDriver(driverId);
  }

  @Patch('payroll/deduction')
  async updatePayrollDeduction(
    @Body()
    body: { driverId: number; weekNumber: number; totalDeduction: number },
  ) {
    return this.uploadService.updatePayrollDeduction(body);
  }

  @Patch('payroll/bonus')
  async updatePayrollBonus(
    @Body()
    body: { driverId: number; weekNumber: number; totalBonus: number },
  ) {
    return this.uploadService.updatePayrollBonus(body);
  }

  @Post('payroll/calculate')
  async recalculateAllPayroll() {
    return this.uploadService.recalculateAllPayroll();
  }

  @Get('customroute')
  async getRoute(): Promise<any[]> {
    return this.uploadService.getAirtableRoutes();
  }

  @Post('route')
  async createRoute(
    @Body()
    body: {
      routeNumber?: string;
      description: string;
      ratePerStop: number;
      ratePerStopCompanyVehicle?: number;
      baseRate?: number;
      baseRateCompanyVehicle?: number;
      zone?: string;
      status?: string;
      zipCode?: string[];
      schedule?: string[];
    },
  ) {
    return this.uploadService.createRoute(body);
  }

  @Patch('route/:id')
  async updateRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      ratePerStop?: number;
      ratePerStopCompanyVehicle?: number;
      baseRate?: number;
      baseRateCompanyVehicle?: number;
    },
  ) {
    return this.uploadService.updateRoute(id, body);
  }

  @Delete('route/:id')
  async deleteRoute(@Param('id', ParseIntPipe) id: number) {
    return this.uploadService.deleteRoute(id);
  }
}