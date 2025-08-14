// src/geocode/geocode.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GeocodeService {
  constructor(private configService: ConfigService) {}

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await axios.get(url);
    const results = response.data.results;
    return results.length ? results[0].formatted_address : '';
  }

  async geocodeAddress(
    address: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await axios.get(url);
    const results = response.data.results;
    if (results.length) {
      const location = results[0].geometry.location;
      return { latitude: location.lat, longitude: location.lng };
    }
    return null;
  }
}
