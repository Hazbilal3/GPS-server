export interface User {
  id: number;
  adminId?: number;
  driverId?: number; // Optional (nullable)
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  userRole: number;
}

// driver.dtos.ts
export class CreateDriverDto {
  driverId!: number;
  fullName!: string;
  phoneNumber!: string;
  email!: string;
  password!: string;
  userRole?: number;
  adminId?: number | null;
  salaryType?: string;
  fixedSalary?: number;
  schedule?: string[];
  status?: string;
  driverAvailableToday?: boolean;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  registrationNumber?: string;
  registrationExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}

export class UpdateDriverDto {
  driverId?: number | null;
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  userRole?: number;
  adminId?: number | null;
  salaryType?: string;
  fixedSalary?: number;
  schedule?: string[];
  status?: string;
  driverAvailableToday?: boolean;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  registrationNumber?: string;
  registrationExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}
