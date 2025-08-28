// src/auth/dto/send-reset-code.dto.ts
import { IsInt } from 'class-validator';
export class SendResetCodeDto {
  @IsInt()
  userId: number;
}
