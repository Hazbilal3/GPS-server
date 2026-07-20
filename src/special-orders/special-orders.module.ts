import { Module } from '@nestjs/common';
import { SpecialOrdersController } from './special-orders.controller';
import { SpecialOrdersService } from './special-orders.service';
import { PrismaService } from '../prisma.service';
import { PushService } from '../push/push.service';
import { DriverNotificationsModule } from '../driver-notifications/driver-notifications.module';

@Module({
  imports: [DriverNotificationsModule],
  controllers: [SpecialOrdersController],
  providers: [SpecialOrdersService, PrismaService, PushService],
})
export class SpecialOrdersModule {}
