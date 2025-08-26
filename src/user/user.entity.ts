export interface User {
  id: number;
  adminId?: number; 
  driverId?: number;  // Optional (nullable)
  fullName: string;
  phoneNumber: any;
  email: string;
  password: string;
  userRole: number;
}