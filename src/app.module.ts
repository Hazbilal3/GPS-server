import { UploadService } from 'src/upload/upload.service';
import { UploadController } from './upload/upload.controller';
import { ConfigModule } from '@nestjs/config';
import { Module, ValidationPipe } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { DriverController } from './user/user.controller';
import { DriverService } from './user/user.service';
import { AirtableService } from './airtable/airtable.service';
import { AirtableController } from './airtable/airtable.controller';
import { DisputeModule } from './dispute/dispute.module';
import { SpecialOrdersModule } from './special-orders/special-orders.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { DriverDocumentsModule } from './driver-documents/driver-documents.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    AuthModule,
    DisputeModule,
    SpecialOrdersModule,
    LeaveRequestsModule,
    DriverDocumentsModule,
  ],
  controllers: [
    UploadController,
    ReportController,
    DriverController,
    AirtableController,
  ],
  providers: [
    UploadService,
    PrismaService,
    ReportService,
    DriverService,
    AirtableService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
