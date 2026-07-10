import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { PrismaModule } from 'src/prisma.module';
import { PushService } from '../push/push.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisputeController],
  providers: [DisputeService, PushService],
})
export class DisputeModule {}
