export class RegisterDto {
  email: string;
  password: string;
  phoneNumber?: number;
  fullName?: string;
  userRole: number;
  adminId?: number;
  driverId?: number;
}
