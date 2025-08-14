import { Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import axios from 'axios';
import haversine from 'haversine-distance';
import { PrismaService } from 'src/prisma.service';
import { UploadRowDto } from './dto/upload.dto';

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

  async processExcel(file: Express.Multer.File, driverId: number) {

    const user = await this.prisma.user.findUnique({
    where: { 
      driverId: driverId 
    }
  });

  if (!user) {
    throw new NotFoundException(`Driver with ID ${driverId} not found`);
  }


    // Use the user.id (not driverId) for the foreign key relationship
    const actualDriverId = user.id;

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheet = XLSX.utils.sheet_to_json(worksheet);

    const uploads: UploadRowDto[] = [];

    // Process rows in transaction to ensure all or nothing
    return this.prisma.$transaction(async (prisma) => {
      for (const row of sheet as any[]) {
        const barcode = row['Barcode'];
        const address = row['Address'];
        const gpsLocation = row['Last GPS location'];

        // Get expected Lat/Lng from Address
        let expectedLat: number | null = null;
        let expectedLng: number | null = null;
        
        try {
          const geoRes = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            { params: { address, key: process.env.GOOGLE_MAPS_API_KEY } }
          );
          
          if (geoRes.data.results?.[0]?.geometry?.location) {
            expectedLat = geoRes.data.results[0].geometry.location.lat;
            expectedLng = geoRes.data.results[0].geometry.location.lng;
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }

        let distanceKm: number | null = null;
        let status: string | null = null;
        let googleMapsLink: string | null = null;

        if (gpsLocation && expectedLat && expectedLng) {
          try {
            const [lat, lng] = gpsLocation.split(',').map(Number);
            distanceKm = haversine(
              { lat, lng },
              { lat: expectedLat, lng: expectedLng }
            ) / 1000;

            status = distanceKm > 0.6 ? 'mismatch' : 'match';
            googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${expectedLat},${expectedLng}`;
          } catch (error) {
            console.error('Distance calculation error:', error);
          }
        }

        const saved = await prisma.upload.create({
          data: {
            driverId: user.driverId, // Use the user.id here
            barcode,
            address,
            gpsLocation,
            expectedLat,
            expectedLng,
            distanceKm,
            status,
            googleMapsLink,
          },
        });

        uploads.push(saved);
      }
      return uploads;
    },
{
    maxWait: 500000,    // No maximum wait time
    timeout: 500000     // No transaction timeout
  });
  }
}