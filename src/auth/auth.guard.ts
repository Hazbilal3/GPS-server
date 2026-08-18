// src/auth/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new UnauthorizedException('JWT secret not set');
      }

      const payload = jwt.verify(token, secret) as jwt.JwtPayload;

      // For driver tokens, check suspension on every request so already-logged-in
      // drivers are kicked out immediately when suspended (JWT expires in 365d).
      if (payload.role === 2 && payload.driverId) {
        const user = await this.prisma.user.findFirst({
          where: { driverId: payload.driverId },
          select: { status: true },
        });
        if (user?.status === 'Suspended') {
          throw new UnauthorizedException('ACCOUNT_SUSPENDED');
        }
      }

      request['user'] = payload;
      return true;
    } catch (error: any) {
      if (error?.message === 'ACCOUNT_SUSPENDED') {
        throw new UnauthorizedException('Your account has been suspended. Please contact support.');
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Try header, then body, then query
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    if (request.body && request.body.token) {
      return request.body.token;
    }

    if (request.query && typeof request.query.token === 'string') {
      return request.query.token;
    }

    return null;
  }
}
