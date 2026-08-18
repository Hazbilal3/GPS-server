import { UploadService } from 'src/upload/upload.service';
import { PushService } from './push/push.service';
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
import { OrderDisputesModule } from './order-disputes/order-disputes.module';
import { AssignModule } from './assign/assign.module';
import { PayrollOverrideModule } from './payroll-override/payroll-override.module';
import { PayrollAdjustmentModule } from './payroll-adjustment/payroll-adjustment.module';
import { DriverScheduleModule } from './driver-schedule/driver-schedule.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PoolModule } from './pool/pool.module';
import { EarlyPayoutModule } from './early-payout/early-payout.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';
import { DriverNotificationsModule } from './driver-notifications/driver-notifications.module';
import { AvailableDriversModule } from './available-drivers/available-drivers.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    NotificationsModule,
    DriverNotificationsModule,
    AuthModule,
    DisputeModule,
    SpecialOrdersModule,
    LeaveRequestsModule,
    DriverDocumentsModule,
    OrderDisputesModule,
    AssignModule,
    PayrollOverrideModule,
    PayrollAdjustmentModule,
    DriverScheduleModule,
    PoolModule,
    EarlyPayoutModule,
    AvailableDriversModule,
    MailModule,
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
    PushService,
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
