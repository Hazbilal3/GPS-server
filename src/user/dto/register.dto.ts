export class RegisterDto {
  driverId: number;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  userRole: number; // 1 = admin, 2 = driver
}
