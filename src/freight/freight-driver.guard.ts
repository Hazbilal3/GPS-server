import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class FreightDriverGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user || user.role !== 5) {
      throw new ForbiddenException('Freight driver access required');
    }
    return true;
  }
}
