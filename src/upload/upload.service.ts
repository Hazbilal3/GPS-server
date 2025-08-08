/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Delivery } from '../deliveries/deliveries.entity';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { geocodeAddress, calculateDistance } from '../geocode/geo.utils';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Delivery)
    private deliveryRepo: Repository<Delivery>,
  ) {}

  async processCSV(filePath: string, driverId: number): Promise<Delivery[]> {
    const data = fs.readFileSync(filePath, 'utf-8');
    const records = await new Promise<any[]>((resolve, reject) => {
      parse(
        data,
        { columns: true, skip_empty_lines: true, trim: true },
        (err, output) => {
          if (err) reject(err);
          else resolve(output);
        },
      );
    });

    const deliveries: Delivery[] = [];

    for (const record of records) {
      const barcode = record['Barcode'];
      const address = record['Address'];
      const gpsLocation = record['Last GPS location'];

      const parsedGps = gpsLocation?.split(' ').map(Number) ?? [];
      const gps = parsedGps.length === 2 && !parsedGps.some(isNaN) ? (parsedGps as [number, number]) : null;


      const expectedCoords = await geocodeAddress(address);
      const distance =
        gps && expectedCoords ? calculateDistance(gps, expectedCoords) : null;

      const status = distance !== null && distance <= 10 ? 'Match' : 'Mismatch';
      const mapsLink =
        gps && expectedCoords
          ? `https://www.google.com/maps/dir/${gps[0]},${gps[1]}/${expectedCoords[0]},${expectedCoords[1]}`
          : null;

      const delivery = this.deliveryRepo.create({
        driverId,
        barcode,
        address,
        gpsLocation,
        expectedLat: expectedCoords?.[0],
        expectedLng: expectedCoords?.[1],
        distanceKm: distance,
        status,
        googleMapsLink: mapsLink,
        latitude: gps?.[0],
        longitude: gps?.[1],
      } as Partial<Delivery> as Partial<Delivery>);

      const savedDelivery = await this.deliveryRepo.save(delivery);
      deliveries.push(savedDelivery);
    }

    return deliveries;
  }

  async getAllDeliveries(): Promise<Delivery[]> {
    return this.deliveryRepo.find();
  }
}
