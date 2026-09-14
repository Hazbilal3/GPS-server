import { Module } from '@nestjs/common';
import { AvailableDriversService } from './available-drivers.service';
import { AvailableDriversController } from './available-drivers.controller';

@Module({
  controllers: [AvailableDriversController],
  providers: [AvailableDriversService],
  exports: [AvailableDriversService],
})
export class AvailableDriversModule {}
