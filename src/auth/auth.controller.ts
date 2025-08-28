// auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from 'src/user/dto/register.dto';
import { LoginDto } from 'src/user/dto/login.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LookupIdentifierDto } from './dto/lookup-identifier.dto';
import { SendResetCodeDto } from './dto/send-reset-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

 @Post('forgot-lookup')
  lookup(@Body() dto: LookupIdentifierDto) {
    return this.authService.lookupIdentifier(dto);
  }

  // STEP 2: send OTP to that user's email
  @Post('forgot-send-code')
  sendCode(@Body() dto: SendResetCodeDto) {
    return this.authService.sendResetCode(dto);
  }

  // STEP 3: verify OTP
  @Post('forgot-verify-code')
  verify(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  // STEP 4: reset password
  @Post('forgot-reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
