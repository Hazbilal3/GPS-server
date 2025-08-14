import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Delivery } from './deliveries.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private deliveryRepo: Repository<Delivery>,
  ) {}

  // src/deliveries/deliveries.service.ts
  async getByDriverAndDate(driverId: number, date: string) {
    return this.deliveryRepo.find({
      where: {
        driver: { id: driverId },
        timestamp: Between(
          new Date(`${date} 00:00:00`),
          new Date(`${date} 23:59:59`),
        ),
      },
      relations: ['driver'],
    });
  }
}
