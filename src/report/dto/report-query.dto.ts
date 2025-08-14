/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/report/dto/report-query.dto.ts
import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsOptional,
} from 'class-validator';

export class ReportQueryDto {
  @IsNumberString()
  @IsNotEmpty()
  driver_id: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  type?: 'csv' | 'pdf';
}
