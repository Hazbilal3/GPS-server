/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import axios from 'axios';
import haversineDistance from 'haversine-distance';
import { PrismaService } from 'src/prisma.service';
import { UploadRowDto } from './dto/upload.dto';
import { AirtableController } from 'src/airtable/airtable.controller';
import { AirtableService } from 'src/airtable/airtable.service';
import { Prisma } from '@prisma/client';

function parseLatLngSpaceSeparated(input: string) {
  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Invalid gpsLocation format: ${input}`);
  }
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error(`Invalid numeric values in gpsLocation: ${input}`);
  }
  return { lat, lng };
}

const US_STATE_ABBR = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DC',
  'DE',
  'FL',
  'GA',
  'HI',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
  'PR',
  'GU',
  'VI',
  'AS',
  'MP',
  'UM',
]);

function normalizeAddress(raw: string) {
  if (!raw)
    return {
      cleaned: '',
      zip: null as string | null,
      state: null as string | null,
      city: null as string | null,
    };

  let a = String(raw);

  // Remove tokens like "LOCATION-3-6621" or "LOCATION 3 6621"
  a = a.replace(/\bLOCATION[-\s]*[\w-]+\b/gi, ' ');

  a = a
    .replace(/[.]/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const zipMatch = a.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0] : null;

  const stateMatch = a.match(/\b[A-Z]{2}\b/g);
  const state = stateMatch
    ? (stateMatch.find((s) => US_STATE_ABBR.has(s.toUpperCase())) ?? null)
    : null;

  let city: string | null = null;
  if (state) {
    const cityRe = new RegExp(
      `,\\s*([A-Za-z][A-Za-z\\s.'-]+)\\s*,\\s*${state}\\b`,
    );
    const m = a.match(cityRe);
    if (m && m[1]) city = m[1].trim();
  } else {
    const m = a.match(/,\s*([A-Za-z][A-Za-z\s.'-]+)\s*$/);
    if (m && m[1]) city = m[1].trim();
  }

  if (state) a = a.replace(new RegExp(`\\s${state}\\b`), `, ${state}`);
  if (zip) a = a.replace(new RegExp(`\\s*${zip}\\b`), ` ${zip}`);

  a = a.replace(/,\s*,/g, ', ').trim();

  return { cleaned: a, zip, state, city };
}

function componentsFilter(zip?: string | null, state?: string | null) {
  const parts = ['country:US'];
  if (zip) parts.push(`postal_code:${zip}`);
  if (state) parts.push(`administrative_area:${state}`);
  return parts.join('|');
}

function pickBestGeocodeResult(
  results: any[],
  zip?: string | null,
  state?: string | null,
  city?: string | null,
) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const hasZip = (r: any) => zip && r.formatted_address?.includes(zip);
  const hasState = (r: any) =>
    state && new RegExp(`\\b${state}\\b`).test(r.formatted_address || '');
  const hasCity = (r: any) =>
    city &&
    new RegExp(
      `\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(r.formatted_address || '');
  const isStreety = (r: any) =>
    (r.types || []).includes('street_address') ||
    (r.types || []).includes('premise');

  const scored = results.map((r: any) => {
    let score = 0;
    if (hasZip(r)) score += 100;
    if (hasState(r)) score += 50;
    if (hasCity(r)) score += 40;
    if (isStreety(r)) score += 25;
    score += Math.max(0, 20 - (r.formatted_address?.length || 0) / 10);
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].r;
}

type SmartGeo = {
  lat: number;
  lng: number;
  formattedAddress: string;
  partialMatch: boolean;
  source: 'geocode' | 'places_find' | 'places_text';
};

async function geocodeSmart(
  addressRaw: string,
  opts?: { gpsBias?: { lat: number; lng: number } },
): Promise<SmartGeo | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Missing GOOGLE_MAPS_API_KEY');

  const { cleaned, zip, state, city } = normalizeAddress(addressRaw);
  const allowGpsBias = !zip && !state && !!opts?.gpsBias;

  try {
    const gcParams: any = { address: cleaned, key, region: 'us' };
    const comp = componentsFilter(zip, state);
    if (comp) gcParams.components = comp;

    const geoRes = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: gcParams,
      },
    );

    const { results, status } = geoRes.data || {};
    if (status === 'OK' && results?.length) {
      const best =
        pickBestGeocodeResult(results, zip, state, city) || results[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        formattedAddress: best.formatted_address,
        partialMatch: Boolean(best.partial_match),
        source: 'geocode',
      };
    }
  } catch {}

  try {
    const findParams: any = {
      input: cleaned,
      inputtype: 'textquery',
      fields: 'geometry,formatted_address,place_id',
      region: 'us',
      key,
    };
    if (allowGpsBias) {
      const { lat, lng } = opts!.gpsBias!;
      findParams.locationbias = `circle:50000@${lat},${lng}`;
    }
    const findRes = await axios.get(
      'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
      { params: findParams },
    );
    const cand = findRes.data?.candidates || [];
    if (cand.length) {
      const best = cand[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        formattedAddress: best.formatted_address,
        partialMatch: false,
        source: 'places_find',
      };
    }
  } catch {}

  try {
    const txtParams: any = {
      query: cleaned + (zip ? ` ${zip}` : '') + (state ? ` ${state}` : ''),
      region: 'us',
      key,
    };
    if (allowGpsBias) {
      const { lat, lng } = opts!.gpsBias!;
      txtParams.location = `${lat},${lng}`;
      txtParams.radius = 50000; // 50km bias
    }
    const txtRes = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params: txtParams },
    );
    const results = txtRes.data?.results || [];
    if (results.length) {
      const r = results[0];
      return {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formattedAddress: r.formatted_address,
        partialMatch: false,
        source: 'places_text',
      };
    }
  } catch {}

  return null;
}

function utcStartOfDay(yyyyMmDd: string) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function zipFilter(address: string): string | null {
  if (!address) return null;
  const match = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return match ? match[0] : null;
}

function groupUploadsByWeek(uploads: any[]): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const upload of uploads) {
    const date = new Date(upload.createdAt);
    const week = getISOWeek(date);
    if (!result[week]) result[week] = [];
    result[week].push(upload);
  }
  return result;
}

function getISOWeek(date: Date): number {
  const tempDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

function getWeekDateRange(weekNumber: number): string {
  const year = new Date().getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const start = new Date(firstDayOfYear.getTime() + daysOffset * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return `${start.toISOString().slice(0, 10)} - ${end.toISOString().slice(0, 10)}`;
}

export interface PayrollRecord {
  driverId: number | null;
  driverName: string;
  zipCode: string;
  address?: string;
  weekNumber?: number;
  payPeriod?: string;
  salaryType?: string;
  stopsCompleted: number;
  totalDeliveries: number;
  stopRate: number;
  rate?: number;
  amount: number;
  zipBreakdown?: { zip: string; stops: number; rate: number; amount: number }[];
  createdAt?: Date;
}

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private airtable: AirtableService,
  ) {}

  async processExcel(
    file: Express.Multer.File,
    driverId: number,
    date?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { driverId } });
    if (!user)
      throw new NotFoundException(`Driver with ID ${driverId} not found`);

    const fkValue = user.driverId;

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheet = XLSX.utils.sheet_to_json(worksheet);

    const uploads: UploadRowDto[] = [];

    const createdAtOverride = date ? utcStartOfDay(date) : undefined;

    return this.prisma.$transaction(
      async (prisma) => {
        for (const row of sheet as any[]) {
          let barcodeVal = row['Barcode'];
          if (typeof barcodeVal === 'number') {
            barcodeVal = barcodeVal.toFixed(0);
          }
          const barcode = String(barcodeVal);

          const addressRaw = String(row['Address']);
          const gpsLocation = String(row['Last GPS location']);
          const sequenceNo = String(row['Seq No']);
          const lastEvent = String(row['Last Event']);
          const lastEventTime = String(row['Last Event time']);
          let expectedLat: number | null = null;
          let expectedLng: number | null = null;
          let distanceKm: number | null = null;
          let status: string | null = null;
          let googleMapsLink: string | null = null;

          let gpsForBias: { lat: number; lng: number } | null = null;
          if (gpsLocation && String(gpsLocation).trim()) {
            try {
              gpsForBias = parseLatLngSpaceSeparated(gpsLocation);
            } catch {
              gpsForBias = null;
            }
          }

          if (addressRaw && String(addressRaw).trim().length > 0) {
            try {
              const geo = await geocodeSmart(addressRaw, {
                gpsBias: gpsForBias || undefined,
              });
              if (geo) {
                expectedLat = geo.lat;
                expectedLng = geo.lng;
                status = geo.partialMatch ? 'partial_match' : 'geocoded';
              } else {
                status = 'geocode_zero_results';
              }
            } catch {
              status = 'geocode_error';
              expectedLat = null;
              expectedLng = null;
            }
          } else {
            status = 'no_address';
          }

          if (gpsForBias && expectedLat != null && expectedLng != null) {
            try {
              const start = { lat: gpsForBias.lat, lon: gpsForBias.lng };
              const end = {
                lat: Number(expectedLat),
                lon: Number(expectedLng),
              };

              distanceKm = haversineDistance(start, end);

              status = distanceKm > 15 ? 'mismatch' : 'match';

              googleMapsLink =
                `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}` +
                `&destination=${end.lat},${end.lon}`;
            } catch {
              if (!status) status = 'gps_parse_error';
            }
          } else if (
            !gpsLocation &&
            expectedLat != null &&
            expectedLng != null
          ) {
            status = status ?? 'geocoded';
          }

          const saved = await prisma.upload.create({
            data: {
              driverId: fkValue,
              barcode: barcode,
              sequenceNo: sequenceNo,
              lastevent: lastEvent,
              lasteventdata: lastEventTime,
              address: addressRaw,
              gpsLocation,
              expectedLat,
              expectedLng,
              distanceKm: distanceKm,
              status,
              googleMapsLink,
              ...(createdAtOverride ? { createdAt: createdAtOverride } : {}),
            },
          });

          uploads.push(saved as any);
        }
        return uploads;
      },
      { maxWait: 500000, timeout: 500000 },
    );
  }

  async deleteByDriverAndDate(driverId: number, dateStr: string) {
    const { start, end } = getUtcDayBounds(dateStr);

    const result = await this.prisma.upload.deleteMany({
      where: {
        driverId,
        createdAt: { gte: start, lt: end },
      },
    });

    return {
      driverId,
      date: dateStr,
      deleted: result.count,
    };
  }

  async getDriverPayroll(): Promise<PayrollRecord[]> {
    const [airtableDrivers, airtableRoutes] = await Promise.all([
      this.getAirtableDrivers(),
      this.getAirtableRoutes(),
    ]);

    console.log('✅ Sample route:', airtableRoutes[0]);

    const dbDrivers = await this.prisma.user.findMany({
      select: { driverId: true, fullName: true },
    });

    const uploads = await this.prisma.upload.findMany({
      select: {
        address: true,
        driverId: true,
        lastevent: true,
        createdAt: true,
      },
    });

    const payrollData: PayrollRecord[] = [];

    // --- helpers ---
    const normalizeZip = (zip?: string): string | null => {
      if (!zip) return null;
      const match = zip.match(/\d{4,5}/); // match 4 or 5 digits
      if (!match) return null;
      let z = match[0];
      if (z.length === 4) z = '0' + z; // pad leading zero if missing
      return z;
    };

    const extractRouteZips = (route: any): string[] => {
      if (!route.zipCode) return [];
      const raw = Array.isArray(route.zipCode)
        ? route.zipCode
        : String(route.zipCode).split(/[, ]+/);
      return raw
        .map((z) => normalizeZip(String(z)))
        .filter(Boolean) as string[];
    };

    // --- main loop ---
    for (const driver of dbDrivers) {
      const driverId = driver.driverId;
      const driverName = driver.fullName;

      const airtableDriver = airtableDrivers.find(
        (d) => d['OFID Number'] === driverId,
      );
      if (!airtableDriver) continue;

      const isCompanyVehicle = (airtableDriver.SalaryType || '')
        .toLowerCase()
        .includes('company');

      const driverUploads = uploads.filter(
        (u) =>
          u.driverId === driverId && u.lastevent?.toLowerCase() === 'delivered',
      );
      if (driverUploads.length === 0) continue;

      const uploadsByWeek = groupUploadsByWeek(driverUploads);

      for (const [weekNumber, weekUploads] of Object.entries(uploadsByWeek)) {
        const totalStops = weekUploads.length;

        const uploadsByZip: Record<string, number> = {};
        for (const upload of weekUploads) {
          const zip = normalizeZip(zipFilter(upload.address) || undefined);
          if (!zip) continue;
          uploadsByZip[zip] = (uploadsByZip[zip] || 0) + 1;
        }

        let totalAmount = 0;
        const zipBreakdown: {
          zip: string;
          stops: number;
          rate: number;
          amount: number;
          matched: boolean;
        }[] = [];

        for (const [zip, stopCount] of Object.entries(uploadsByZip)) {
          const route = airtableRoutes.find((r) => {
            const routeZips = extractRouteZips(r);
            return routeZips.includes(zip);
          });

          let rate = 0;
          let amount = 0;
          let matched = false;

          if (route) {
            // ✅ Exact match found
            rate = isCompanyVehicle
              ? Number(route.ratePerStopCompanyVehicle) || 0
              : Number(route.ratePerStop) || 0;
            matched = true;
          } else {
            // ⚠️ No direct match — try fallback strategy

            // 1️⃣ Try to find nearby route (same first 3 digits)
            const prefix = zip.slice(0, 3);
            const nearbyRoute = airtableRoutes.find((r) => {
              const routeZips = extractRouteZips(r);
              return routeZips.some((z) => z.startsWith(prefix));
            });

            if (nearbyRoute) {
              rate = isCompanyVehicle
                ? Number(nearbyRoute.ratePerStopCompanyVehicle) || 0
                : Number(nearbyRoute.ratePerStop) || 0;
              console.warn(
                `⚠️ Used nearby ZIP match for ${zip} → ${extractRouteZips(nearbyRoute).join(', ')}`,
              );
            } else {
              // 2️⃣ No nearby match — use global average
              const avgRate =
                airtableRoutes.reduce(
                  (acc, r) =>
                    acc +
                    (isCompanyVehicle
                      ? Number(r.ratePerStopCompanyVehicle) || 0
                      : Number(r.ratePerStop) || 0),
                  0,
                ) / (airtableRoutes.length || 1);
              rate = Number(avgRate.toFixed(2));
              console.warn(`⚠️ Used average rate for ZIP ${zip}: ${rate}`);
            }
          }

          amount = stopCount * rate;
          totalAmount += amount;

          zipBreakdown.push({
            zip,
            stops: stopCount,
            rate: Number(rate.toFixed(2)),
            amount: Number(amount.toFixed(2)),
            matched,
          });
        }

        payrollData.push({
          driverId,
          driverName: String(driverName),
          weekNumber: Number(weekNumber),
          payPeriod: getWeekDateRange(Number(weekNumber)),
          salaryType: airtableDriver.SalaryType,
          zipCode: Object.keys(uploadsByZip).join(', '),
          totalDeliveries: totalStops,
          stopsCompleted: totalStops,
          stopRate:
            zipBreakdown.length > 0 ? totalStops * zipBreakdown[0].rate : 0,
          amount: Number(totalAmount.toFixed(2)),
          zipBreakdown,
        });
      }
    }

    return payrollData;
  }

  private async getAirtableDrivers(): Promise<any[]> {
    const airtableResponse = await this.airtable.Drivers();
    return airtableResponse;
  }

  private async getAirtablePayrolls(): Promise<any[]> {
    const airtableResponse = await this.airtable.PayRolls();

    return airtableResponse;
  }
  async getAirtableRoutes(): Promise<any[]> {
    // 1️⃣ If customroutes inserts data, just wait for it
    const routes = await this.prisma.route.findMany();

    // 3️⃣ Return the actual data
    return routes;
  }
}

function getUtcDayBounds(yyyyMmDd: string) {
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const end = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (isNaN(start.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return { start, end };
}
