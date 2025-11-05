/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import axios from 'axios';
import haversineDistance from 'haversine-distance';
import { PrismaService } from 'src/prisma.service';
import { UploadRowDto } from './dto/upload.dto';
// Import Prisma types for transactions
import { Prisma, User } from '@prisma/client';

// ... (All helper functions from parseLatLngSpaceSeparated to getWeekDateRange are unchanged) ...
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

// --- THIS IS THE MODIFIED INTERFACE ---
// It now perfectly matches the `Payroll` model from `schema.prisma`
export interface PayrollRecord {
  driverId: number;
  driverName: string;
  zipCode: string | null; // <-- FIX: Allows null
  address?: string | null; // <-- FIX: Allows null
  weekNumber: number; // <-- FIX: Is non-nullable
  payPeriod: string | null; // <-- FIX: Allows null
  paycheck?: string;
  salaryType: string | null; // <-- FIX: Allows null
  stopsCompleted: number;
  totalDeliveries: number | null; // <-- FIX: Allows null
  rate?: number;
  amount: number;
  totalDeduction: number;
  netPay: number; // <-- FIX: Is non-nullable
  zipBreakdown?: Prisma.JsonValue;
  createdAt?: Date;
}
// ----------------------------------------

function getPaycheckDate(weekNumber) {
  // Calculate paycheck date based on week number (example: Friday of that week)
  const year = new Date().getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7;
  const weekStart = new Date(
    firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000,
  );

  // Set to Friday (5th day of the week)
  const paycheckDate = new Date(weekStart);
  paycheckDate.setDate(weekStart.getDate() + (5 - weekStart.getDay()));

  return paycheckDate.toISOString().split('T')[0]; // e.g. "2025-07-04"
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

@Injectable()
export class UploadService {
  // Add a logger for better debugging
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private prisma: PrismaService, // Note: AirtableService is no longer needed here
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
    const skipped: any[] = [];

    // const createdAtOverride = date ? utcStartOfDay(date) : undefined;
    const createdAtOverride = date ? new Date(`${date}T12:00:00Z`) : undefined;


    const transactionResult = await this.prisma.$transaction(
      async (prisma) => {
        for (const row of sheet as any[]) {
          let barcodeVal = row['Barcode'];
          if (typeof barcodeVal === 'number') {
            barcodeVal = barcodeVal.toFixed(0);
          }
          const barcode = String(barcodeVal).trim();

          const existing = await prisma.upload.findFirst({
            where: { driverId: fkValue, barcode },
          });

          if (existing) {
            skipped.push(barcode);
            continue;
          }

          const addressRaw = String(row['Address'] ?? '');
          const gpsLocation = String(row['Last GPS location'] ?? '');
          const sequenceNo = String(row['Seq No'] ?? '');
const lastEvent = String(row['Last Event'] ?? '')
  .replace(/\s+/g, ' ')  // collapse multiple spaces
  .trim()
  .toLowerCase();
            const lastEventTime = String(row['Last Event time'] ?? '');
          let expectedLat: number | null = null;
          let expectedLng: number | null = null;
          let distanceKm: number | null = null;
          let status: string | null = null;
          let googleMapsLink: string | null = null;

          let gpsForBias: { lat: number; lng: number } | null = null;
          if (gpsLocation && gpsLocation.trim()) {
            try {
              gpsForBias = parseLatLngSpaceSeparated(gpsLocation);
            } catch {
              gpsForBias = null;
            }
          }

          if (addressRaw && addressRaw.trim().length > 0) {
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
              const end = { lat: Number(expectedLat), lon: Number(expectedLng) };

              distanceKm = haversineDistance(start, end);
              status = distanceKm > 15 ? 'mismatch' : 'match';

              googleMapsLink = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${end.lat},${end.lon}`;
            } catch {
              if (!status) status = 'gps_parse_error';
            }
          } else if (!gpsLocation && expectedLat != null && expectedLng != null) {
            status = status ?? 'geocoded';
          }

          const saved = await prisma.upload.create({
            data: {
              driverId: fkValue,
              barcode,
              sequenceNo,
              lastevent: lastEvent,
              lasteventdata: lastEventTime,
              address: addressRaw,
              gpsLocation,
              expectedLat,
              expectedLng,
              distanceKm,
              status,
              googleMapsLink,
              ...(createdAtOverride ? { createdAt: createdAtOverride } : {}),
            },
          });

          uploads.push(saved as any);
        }

        // --- NEW: Calculate and save payroll within the transaction ---
        if (uploads.length > 0) {
          this.logger.log(
            `Uploads saved for driver ${driverId}. Recalculating payroll...`,
          );
          await this.calculateAndSavePayrollForDriver(driverId, user, prisma);
        } else {
          this.logger.log(
            `No new uploads for driver ${driverId}. Skipping payroll calculation.`,
          );
        }

        return {
          message:
            skipped.length > 0
              ? `Some data already exists — skipped ${skipped.length} entries`
              : 'Upload successful',
          uploadedCount: uploads.length,
          skippedCount: skipped.length,
          skippedBarcodes: skipped,
        };
      },
      { maxWait: 500000, timeout: 500000 },
    );

    return transactionResult;
  }

async deleteByDriverAndDate(driverId: number, dateStr: string) {
  const { start, end } = getUtcDayBounds(dateStr);

  // Delete uploads for that day
  const result = await this.prisma.upload.deleteMany({
    where: {
      driverId,
      createdAt: { gte: start, lt: end },
    },
  });

  const user = await this.prisma.user.findUnique({ where: { driverId } });
  if (!user) {
    this.logger.warn(`No user found for driverId ${driverId}`);
    return { driverId, date: dateStr, deleted: result.count };
  }

  // Determine ISO week number of the deleted date
  const deletedDate = new Date(`${dateStr}T00:00:00.000Z`);
  const weekNumber = getISOWeek(deletedDate);

  // Check if this driver has *any* remaining uploads in that week
  const weekStart = new Date(deletedDate);
  weekStart.setUTCDate(deletedDate.getUTCDate() - (deletedDate.getUTCDay() || 7) + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7); // Sunday

  const remainingUploads = await this.prisma.upload.count({
    where: {
      driverId,
      createdAt: { gte: weekStart, lt: weekEnd },
    },
  });

  if (remainingUploads === 0) {
    // Delete payroll for that week
    const deletedPayroll = await this.prisma.payroll.deleteMany({
      where: {
        driverId,
        weekNumber,
      },
    });

    this.logger.warn(
      `🧾 Deleted payroll record for driver ${driverId} | week ${weekNumber} because all uploads were removed.`,
    );

    return {
      driverId,
      date: dateStr,
      deletedUploads: result.count,
      deletedPayroll: deletedPayroll.count,
      message: "Uploads and payroll deleted for this week.",
    };
  } else {
    // Recalculate payroll if some uploads still exist in that week
    this.logger.log(
      `Uploads deleted for driver ${driverId}, recalculating payroll for week ${weekNumber}...`,
    );
    await this.calculateAndSavePayrollForDriver(driverId, user, this.prisma);

    return {
      driverId,
      date: dateStr,
      deletedUploads: result.count,
      message: "Uploads deleted; payroll recalculated for remaining records.",
    };
  }
}

  /**
   * NEW: This function recalculates and saves payroll for ALL drivers.
   * Triggered by the new controller endpoint.
   */
  async recalculateAllPayroll() {
    this.logger.log('Starting global payroll recalculation for all drivers...');
    const drivers = await this.prisma.user.findMany({
      where: { driverId: { not: null } },
    });
    let successCount = 0;
    let errorCount = 0;

    for (const driver of drivers) {
      try {
        await this.calculateAndSavePayrollForDriver(
          driver.driverId!,
          driver,
          this.prisma,
        );
        successCount++;
        this.logger.log(
          `Successfully recalculated payroll for driver: ${driver.fullName}`,
        );
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Failed to recalculate payroll for driver: ${driver.fullName}`,
          error.stack,
        );
      }
    }

    const message = `Global payroll recalculation complete. Success: ${successCount}, Failed: ${errorCount}`;
    this.logger.log(message);
    return { message, successCount, errorCount };
  }

  /**
   * NEW: This is the core logic, refactored into a private method.
   * It calculates payroll for a single driver and saves it to the DB.
   * Can be used within a transaction.
   */
  private async calculateAndSavePayrollForDriver(
    driverId: number,
    driver: User,
    prisma: Prisma.TransactionClient | PrismaService,
  ) {
    const driverName = driver.fullName;

    // 1. Fetch routes and driver's Airtable info
    const airtableRoutes = await this.getAirtableRoutes();

    const airtableDriver = await this.prisma.driver.findFirst({
      where: { OFIDNumber: driverId },
    });

    if (!airtableDriver) {
      this.logger.warn(
        `❌ No Airtable Driver record found for driverId ${driverId} (${driverName}). Skipping payroll.`,
      );
      return;
    }

    const salaryType = (airtableDriver.salaryType || '').toLowerCase();
    this.logger.log(`💰 ${driverName} | SalaryType: ${salaryType}`);

    // 2. Fetch uploads for this driver
// In calculateAndSavePayrollForDriver
const driverUploads = await prisma.upload.findMany({
  where: {
    driverId,
    lastevent: {
      contains: 'delivered',
      mode: 'insensitive',
    },
  },
  select: { address: true, createdAt: true },
});



    if (driverUploads.length === 0) {
      this.logger.warn(`No 'delivered' uploads found for ${driverName}.`);
      // --- FIX: We should still save a $0 payroll record if they have no uploads ---
      // This allows deductions to be applied to a $0 payroll.
      // Let's check if they have *any* payroll weeks.
      const existingPayrollWeeks = await prisma.payroll.findMany({
        where: { driverId },
        select: { weekNumber: true },
      });
      if (existingPayrollWeeks.length === 0) {
         this.logger.warn(`No uploads and no past payroll for ${driverName}. Skipping.`);
         return;
      }
      // If they have past payroll, we can assume we should continue
      // and process $0 weeks.
    }

    // 3. Group uploads by week
    const uploadsByWeek = groupUploadsByWeek(driverUploads);

    // --- Special driver constants ---
    const FIXED_RATE_DRIVER_ID = 254309;
    const FIXED_RATE_DRIVER_NAME = 'Carlos Jose Velez';
    const FIXED_DAILY_RATE = 245;

    // --- Helpers ---
    const normalizeZip = (zip?: string): string | null => {
      if (!zip) return null;
      const match = zip.match(/\d{4,5}/);
      if (!match) return null;
      let z = match[0];
      if (z.length === 4) z = '0' + z;
      return z;
    };

    const extractRouteZips = (route: any): string[] => {
      if (!route.zipCode) return [];
      const raw = Array.isArray(route.zipCode)
        ? route.zipCode
        : String(route.zipCode).split(/[, ]+/);
      return raw.map((z) => normalizeZip(String(z))).filter(Boolean) as string[];
    };

    // 4. Loop through each week and calculate
    for (const [weekNumberStr, weekUploads] of Object.entries(uploadsByWeek)) {
      const weekNumber = Number(weekNumberStr);
      const totalStops = weekUploads.length;

      // --- Count stops by ZIP ---
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
      }[] = [];

      if (
        driverId === FIXED_RATE_DRIVER_ID ||
        driverName === FIXED_RATE_DRIVER_NAME
      ) {
        // --- Special Fixed Rate Logic ---
        const uniqueDays = new Set<string>();
        for (const upload of weekUploads) {
          uniqueDays.add(upload.createdAt.toISOString().split('T')[0]);
        }
        const daysWorked = uniqueDays.size;
        totalAmount = daysWorked * FIXED_DAILY_RATE;

        zipBreakdown.push({
          zip: 'N/A', // Changed from 'N/A'
          stops: totalStops, // Using total stops for consistency
          rate: FIXED_DAILY_RATE,
          amount: totalAmount,
        });

        this.logger.log(
          `💵 FIXED RATE: ${driverName} | Days: ${daysWorked} | Rate: ${FIXED_DAILY_RATE} | Total: ${totalAmount.toFixed(2)}`,
        );
      } else {
        // --- Standard Rate Logic ---
        for (const [zip, stopCount] of Object.entries(uploadsByZip)) {
          const route = airtableRoutes.find((r) => {
            const routeZips = extractRouteZips(r);
            return routeZips.includes(zip);
          });

          let rate = 0;
          if (route) {
            if (salaryType.includes('company vehicle')) {
              rate = Number(route.ratePerStopCompanyVehicle) || 0;
            } else if (salaryType.includes('fixed')) {
              rate = Number(route.baseRate) || 0;
            } else if (salaryType.includes('regular')) {
              rate = Number(route.ratePerStop) || 0;
            } else {
              this.logger.warn(
                `⚠️ Unknown salary type '${salaryType}' for driver ${driverName}, defaulting to ratePerStop`,
              );
              rate = Number(route.ratePerStop) || 0;
            }
          } else {
            this.logger.warn(`⚠️ No exact ZIP match for ${zip}. Rate set to 0.`);
          }

          const amount = stopCount * rate;
          totalAmount += amount;

          // --- Save ZIP-level breakdown ---
          zipBreakdown.push({
            zip,
            stops: stopCount,
            rate: Number(rate.toFixed(2)),
            amount: Number(amount.toFixed(2)),
          });
        }
      }

      const finalAmount = Number(totalAmount.toFixed(2));

      // 5. --- Save to DB using upsert ---
      try {
        const existingPayroll = await prisma.payroll.findUnique({
          where: {
            driverId_weekNumber: { driverId, weekNumber },
          },
          select: { totalDeduction: true },
        });

        const totalDeduction = existingPayroll?.totalDeduction || 0;
        const netPay = finalAmount - totalDeduction;

        const payrollData = {
          driverId,
          driverName: String(driverName),
          weekNumber,
          payPeriod: getWeekDateRange(weekNumber),
          salaryType: airtableDriver.salaryType,
          zipCode: Object.keys(uploadsByZip).join(', ') || null,
          totalDeliveries: totalStops,
          stopsCompleted: totalStops,
          amount: finalAmount,
          totalDeduction,
          netPay,
          zipBreakdown: zipBreakdown.length > 0 ? zipBreakdown : Prisma.JsonNull, // Save breakdown
        };

        await prisma.payroll.upsert({
          where: { driverId_weekNumber: { driverId, weekNumber } },
          update: payrollData,
          create: payrollData,
        });

        this.logger.log(
          `✅ Upserted payroll for ${driverName} | Week ${weekNumber} | Amount: ${finalAmount}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to upsert payroll for ${driverName} | Week ${weekNumber}`,
          error.stack,
        );
      }
    }
  }

  /**
   * REWRITTEN: Get all payroll, now reads from the DB
   */
  async getDriverPayroll(): Promise<any[]> {
    // --- FIX: Added explicit select to ensure zipBreakdown is fetched ---
    const payrollData = await this.prisma.payroll.findMany({
      select: {
        id: true,
        driverId: true,
        driverName: true,
        weekNumber: true,
        payPeriod: true,
        salaryType: true,
        totalDeliveries: true,
        amount: true,
        totalDeduction: true,
        netPay: true,
        zipBreakdown: true, // <-- Explicitly select zipBreakdown
      },
      orderBy: {
        weekNumber: 'desc',
      },
    });

    // --- Group payroll by week (to match existing output format) ---
    const groupedPayroll = Object.entries(
      payrollData.reduce((acc, record) => {
        const week = record.weekNumber;
        if (typeof week !== 'number') return acc;
        if (!acc[week]) acc[week] = [];
        // The record now perfectly matches PayrollRecord, so this push is safe
        acc[week].push(record as unknown as PayrollRecord); // Cast to PayrollRecord
        return acc;
      }, {} as Record<number, PayrollRecord[]>),
    ).map(([weekNumber, records]) => ({
      weekNumber: Number(weekNumber),
      payPeriod: records[0]?.payPeriod || '',
      totalStops: records.reduce((sum, r) => sum + (r.totalDeliveries || 0), 0),
      subtotal: Number(
        records.reduce((sum, r) => sum + (r.amount || 0), 0).toFixed(2),
      ),
      totalDeductions: Number(
        records.reduce((sum, r) => sum + (r.totalDeduction || 0), 0).toFixed(2),
      ),
      netPay: Number(
        records.reduce((sum, r) => sum + (r.netPay || 0), 0).toFixed(2),
      ),
      drivers: records.map((r) => ({
        driverId: r.driverId, // Pass driverId to frontend
        driverName: r.driverName,
        salaryType: r.salaryType,
        totalStops: r.totalDeliveries,
        subtotal: r.amount,
        totalDeduction: r.totalDeduction,
        netPay: r.netPay,
        zipBreakdown: r.zipBreakdown ?? [], // <-- This line should now work
      })),
    }));

    return groupedPayroll;
  }

  /**
   * REWRITTEN: Get payroll by driver, now reads from the DB
   */
  async getPayrollByDriver(driverId: number): Promise<any[]> {
    const driverPayroll = await this.prisma.payroll.findMany({
      where: { driverId },
      orderBy: {
        weekNumber: 'desc',
      },
      // --- FIX: Add select to ensure all fields are returned ---
      select: {
        weekNumber: true,
        payPeriod: true,
        salaryType: true,
        stopsCompleted: true,
        amount: true,
        totalDeduction: true,
        netPay: true,
        zipBreakdown: true, // <-- Explicitly select zipBreakdown
      },
    });

    if (!driverPayroll) {
      return [];
    }

    // Format to match old output (simplified)
    return driverPayroll.map((record) => ({
      weekNumber: record.weekNumber,
      payPeriod: record.payPeriod,
      salaryType: record.salaryType,
      totalStops: record.stopsCompleted,
      subtotal: record.amount,
      totalDeduction: record.totalDeduction,
      netPay: record.netPay,
      zipBreakdown: record.zipBreakdown ?? [], // <-- FIX: Return the zipBreakdown
    }));
  }

  /**
   * FIXED: This will now find the record and update it.
   */
  async updatePayrollDeduction({
    driverId,
    weekNumber,
    totalDeduction,
  }: {
    driverId: number;
    weekNumber: number;
    totalDeduction: number;
  }) {
    // This query now uses the compound unique index
    const existing = await this.prisma.payroll.findUnique({
      where: {
        driverId_weekNumber: { driverId, weekNumber },
      },
    });

    if (!existing) {
      this.logger.error(
        `Payroll not found for driverId ${driverId}, week ${weekNumber}`,
      );
      // Throw a user-friendly error
      throw new NotFoundException(
        `Payroll record not found for driver ${driverId}, week ${weekNumber}. It may need to be calculated first.`,
      );
    }

    const netPay = existing.amount - totalDeduction;

    try {
      return await this.prisma.payroll.update({
        where: {
          id: existing.id, // Update by the primary key
        },
        data: {
          totalDeduction,
          netPay,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update deduction for driver ${driverId}, week ${weekNumber}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update payroll.');
    }
  }

  /**
   * REPLACED: This now fetches from our local DB, not Airtable.
   */
  async getAirtableRoutes(): Promise<any[]> {
    const routes = await this.prisma.route.findMany();
    return routes;
  }

  /**
   * DEPRECATED: This function is no longer used by the payroll service.
   * It was replaced by fetching from prisma.driver.
   */
  private async getAirtableDrivers(): Promise<any[]> {
    // This function is no longer called by the new payroll logic.
    // It is kept here only for reference if other parts of the app use it.
    // The new logic uses `this.prisma.driver.findFirst(...)`
    this.logger.warn(
      'getAirtableDrivers() is deprecated for payroll calculation.',
    );
    return [];
  }
}
