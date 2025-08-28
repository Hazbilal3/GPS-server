export interface UploadRowDto {
  barcode: string;
  address: string;
  gpsLocation?: string | null;
  expectedLat?: number | null;
  expectedLng?: number | null;
  distanceKm?: number | null;
  status?: string | null;
  googleMapsLink?: string | null;
}

export interface UploadFileDto {
  driverId: number;
  file: Express.Multer.File;
}
