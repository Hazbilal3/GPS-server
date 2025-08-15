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
    return this.reportService.getUploadReport(filters);
  }

  @Get('export')
  async exportReport(@Query() filters: ReportFilterDto, @Res() res: express.Response) {
    return this.reportService.exportToCsv(filters, res);
  }
}