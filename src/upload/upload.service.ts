/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from '../deliveries/deliveries.entity';
import * as xlsx from 'xlsx';
import { createReadStream, promises as fsp } from 'fs';
import { parse } from 'csv-parse';
import { geocodeAddress, calculateDistance } from '../geocode/geo.utils';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private readonly matchKm = Number(process.env.MATCH_THRESHOLD_KM ?? 10);
  private readonly geocodeConcurrency = Number(
    process.env.GEOCODE_CONCURRENCY ?? 5,
  );

  constructor(
    @InjectRepository(Delivery)
    private deliveryRepo: Repository<Delivery>,
  ) {}

  // Parses "24.861,67.001" or "24.861 67.001" or "24.861, 67.001"
  private parseGps(raw?: string): [number, number] | null {
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d.,\s-]/g, '').trim(); // keep digits, dot, comma, minus, space
    if (!cleaned) return null;
    const parts = cleaned.includes(',')
      ? cleaned.split(',')
      : cleaned.split(/\s+/);
    if (parts.length < 2) return null;
    const lat = Number(parts[0].trim());
    const lng = Number(parts[1].trim());
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? ([lat, lng] as [number, number])
      : null;
  }

  // simple concurrency gate (no external deps)
  private async withConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, idx: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    const executing = new Set<Promise<void>>();

    let i = 0;
    for (const item of items) {
      const p = (async (idx: number) => {
        const r = await worker(item, idx);
        results[idx] = r;
      })(i++);
      executing.add(p);
      p.finally(() => executing.delete(p));
      if (executing.size >= limit) await Promise.race(executing);
    }
    await Promise.all(executing);
    return results;
  }

  async processCSV(filePath: string, driverId: number): Promise<Delivery[]> {
    const deliveries: Delivery[] = [];
    const rows: any[] = [];

    // 1) Stream-parse CSV to rows[]
    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .on('error', reject)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', reject);
    });

    // 2) Process with limited concurrency
    const processed = await this.withConcurrency(
      rows,
      this.geocodeConcurrency,
      async (record, idx) => {
        try {
          const barcode = record['Barcode'];
          const address = record['Address'];
          const gpsLocation = record['Last GPS location'];

          const gps = this.parseGps(gpsLocation);

          let expectedCoords: [number, number] | null = null;
          try {
            expectedCoords = address ? await geocodeAddress(address) : null;
          } catch (e) {
            // geocode failed: keep processing; mark as mismatch/unknown later
            this.logger.warn(
              `Geocode failed for row ${idx + 1} (${address}): ${String(e)}`,
            );
          }

          const distance =
            gps && expectedCoords
              ? calculateDistance(gps, expectedCoords)
              : null;

          let status: 'Match' | 'Mismatch' | 'Insufficient Data';
          if (distance === null) status = 'Insufficient Data';
          else status = distance <= this.matchKm ? 'Match' : 'Mismatch';

          const mapsLink =
            gps && expectedCoords
              ? `https://www.google.com/maps/dir/${gps[0]},${gps[1]}/${expectedCoords[0]},${expectedCoords[1]}`
              : null;

          const entity = this.deliveryRepo.create({
            driverId,
            barcode,
            address,
            gpsLocation, // original string
            expectedLat: expectedCoords?.[0] ?? null,
            expectedLng: expectedCoords?.[1] ?? null,
            distanceKm: distance,
            status,
            googleMapsLink: mapsLink,
            latitude: gps?.[0] ?? null,
            longitude: gps?.[1] ?? null,
          } as Partial<Delivery>);

          return entity;
        } catch (err) {
          this.logger.error(`Row ${idx + 1} failed: ${String(err)}`);
          // Return a minimal "error row" if you want to store failures; otherwise return null
          return null;
        }
      },
    );

    const toSave = processed.filter(Boolean) as Delivery[];

    // 3) Save in a transaction (faster + atomic)
    const saved = await this.deliveryRepo.manager.transaction(async (trx) => {
      return await trx.save(toSave);
    });

    deliveries.push(...saved);

    // 4) Cleanup file
    fsp.unlink(filePath).catch(() => {});

    return deliveries;
  }

  async getAllDeliveries(): Promise<Delivery[]> {
    return this.deliveryRepo.find();
  }

   async processExcel(filePath: string, driverId: number): Promise<Delivery[]> {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet);

    // Use same logic as processCSV for each row
    const processed = await this.withConcurrency(
      rows,
      this.geocodeConcurrency,
      async (record, idx) => {
        try {
          const barcode = record['Barcode'];
          const address = record['Address'];
          const gpsLocation = record['Last GPS location'];

          const gps = this.parseGps(gpsLocation);

          let expectedCoords: [number, number] | null = null;
          try {
            expectedCoords = address ? await geocodeAddress(address) : null;
          } catch (e) {
            this.logger.warn(
              `Geocode failed for row ${idx + 1} (${address}): ${String(e)}`,
            );
          }

          const distance =
            gps && expectedCoords
              ? calculateDistance(gps, expectedCoords)
              : null;

          let status: 'Match' | 'Mismatch' | 'Insufficient Data';
          if (distance === null) status = 'Insufficient Data';
          else status = distance <= this.matchKm ? 'Match' : 'Mismatch';

          const mapsLink =
            gps && expectedCoords
              ? `https://www.google.com/maps/dir/${gps[0]},${gps[1]}/${expectedCoords[0]},${expectedCoords[1]}`
              : null;

          const entity = this.deliveryRepo.create({
            driverId,
            barcode,
            address,
            gpsLocation,
            expectedLat: expectedCoords?.[0] ?? null,
            expectedLng: expectedCoords?.[1] ?? null,
            distanceKm: distance,
            status,
            googleMapsLink: mapsLink,
            latitude: gps?.[0] ?? null,
            longitude: gps?.[1] ?? null,
          } as Partial<Delivery>);

          return entity;
        } catch (err) {
          this.logger.error(`Row ${idx + 1} failed: ${String(err)}`);
          return null;
        }
      },
    );

    const toSave = processed.filter(Boolean) as Delivery[];
    const saved = await this.deliveryRepo.manager.transaction(async (trx) => {
      return await trx.save(toSave);
    });

    // Cleanup file
    await fsp.unlink(filePath).catch(() => {});

    return saved;
  }
}
