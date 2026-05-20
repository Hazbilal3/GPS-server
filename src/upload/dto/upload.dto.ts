export interface UploadRowDto {
  barcode: string;
  address: string;
  sequenceNo?: string;
  lastevent?: string;
  pieces?: number;
  zipCode?: string;
  city?: string;
}

export interface UploadFileDto {
  driverId: number;
  file: Express.Multer.File;
}
