export interface User {
  id: number;
  driverId?: number;  // Optional (nullable)
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  userRole: number;
}