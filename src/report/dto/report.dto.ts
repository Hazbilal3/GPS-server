import { IsOptional, IsNumber, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(10000)
  limit?: number;

  @IsOptional()
  driverId?: string | number;

  @IsOptional()
  date?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;
}