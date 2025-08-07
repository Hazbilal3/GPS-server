/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Delivery } from '../deliveries/deliveries.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../drivers/drivers.entity';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
  ) {}

  async parseAndSave(fileBuffer: Buffer): Promise<Delivery[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(sheet);

    // Ensure default driver exists
    let driver = await this.driverRepo.findOneBy({
      name: 'AutoImportedDriver',
    });
    if (!driver) {
      driver = this.driverRepo.create({ name: 'AutoImportedDriver' });
      await this.driverRepo.save(driver);
    }

    const deliveries: Delivery[] = [];

    for (const row of data) {
      if (!row['Barcode']) continue;

      const [lat, lng] = (row['Last GPS location'] || '')
        .split(' ')
        .map(Number);

      const rawTimestamp = row['Last Event time'];
      const parsedTimestamp = new Date(rawTimestamp);
      const isValidDate =
        parsedTimestamp instanceof Date && !isNaN(parsedTimestamp.getTime());

      const delivery = this.deliveryRepo.create({
        barcode: String(row['Barcode']),
        sequence_number: parseInt(row['Seq No'], 10),
        address: String(row['Address']),
        event: String(row['Last Event']),
        timestamp: isValidDate ? parsedTimestamp : new Date(), // fallback to now
        latitude: lat,
        longitude: lng,
        driver,
      });

      deliveries.push(delivery);
    }

    return await this.deliveryRepo.save(deliveries);
  }
}
