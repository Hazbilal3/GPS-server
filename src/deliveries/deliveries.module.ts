// src/deliveries/deliveries.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './deliveries.entity';
import { DeliveriesService } from './deliveries.service';

@Module({
  imports: [TypeOrmModule.forFeature([Delivery])],
  providers: [DeliveriesService], 
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
