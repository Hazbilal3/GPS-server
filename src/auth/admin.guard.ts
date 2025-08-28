// src/auth/admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: any = request.user;

    if (!user || user.role !== 1) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
