import { Module } from '@nestjs/common';
import { FreightController } from './freight.controller';
import { FreightDriverController } from './freight-driver.controller';
import { FreightService } from './freight.service';
import { PrismaService } from '../prisma.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [FreightController, FreightDriverController],
  providers: [FreightService, PrismaService],
})
export class FreightModule {}
