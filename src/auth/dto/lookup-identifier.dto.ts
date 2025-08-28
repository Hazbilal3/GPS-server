// src/auth/dto/lookup-identifier.dto.ts
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class LookupIdentifierDto {
  @IsIn([1, 2], { message: 'userRole must be 1 (Admin) or 2 (Driver)' })
  userRole: 1 | 2;

  @IsOptional() @IsInt()
  adminId?: number;

  @IsOptional() @IsInt()
  driverId?: number;
}
