import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mismatch } from '../mismatches/mismatches.entity';
import { Parser } from 'json2csv';

@Controller('report')
export class ReportController {
  constructor(
    @InjectRepository(Mismatch)
    private readonly mismatchRepo: Repository<Mismatch>
  ) {}

  @Get('mismatches')
  async exportMismatches(@Res() res: Response) {
    const mismatches = await this.mismatchRepo.find({ relations: ['delivery'] });

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
}
