import { IsOptional, IsNumber, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsOptional()
  @Type(() => Number) // Add this to properly convert query params
  @IsNumber()
  driverId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number) // Add this
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number) // Add this
  @IsInt()
  @Min(1)
  limit?: number = 10;
}