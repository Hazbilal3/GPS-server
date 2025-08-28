// src/auth/dto/verify-reset-code.dto.ts
import { IsInt, IsString, Length } from 'class-validator';
export class VerifyResetCodeDto {
  @IsInt()
  userId: number;

  @IsString()
  @Length(6, 6)
  code: string;
}
