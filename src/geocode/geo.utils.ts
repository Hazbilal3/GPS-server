/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Client } from '@googlemaps/google-maps-services-js';
import { getDistance } from 'geolib';

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const client = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

export async function geocodeAddress(
  address: string,
): Promise<[number, number] | null> {
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');
  try {
    const res = await client.geocode({ params: { address, key: apiKey } });
    if (res.data.results.length === 0) return null;
    const loc = res.data.results[0].geometry.location;
    return [loc.lat, loc.lng];
  } catch {
    return null;
  }
}

export function calculateDistance(
  gps: [number, number],
  expected: [number, number],
): number {
  return (
    getDistance(
      { latitude: gps[0], longitude: gps[1] },
      { latitude: expected[0], longitude: expected[1] },
    ) / 1000
  );
}
