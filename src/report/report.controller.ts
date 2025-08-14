// report.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportQueryDto } from './dto/report-query.dto';
import { MatchService } from '../match/match.service';
import { DeliveriesService } from 'src/deliveries/deliveries.service'; // Create if missing
import { createObjectCsvWriter } from 'csv-writer';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Controller('report')
export class ReportController {
  constructor(
    private matchService: MatchService,
    private deliveriesService: DeliveriesService,
  ) {}

  @Get()
  async getReport(@Query() query: ReportQueryDto) {
    const { driver_id, date } = query;
    const deliveries = await this.deliveriesService.getByDriverAndDate(
      Number(driver_id),
      date,
    );

    const results = await Promise.all(
      deliveries.map(async (delivery) => {
        const statusData = await this.matchService.checkMatch(
          delivery.gps,
          delivery.address,
        );
        return {
          barcode: delivery.barcode,
          address: delivery.address,
          gps: delivery.gps,
          ...statusData,
        };
      }),
    );

    return results;
  }

  @Get('/export')
  async exportReport(@Query() query: ReportQueryDto, @Res() res: Response) {
    const { driver_id, date, type } = query;

    const results = await this.getReport(query);

    const fileName = `report_${driver_id}_${date}.${type}`;
    const filePath = path.join(__dirname, '../../../', fileName);

    if (type === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: Object.keys(results[0] || {}).map((key) => ({
          id: key,
          title: key,
        })),
      });

      await csvWriter.writeRecords(results);
      return res.download(filePath, fileName);
    } else if (type === 'pdf') {
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(filePath));

      results.forEach((result, index) => {
        doc.text(`Record ${index + 1}`);
        for (const key in result) {
          doc.text(`${key}: ${result[key]}`);
        }
        doc.moveDown();
      });

      doc.end();

      doc.on('finish', () => {
        return res.download(filePath, fileName);
      });
    } else {
      throw new BadRequestException('Invalid type. Use csv or pdf.');
    }
  }
}
