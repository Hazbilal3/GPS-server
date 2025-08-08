// src/auth/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly configService: ConfigService;
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new UnauthorizedException('JWT secret not set');
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      if (typeof payload === 'string' || payload.role !== 1) {
        throw new ForbiddenException('Access denied: Admins only');
      }
      request['user'] = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [, token] = authHeader.split(' ');
    return token;
  }
}
