import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mismatch } from '../mismatches/mismatches.entity';
import { Parser } from 'json2csv';

@Controller('report')
export class ReportController {
  constructor(
    @InjectRepository(Mismatch)
    private readonly mismatchRepo: Repository<Mismatch>,
  ) {}

  @Get('mismatches')
  async exportMismatches(@Res() res: Response) {
    const mismatches = await this.mismatchRepo.find({
      relations: ['delivery'],
    });

    const data = mismatches.map((m) => ({
      expected_address: m.expected_address,
      actual_address: m.actual_address,
      similarity_score: m.similarity_score,
      delivery_id: m.delivery?.id ?? null,
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment('mismatches.csv');
    res.send(csv);
  }

  @Get()
  async getReports(
    @Res() res: Response,
    @Query('driver_id') driverId?: number,
    @Query('date') date?: string,
  ) {
    let query = this.mismatchRepo
      .createQueryBuilder('mismatch')
      .leftJoinAndSelect('mismatch.delivery', 'delivery');
    if (driverId)
      query = query.andWhere('delivery.driverId = :driverId', { driverId });
    if (date)
      query = query.andWhere('DATE(delivery.timestamp) = :date', { date });
    const mismatches = await query.getMany();
    res.json(mismatches);
  }

  @Get('/export')
  async exportReport(
    @Res() res: Response,
    @Query('driver_id') driverId?: number,
    @Query('date') date?: string,
    @Query('type') type: 'csv' | 'pdf' = 'csv'
  ) {
    let query = this.mismatchRepo.createQueryBuilder('mismatch')
      .leftJoinAndSelect('mismatch.delivery', 'delivery');
    if (driverId) query = query.andWhere('delivery.driverId = :driverId', { driverId });
    if (date) query = query.andWhere('DATE(delivery.timestamp) = :date', { date });
    const mismatches = await query.getMany();

    const data = mismatches.map((m) => ({
      expected_address: m.expected_address,
      actual_address: m.actual_address,
      similarity_score: m.similarity_score,
      delivery_id: m.delivery?.id ?? null,
    }));

    if (type === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(data);
      res.header('Content-Type', 'text/csv');
      res.attachment('report.csv');
      return res.send(csv);
    } else {
      // PDF generation logic (use a library like pdfkit)
      res.header('Content-Type', 'application/pdf');
      res.attachment('report.pdf');
      res.send('PDF export not implemented'); // Placeholder
    }
  }
}
