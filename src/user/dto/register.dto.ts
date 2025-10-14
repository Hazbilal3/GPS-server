export class RegisterDto {
  email: string;
  password: string;
  phoneNumber?: string;
  fullName?: string;
  userRole: number;
  adminId?: number;
  driverId?: number;
}
