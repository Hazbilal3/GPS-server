import { Module } from '@nestjs/common';
import { VoxiqController } from './voxiq.controller';
import { VoxiqService } from './voxiq.service';

@Module({
  controllers: [VoxiqController],
  providers: [VoxiqService],
})
export class VoxiqModule {}
