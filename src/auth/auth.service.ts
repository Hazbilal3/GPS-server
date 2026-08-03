// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { MailService } from '../mail/mail.service';

import { LoginDto } from 'src/user/dto/login.dto';
import { RegisterDto } from 'src/user/dto/register.dto';

import { LookupIdentifierDto } from './dto/lookup-identifier.dto';
import { SendResetCodeDto } from './dto/send-reset-code.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mail: MailService,
  ) {}

  // ===== helpers =====
  private maskEmail(email: string | null) {
    if (!email) return null;
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    const maskedName =
      name.length <= 2 ? name[0] + '*' : name.slice(0, 2) + '***';
    const [dName, dTld] = domain.split('.');
    const maskedDomain = (dName?.[0] ?? '*') + '***' + (dTld ? '.' + dTld : '');
    return `${maskedName}@${maskedDomain}`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  }

  private async sendOtpEmail(
    to: string,
    code: string,
    subject?: string,
    bodyHtml?: string,
  ) {
    const appName = process.env.APP_NAME || 'CMJL';
    const finalSubject = subject ?? `${appName} verification code: ${code}`;
    const finalHtml = bodyHtml ?? `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
      <p>Use this verification code:</p>
      <p style="font-size:24px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
    try {
      await this.mail.send(to, finalSubject, finalHtml, `Your verification code is ${code}. It expires in 10 minutes.`);
    } catch (error) {
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  // ===== Forgot Password (ID → email → OTP → reset) =====

  // Step 1: user enters AdminID or DriverID; return masked email + userId (no OTP yet)
  async lookupIdentifier(dto: LookupIdentifierDto) {
    let user: { id: number; email: string | null } | null = null;

    if (dto.userRole === 1 && dto.adminId != null) {
      user = await this.prisma.user.findFirst({
        where: { userRole: 1, adminId: dto.adminId },
        select: { id: true, email: true },
      });
    } else if (dto.userRole === 2 && dto.driverId != null) {
      user = await this.prisma.user.findFirst({
        where: { userRole: 2, driverId: dto.driverId },
        select: { id: true, email: true },
      });
    } else {
      throw new BadRequestException(
        'Provide adminId for role 1 or driverId for role 2.',
      );
    }

    if (!user)
      throw new NotFoundException('No user found for the provided identifier.');

    return {
      userId: user.id,
      maskedEmail: this.maskEmail(user.email),
      hasEmail: !!user.email,
      message: user.email
        ? 'Email found for this account.'
        : 'No email attached to this account.',
    };
  }

  // Step 2: send OTP to that user's email and store hashed OTP + expiry
  async sendResetCode(dto: SendResetCodeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!user || !user.email)
      throw new NotFoundException('User or email not found.');

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetCodeHash: codeHash,
        resetCodeExpiresAt: expiresAt,
        resetCodeAttempts: 0,
      },
    });

    await this.sendOtpEmail(user.email, code);

    return {
      userId: user.id,
      maskedEmail: this.maskEmail(user.email),
      message: 'Verification code sent to your email.',
    };
  }

  // Step 3: verify OTP; return short-lived resetToken (no DB column needed)
  async verifyResetCode(dto: VerifyResetCodeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        resetCodeHash: true,
        resetCodeExpiresAt: true,
        resetCodeAttempts: true,
      },
    });

    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      throw new BadRequestException('No active reset request found.');
    }
    if (user.resetCodeExpiresAt < new Date()) {
      throw new BadRequestException('Code expired. Please request a new one.');
    }
    if ((user.resetCodeAttempts ?? 0) >= 5) {
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    const ok = await bcrypt.compare(dto.code, user.resetCodeHash);
    if (!ok) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetCodeAttempts: (user.resetCodeAttempts ?? 0) + 1 },
      });
      throw new BadRequestException('Invalid code.');
    }

    // Issue a short-lived reset token (ties the verified OTP to this user)
    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset' },
      { expiresIn: '10m' },
    );

    return { success: true, resetToken };
  }

  // Step 4: reset password using resetToken + newPassword
  async resetPassword(dto: ResetPasswordDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.resetToken);
    } catch {
      throw new BadRequestException('Invalid or expired reset token.');
    }
    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid reset token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, resetCodeHash: true, resetCodeExpiresAt: true },
    });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      throw new BadRequestException('No active reset request found.');
    }
    if (user.resetCodeExpiresAt < new Date()) {
      throw new BadRequestException('Code expired. Please request a new one.');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        // clear reset state
        resetCodeHash: null,
        resetCodeExpiresAt: null,
        resetCodeAttempts: 0,
      },
    });

    return { success: true, message: 'Password updated. You can log in now.' };
  }

  // ===== New Self-Registration Flow =====

  async driverSignup(dto: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    password: string;
    state?: string;
    operatingType?: string;
    vehicleSize?: string;
  }) {
    // Check for duplicate email — if unverified ghost account exists, clean it up and allow re-signup
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      if (!existingEmail.emailVerified) {
        await this.prisma.user.delete({ where: { id: existingEmail.id } });
      } else {
        throw new ConflictException('An account with this email already exists.');
      }
    }

    if (dto.phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phoneNumber: dto.phoneNumber } });
      if (existingPhone && existingPhone.emailVerified) {
        throw new ConflictException('An account with this phone number already exists.');
      } else if (existingPhone && !existingPhone.emailVerified) {
        await this.prisma.user.delete({ where: { id: existingPhone.id } });
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber || null,
        password: hashedPassword,
        userRole: 2,
        emailVerified: false,
        emailOtpHash: codeHash,
        emailOtpExpiresAt: expiresAt,
        poolStatus: 'pending',
        state: dto.state || null,
        operatingType: dto.operatingType || null,
        vehicleSize: dto.vehicleSize || null,
      },
    });

    const appName = process.env.APP_NAME || 'CMJL';
    await this.sendOtpEmail(
      dto.email,
      code,
      `${appName} — Verify your email`,
      `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
        <p>Hi ${dto.fullName},</p>
        <p>Welcome to ${appName}! Use this code to verify your email address:</p>
        <p style="font-size:28px;letter-spacing:8px;font-weight:700;margin:20px 0;color:#4f9cf9">${code}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
      </div>`,
    );

    return { userId: user.id, message: 'OTP sent to your email. Please verify to continue.' };
  }

  async verifySignupOtp(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailOtpHash: true, emailOtpExpiresAt: true, emailVerified: true, userRole: true, poolStatus: true, driverId: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    if (user.emailVerified) throw new BadRequestException('Email already verified.');
    if (!user.emailOtpHash || !user.emailOtpExpiresAt) throw new BadRequestException('No OTP request found.');
    if (user.emailOtpExpiresAt < new Date()) throw new BadRequestException('OTP expired. Please sign up again.');

    const ok = await bcrypt.compare(code, user.emailOtpHash);
    if (!ok) throw new BadRequestException('Invalid OTP code.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailOtpHash: null, emailOtpExpiresAt: null },
    });

    const payload = { sub: userId, role: user.userRole, driverId: user.driverId, poolStatus: user.poolStatus };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: userId, role: user.userRole, poolStatus: user.poolStatus, driverId: user.driverId },
      message: 'Email verified successfully.',
    };
  }

  // ===== Option-B mobile registration =====

  // Check if driverId exists and is pending registration (no password set yet)
  async checkDriver(driverId: number) {
    const user = await this.prisma.user.findFirst({
      where: { driverId, userRole: 2 },
      select: { id: true, fullName: true, email: true, password: true },
    });

    if (!user) throw new NotFoundException('No driver found with that ID. Contact your admin.');
    if (user.password) throw new BadRequestException('Account already registered. Please log in.');

    return {
      driverId,
      fullName: user.fullName,
      maskedEmail: this.maskEmail(user.email),
      status: 'pending',
      message: 'Driver found. Proceed to set your password.',
    };
  }

  // Complete registration: set password for a pending driver, return token immediately
  async completeRegistration(driverId: number, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { driverId, userRole: 2 },
      select: { id: true, fullName: true, email: true, password: true },
    });

    if (!user) throw new NotFoundException('Driver not found.');
    if (user.password) throw new BadRequestException('Account already registered. Please log in.');
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    const tokenPayload = { sub: user.id, role: 2, driverId };
    return {
      accessToken: this.jwtService.sign(tokenPayload),
      user: { id: user.id, name: user.fullName, email: user.email, role: 2, driverId },
    };
  }

  // ===== Regular register/login (kept from your code) =====
  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    if (dto.userRole === 1) {
      return this.prisma.user.create({
        data: {
          adminId: dto.adminId,
          fullName: dto.fullName,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          phoneNumber: dto.phoneNumber,
          email: dto.email,
          password: hashedPassword,
          userRole: 1,
        },
      });
    } else if (dto.userRole === 2) {
      return this.prisma.user.create({
        data: {
          driverId: dto.driverId,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          email: dto.email,
          password: hashedPassword,
          userRole: 2,
        },
      });
    }
    throw new UnauthorizedException('Invalid user role');
  }

  async login(dto: LoginDto) {
    let user: any;
    if (dto.userRole === 1) {
      user = await this.prisma.user.findFirst({
        where: { adminId: dto.adminId, userRole: { in: [1, 3, 4] } },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
    } else if (dto.userRole === 2) {
      // Support both: driverId login (approved drivers) AND email login (pending pool drivers)
      if (dto.driverId) {
        user = await this.prisma.user.findFirst({
          where: { driverId: dto.driverId, userRole: 2 },
        });
      } else if ((dto as any).email) {
        user = await this.prisma.user.findFirst({
          where: { email: (dto as any).email, userRole: 2 },
        });
      }

      if (!user) throw new UnauthorizedException('Invalid driver credentials');
      if (!user.password) {
        throw new UnauthorizedException(
          'Account not activated. Please complete registration on the mobile app.',
        );
      }
      if (!user.emailVerified && user.poolStatus === 'pending') {
        throw new UnauthorizedException('Please verify your email first.');
      }
      if (user.poolStatus === 'rejected') {
        throw new UnauthorizedException('Your application has been rejected. Please contact support.');
      }
      if (!(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid driver credentials');
      }
    } else {
      throw new UnauthorizedException('Invalid user role');
    }

    const payload = {
      sub: user.id,
      email: user.email || user.adminId || user.driverId,
      role: user.userRole,
      driverId: user.driverId ?? null,
      poolStatus: user.poolStatus ?? null,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.userRole,
        driverId: user.driverId,
        adminId: user.adminId,
        poolStatus: user.poolStatus ?? null,
      },
    };
  }

}
