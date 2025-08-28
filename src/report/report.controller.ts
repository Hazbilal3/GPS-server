import { Controller, Get, Query, Res } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportFilterDto } from './dto/report.dto';
import express from 'express';
import { ApiQuery, ApiResponse } from '@nestjs/swagger';
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}
  @Get()
  @ApiQuery({ name: 'driverId', required: false, type: Number })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Report data' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async getReport(@Query() filters: ReportFilterDto) {
    // Coerce potentially string query params to numbers with safe defaults
    const parsed: ReportFilterDto = {
      ...filters,
      driverId:
        (filters as any).driverId !== undefined &&
        (filters as any).driverId !== null
          ? Number((filters as any).driverId)
          : undefined,
      page: Number((filters as any).page) || 1,
      limit: Number((filters as any).limit) || 20,
    };
    return this.reportService.getUploadReport(parsed);
  }
  @Get('export')
  async exportReport(
    @Query() filters: ReportFilterDto,
    @Res() res: express.Response,
  ) {
    // Keep export stable as well (page/limit won’t matter for CSV, but harmless)
    const parsed: ReportFilterDto = {
      ...filters,
      driverId:
        (filters as any).driverId !== undefined &&
        (filters as any).driverId !== null
          ? Number((filters as any).driverId)
          : undefined,
      page: Number((filters as any).page) || 1,
      limit: Number((filters as any).limit) || 20,
    };
    return this.reportService.exportToCsv(parsed, res);
  }
}
