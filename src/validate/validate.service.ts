import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from '../deliveries/deliveries.entity';
import { Mismatch } from '../mismatches/mismatches.entity';
import { GeocodeService } from '../geocode/geocode.service';
import { MatchService } from '../match/match.service';

@Injectable()
export class ValidateService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Mismatch)
    private readonly mismatchRepo: Repository<Mismatch>,
    private readonly geocodeService: GeocodeService,
    private readonly matchService: MatchService
  ) {}

  async validateDeliveries(): Promise<Mismatch[]> {
    const mismatches: Mismatch[] = [];
    const deliveries = await this.deliveryRepo.find({ relations: ['driver'] });

    for (const delivery of deliveries) {
      if (typeof delivery.latitude !== 'number' || typeof delivery.longitude !== 'number') {
        continue;
      }
      const actualAddress = await this.geocodeService.reverseGeocode(
        delivery.latitude,
        delivery.longitude,
      );
      const { score, isMismatch } = this.matchService.compareAddresses(
        delivery.address,
        actualAddress,
      );

      if (isMismatch) {
        const mismatch = this.mismatchRepo.create({
          expected_address: delivery.address,
          actual_address: actualAddress,
          similarity_score: score,
          delivery,
        });
        mismatches.push(await this.mismatchRepo.save(mismatch));
      }
    }

    return mismatches;
  }
}