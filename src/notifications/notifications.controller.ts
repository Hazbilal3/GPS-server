import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('notifications')
@UseGuards(AuthGuard, AdminGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('broadcast')
  broadcast(@Body() body: { title?: string; message?: string; driverIds?: number[] }) {
    return this.service.broadcast(body.title ?? '', body.message ?? '', body.driverIds);
  }
}
