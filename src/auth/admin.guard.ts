// src/auth/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';
@Injectable()
export class AdminGuard implements CanActivate {
  //   private configService: ConfigService;
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      //   const secret = this.configService.get<string>('JWT_SECRET');
      //   const secret = process.env.JWT_SECRET;
      const secret = process.env.JWT_SECRET;

      if (!secret) throw new UnauthorizedException('JWT secret not set');
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      if (typeof payload === 'string' || payload.role !== 1) {
        throw new ForbiddenException('Access denied: Admins only');
      }
      request['user'] = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [, token] = authHeader.split(' ');
    return token;
  }
}
