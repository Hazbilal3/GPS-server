import { UploadService } from 'src/upload/upload.service';
import { GeocodeService } from './geocode/geocode.service';
import { UploadController } from './upload/upload.controller';
import { ConfigModule } from '@nestjs/config';
import { Module, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';
import { APP_PIPE } from '@nestjs/core';
import { DriverController } from './user/user.controller';
import { DriverService } from './user/user.service';
import { AirtableService } from './airtable/airtable.service';
import { AirtableController } from './airtable/airtable.controller';

@Module({
  // eslint-disable-next-line prettier/prettier
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
  controllers: [
    UploadController,
    ReportController,
    DriverController,
    DriverController,
    AirtableController,
  ],
  providers: [
    UploadService,
    GeocodeService,
    PrismaService,
    ReportService,
    DriverService,
    AirtableService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe, // Add global validation pipe
    },
  ],
})
export class AppModule {}
