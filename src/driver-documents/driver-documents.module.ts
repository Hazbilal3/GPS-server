import { Module } from '@nestjs/common';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DriverDocumentsController],
  providers: [DriverDocumentsService, PrismaService],
})
export class DriverDocumentsModule {}