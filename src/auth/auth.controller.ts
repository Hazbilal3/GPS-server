import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-lookup')
  lookup(@Body() dto: LookupIdentifierDto) {
    return this.authService.lookupIdentifier(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('forgot-send-code')
  sendCode(@Body() dto: SendResetCodeDto) {
    return this.authService.sendResetCode(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('forgot-verify-code')
  verify(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('forgot-reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
