import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import axios from 'axios';
import haversine from 'haversine-distance';
import { PrismaService } from 'src/prisma.service';
import { UploadRowDto } from './dto/upload.dto';

function parseLatLngSpaceSeparated(input: string) {
  const parts = input.trim().split(/\s+/); // split on space(s)
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

/** ===== Helpers for robust geocoding of partial/dirty addresses ===== */

const US_STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY',
  'LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY','PR','GU','VI','AS','MP','UM'
]);

function normalizeAddress(raw: string) {
  if (!raw) return { cleaned: '', zip: null as string | null, state: null as string | null, city: null as string | null };

  let a = String(raw);

  // Remove tokens like "LOCATION-3-6621" or "LOCATION 3 6621"
  a = a.replace(/\bLOCATION[-\s]*[\w-]+\b/gi, ' ');

  // Convert dots to spaces; normalize commas/spaces
  a = a.replace(/[.]/g, ' ')
       .replace(/\s*,\s*/g, ', ')
       .replace(/\s{2,}/g, ' ')
       .trim();

  // Extract ZIP (5 or 9)
  const zipMatch = a.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[0] : null;

  // Extract state (2-letter)
  const stateMatch = a.match(/\b[A-Z]{2}\b/g);
  const state = stateMatch ? (stateMatch.find(s => US_STATE_ABBR.has(s.toUpperCase())) ?? null) : null;

  // Heuristic city extraction: token(s) just before state if we have ", City, ST"
  let city: string | null = null;
  if (state) {
    const cityRe = new RegExp(`,\\s*([A-Za-z][A-Za-z\\s.'-]+)\\s*,\\s*${state}\\b`);
    const m = a.match(cityRe);
    if (m && m[1]) city = m[1].trim();
  } else {
    // If no state, look for "..., City" at the end
    const m = a.match(/,\s*([A-Za-z][A-Za-z\s.'-]+)\s*$/);
    if (m && m[1]) city = m[1].trim();
  }

  // Ensure comma before state
  if (state) a = a.replace(new RegExp(`\\s${state}\\b`), `, ${state}`);
  // Ensure a space before ZIP
  if (zip) a = a.replace(new RegExp(`\\s*${zip}\\b`), ` ${zip}`);

  // Clean double commas
  a = a.replace(/,\s*,/g, ', ').trim();

  return { cleaned: a, zip, state, city };
}

function componentsFilter(zip?: string | null, state?: string | null) {
  const parts = ['country:US'];
  if (zip) parts.push(`postal_code:${zip}`);
  if (state) parts.push(`administrative_area:${state}`);
  return parts.join('|');
}

function pickBestGeocodeResult(results: any[], zip?: string | null, state?: string | null, city?: string | null) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const hasZip = (r: any) => zip && r.formatted_address?.includes(zip);
  const hasState = (r: any) => state && new RegExp(`\\b${state}\\b`).test(r.formatted_address || '');
  const hasCity = (r: any) => city && new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      .test(r.formatted_address || '');
  const isStreety = (r: any) =>
    (r.types || []).includes('street_address') || (r.types || []).includes('premise');

  const scored = results.map((r: any) => {
    let score = 0;
    if (hasZip(r)) score += 100;
    if (hasState(r)) score += 50;
    if (hasCity(r)) score += 40;
    if (isStreety(r)) score += 25;
    // Prefer shorter formatted addresses (slightly)
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
  opts?: { gpsBias?: { lat: number; lng: number } }
): Promise<SmartGeo | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Missing GOOGLE_MAPS_API_KEY');

  const { cleaned, zip, state, city } = normalizeAddress(addressRaw);
  const allowGpsBias = !zip && !state && !!opts?.gpsBias; // only bias if truly partial (no ZIP & no state)

  // 1) Geocoding API with components bias (authoritative if we have ZIP/State)
  try {
    const gcParams: any = { address: cleaned, key, region: 'us' };
    const comp = componentsFilter(zip, state);
    if (comp) gcParams.components = comp;

    const geoRes = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: gcParams,
    });

    const { results, status } = geoRes.data || {};
    if (status === 'OK' && results?.length) {
      const best = pickBestGeocodeResult(results, zip, state, city) || results[0];
      return {
        lat: best.geometry.location.lat,
        lng: best.geometry.location.lng,
        formattedAddress: best.formatted_address,
        partialMatch: Boolean(best.partial_match),
        source: 'geocode',
      };
    }
  } catch {
    // fall through
  }

  // 2) Places: Find Place From Text (handles partial text well)
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
      // Bias around driver GPS if partial
      findParams.locationbias = `circle:50000@${lat},${lng}`; // 50km bias radius
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
  } catch {
    // fall through
  }

  // 3) Places: Text Search (broadest)
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
  } catch {
    // no-op
  }

  return null;
}

/** =================== Upload Service =================== */
function utcStartOfDay(yyyyMmDd: string) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}
@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

async processExcel(file: Express.Multer.File, driverId: number, date?: string) {
  const user = await this.prisma.user.findUnique({ where: { driverId } });
  if (!user) throw new NotFoundException(`Driver with ID ${driverId} not found`);

  // Keep aligned with your FK (as you already had)
  const fkValue = user.driverId;

  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const sheet = XLSX.utils.sheet_to_json(worksheet);

  const uploads: UploadRowDto[] = [];

  // if a date is provided, we’ll override createdAt to that day’s start (UTC)
  const createdAtOverride = date ? utcStartOfDay(date) : undefined;

  return this.prisma.$transaction(
    async (prisma) => {
      for (const row of sheet as any[]) {
        const barcode: string = row['Barcode'];
        const addressRaw: string = row['Address'];
        const gpsLocation: string = row['Last GPS location'];

        let expectedLat: number | null = null;
        let expectedLng: number | null = null;
        let distanceKm: number | null = null;
        let status: string | null = null;
        let googleMapsLink: string | null = null;

        // Try parse GPS once (for bias + distance)
        let gpsForBias: { lat: number; lng: number } | null = null;
        if (gpsLocation && String(gpsLocation).trim()) {
          try {
            gpsForBias = parseLatLngSpaceSeparated(gpsLocation);
          } catch {
            gpsForBias = null;
          }
        }

        // Smart geocoding for partial/noisy addresses
        if (addressRaw && String(addressRaw).trim().length > 0) {
          try {
            const geo = await geocodeSmart(addressRaw, { gpsBias: gpsForBias || undefined });
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

        // Distance & link
        if (gpsForBias && expectedLat != null && expectedLng != null) {
          try {
            const meters = haversine(
              { lat: gpsForBias.lat, lng: gpsForBias.lng },
              { lat: Number(expectedLat), lng: Number(expectedLng) },
            );
            distanceKm = meters /1000;
            status = distanceKm > 0.01 ? 'mismatch' : 'match';
            googleMapsLink =
              `https://www.google.com/maps/dir/?api=1&origin=${gpsForBias.lat},${gpsForBias.lng}` +
              `&destination=${expectedLat},${expectedLng}`;
          } catch {
            if (!status) status = 'gps_parse_error';
          }
        } else if (!gpsLocation && (expectedLat != null && expectedLng != null)) {
          status = status ?? 'geocoded';
        }

        const saved = await prisma.upload.create({
          data: {
            driverId: fkValue,
            barcode,
            address: addressRaw,
            gpsLocation,
            expectedLat,
            expectedLng,
            distanceKm,
            status,
            googleMapsLink,
            ...(createdAtOverride ? { createdAt: createdAtOverride } : {}), // <-- set the date
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

    // If Upload.driverId references User.driverId, this is fine.
    // If your Upload model uses userId (FK to User.id), switch filter to { userId: <id> }.
    const result = await this.prisma.upload.deleteMany({
      where: {
        driverId,                 // <-- change to userId if your FK is userId
        createdAt: { gte: start, lt: end },
      },
    });

    return {
      driverId,
      date: dateStr,
      deleted: result.count,
    };
  }
}

/** Helpers */
function getUtcDayBounds(yyyyMmDd: string) {
  // Treat the provided date as a UTC calendar day
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const end = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1); // next day start (exclusive)
  if (isNaN(start.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return { start, end };

}
