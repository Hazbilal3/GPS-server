import { Module } from '@nestjs/common';
import { AvailableDriversService } from './available-drivers.service';
import { AvailableDriversController } from './available-drivers.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AvailableDriversController],
  providers: [AvailableDriversService, PrismaService],
  exports: [AvailableDriversService],
})
export class AvailableDriversModule {}
