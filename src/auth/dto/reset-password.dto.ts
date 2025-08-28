// src/auth/dto/reset-password.dto.ts
import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken: string;      // short-lived token returned by verify step

  @IsString()
  @Length(8, 72)
  newPassword: string;
}
