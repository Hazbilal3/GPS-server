// src/airtable/dto/create-driver.dto.ts
import { IsString, IsEmail, IsOptional, IsInt, IsArray, IsBoolean } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  Status: string;

  @IsString()
  phoneNumber: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsInt()
  OFIDNumber?: number;

  @IsString()
  salaryType: string;

  @IsArray()
  schedule: string[];

  @IsOptional()
  @IsString()
  dayoftheweek?: string;

  @IsOptional()
  @IsBoolean()
  driverAvailableToday?: boolean;
}
