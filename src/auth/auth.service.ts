// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import * as nodemailer from 'nodemailer';

import { LoginDto } from 'src/user/dto/login.dto';
import { RegisterDto } from 'src/user/dto/register.dto';

import { LookupIdentifierDto } from './dto/lookup-identifier.dto';
import { SendResetCodeDto } from './dto/send-reset-code.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Build transporter from env
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = (process.env.SMTP_SECURE ?? '') === 'true' || port === 465; // 465 = SMTPS
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      // Helpful defaults
      tls: { minVersion: 'TLSv1.2' },
      // TEMP: enable debug logs to server console while troubleshooting
      logger: true,
      debug: true,
    });
  }

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

  private async sendOtpEmail(to: string, code: string) {
    const appName = process.env.APP_NAME || 'Our App';

    // 1) Always use MAIL_FROM for the *visible* From
    //    Never fall back to SMTP_USER, so your owner email won't show.
    const from =
      process.env.MAIL_FROM ||
      `"${appName} (no-reply)" <no-reply@${process.env.MAIL_DOMAIN || 'example.com'}>`;

    // 2) Make replies go nowhere (or to an unmonitored mailbox)
    const replyTo =
      process.env.MAIL_REPLY_TO ||
      `no-reply@${process.env.MAIL_DOMAIN || 'example.com'}`;

    const subject = `${appName} password reset code: ${code}`;
    const text = `Your ${appName} password reset code is ${code}. It expires in 10 minutes. If you didn’t request this, ignore this email.`;
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6">
      <p>Use this verification code to reset your password:</p>
      <p style="font-size:24px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

    try {
      const info = await this.transporter.sendMail({
        from, // visible From (what recipients see)
        sender: process.env.SMTP_USER, // aligns with the authenticated account
        to,
        subject,
        text,
        html,
        replyTo, // where a “reply” would be addressed
        envelope: {
          // SMTP envelope (Return-Path); not shown to users
          from: replyTo,
          to,
        },
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
        },
      });
      return info.messageId;
    } catch {
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
        where: { adminId: dto.adminId, userRole: 1 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
    } else if (dto.userRole === 2) {
      user = await this.prisma.user.findFirst({
        where: { driverId: dto.driverId, userRole: 2 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid driver credentials');
      }
    } else {
      throw new UnauthorizedException('Invalid user role');
    }

    const payload = {
      sub: user.id,
      email: user.email || user.adminId || user.driverId,
      role: user.userRole,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name : user.fullName,
        email: user.email,
        role: user.userRole,
        driverId: user.driverId,
        adminId: user.adminId,
      },
    };
  }
}
