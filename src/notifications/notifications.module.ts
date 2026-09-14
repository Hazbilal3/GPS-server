import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpiryCronService } from './expiry-cron.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpiryCronService, PushService, MailService],
})
export class NotificationsModule {}
