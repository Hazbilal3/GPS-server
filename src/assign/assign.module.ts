import { Module } from '@nestjs/common';
import { AssignController } from './assign.controller';
import { AssignService } from './assign.service';
import { PushService } from '../push/push.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AssignController],
  providers: [AssignService, PushService],
})
export class AssignModule {}
