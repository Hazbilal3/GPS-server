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
  driverId!: number;          // required (non-null)
  fullName!: string;          // required
  phoneNumber!: string;       // required
  email!: string;             // required
  password!: string;          // required
  userRole?: number;          // optional; default set in service (e.g., 2 = driver)
  adminId?: number | null;    // optional
}

export class UpdateDriverDto {
  driverId?: number | null;   // optional; set to null to "unassign" driver role if desired
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  password?: string;          // optional; if provided, will be hashed
  userRole?: number;
  adminId?: number | null;
}
