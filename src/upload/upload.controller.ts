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
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { PayrollRecord } from './upload.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('uploads')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
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
  @UseGuards(AuthGuard, AdminGuard)
  async deleteByDriverAndDate(
    @Query('driverId', ParseIntPipe) driverId: number,
    @Query('date') date: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    return this.uploadService.deleteByDriverAndDate(driverId, date);
  }

  private maskWeekly(data: any[]): any[] {
    return data.map((week) => ({
      ...week,
      subtotal: null,
      totalDeductions: week.totalDeductions,
      totalBonuses: week.totalBonuses,
      netPay: null,
      drivers: (week.drivers ?? []).map((d: any) => ({
        ...d,
        subtotal: null,
        totalDeduction: d.totalDeduction,
        totalBonus: d.totalBonus,
        netPay: null,
        zipBreakdown: [],
      })),
    }));
  }

  private maskDaily(data: any[]): any[] {
    return data.map((r) => ({
      ...r,
      subtotal: null,
      deduction: r.deduction,
      bonus: r.bonus,
      netPay: null,
    }));
  }

  @Get('payroll')
  @UseGuards(AuthGuard, AdminGuard)
  async getPayroll(@Req() req: any): Promise<any[]> {
    const data = await this.uploadService.getDriverPayroll();
    return req.user.role === 3 ? this.maskWeekly(data) : data;
  }

  @Get('payroll/daily')
  @UseGuards(AuthGuard, AdminGuard)
  async getDailyPayroll(@Req() req: any): Promise<any[]> {
    const data = await this.uploadService.getDailyPayroll();
    return req.user.role === 3 ? this.maskDaily(data) : data;
  }

  @Get('driver-kpi/:driverId')
  @UseGuards(AuthGuard)
  async getDriverKpi(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
  ) {
    if (req.user.role !== 1 && req.user.driverId !== driverId) throw new ForbiddenException();
    return this.uploadService.getDriverKpi(driverId);
  }

  @Get('payroll/daily/:driverId')
  @UseGuards(AuthGuard)
  async getDailyPayrollByDriver(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<any[]> {
    if (req.user.role !== 1 && req.user.role !== 3 && req.user.driverId !== driverId) throw new ForbiddenException();
    const data = await this.uploadService.getDailyPayroll(driverId);
    return req.user.role === 3 ? this.maskDaily(data) : data;
  }

  @Get('payroll/:driverId')
  @UseGuards(AuthGuard)
  async getPayrollByDriver(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
  ): Promise<any[]> {
    if (req.user.role !== 1 && req.user.role !== 3 && req.user.driverId !== driverId) {
      throw new ForbiddenException();
    }
    const data = await this.uploadService.getPayrollByDriver(driverId);
    return req.user.role === 3 ? this.maskWeekly(data) : data;
  }

  @Patch('payroll/deduction')
  @UseGuards(AuthGuard, AdminGuard)
  async updatePayrollDeduction(
    @Body()
    body: { driverId: number; weekNumber: number; totalDeduction: number; remarks?: string },
  ) {
    return this.uploadService.updatePayrollDeduction(body);
  }

  @Patch('payroll/bonus')
  @UseGuards(AuthGuard, AdminGuard)
  async updatePayrollBonus(
    @Body()
    body: { driverId: number; weekNumber: number; totalBonus: number; bonusRemarks?: string },
  ) {
    return this.uploadService.updatePayrollBonus(body);
  }

  @Patch('payroll/payment-status')
  @UseGuards(AuthGuard, AdminGuard)
  async updatePaymentStatus(
    @Body() body: { payrollId: number; status: string },
  ) {
    return this.uploadService.updatePaymentStatus(body.payrollId, body.status);
  }

  @Post('payroll/calculate')
  @UseGuards(AuthGuard, AdminGuard)
  async recalculateAllPayroll() {
    return this.uploadService.recalculateAllPayroll();
  }

  @Delete('payroll/week/:weekNumber')
  @UseGuards(AuthGuard, AdminGuard)
  async deletePayrollByWeek(@Param('weekNumber', ParseIntPipe) weekNumber: number) {
    return this.uploadService.deletePayrollByWeek(weekNumber);
  }

  @Get('customroute')
  @UseGuards(AuthGuard)
  async getRoute(): Promise<any[]> {
    return this.uploadService.getAirtableRoutes();
  }

  @Post('route')
  @UseGuards(AuthGuard, AdminGuard)
  async createRoute(
    @Body()
    body: {
      routeNumber?: string;
      description: string;
      ratePerStop: number;
      ratePerStopCompanyVehicle?: number;
      baseRate?: number;
      baseRateCompanyVehicle?: number;
      territory?: string;
      zone?: string;
      status?: string;
      zipCode?: string[];
      schedule?: string[];
    },
  ) {
    return this.uploadService.createRoute(body);
  }

  @Patch('route/:id')
  @UseGuards(AuthGuard, AdminGuard)
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
  @UseGuards(AuthGuard, AdminGuard)
  async deleteRoute(@Param('id', ParseIntPipe) id: number) {
    return this.uploadService.deleteRoute(id);
  }
}
