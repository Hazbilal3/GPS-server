import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeocodeService {
  private readonly GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    const results = response.data.results;
    return results.length ? results[0].formatted_address : '';
  }
}
