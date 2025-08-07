export class RegisterDto {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  userRole: number; // 1 = admin, 2 = driver
}
