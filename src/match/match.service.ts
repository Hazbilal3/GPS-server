/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/match/match.service.ts
import { Injectable } from '@nestjs/common';
import { GeocodeService } from 'src/geocode/geocode.service';
import { getDistance } from 'geolib';
import * as fuzz from 'fuzzball';

@Injectable()
export class MatchService {
  constructor(private geocodeService: GeocodeService) {}

  async checkMatch(gps: string, manualAddress: string) {
    const [lat, lng] = gps.split(' ').map(Number);
    const reverseAddress = await this.geocodeService.reverseGeocode(lat, lng);
    const expectedCoords =
      await this.geocodeService.geocodeAddress(manualAddress);

    if (!reverseAddress || !expectedCoords) {
      return {
        status: 'Mismatch',
        distance: null,
        expected: null,
        googleMapsLink: null,
      };
    }

    const distance =
      getDistance({ latitude: lat, longitude: lng }, expectedCoords) / 1000;

    return {
      status: distance <= 10 ? 'Match' : 'Mismatch',
      distance: distance.toFixed(2),
      expected: expectedCoords,
      googleMapsLink: `https://www.google.com/maps/dir/${lat},${lng}/${expectedCoords.latitude},${expectedCoords.longitude}`,
    };
  }

  compareAddresses(
    addr1: string,
    addr2: string,
  ): { score: number; isMismatch: boolean } {
    const score = fuzz.token_sort_ratio(addr1, addr2) / 100;
    const isMismatch = score < 0.6;
    return { score, isMismatch };
  }
}
