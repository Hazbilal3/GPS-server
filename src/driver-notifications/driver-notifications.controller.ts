import { Controller, Get, Patch, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { DriverNotificationsService } from './driver-notifications.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('driver-notifications')
@UseGuards(AuthGuard)
export class DriverNotificationsController {
  constructor(private service: DriverNotificationsService) {}

  @Get()
  getAll(@Req() req: any) {
    return this.service.getForDriver(req.user.driverId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.service.getUnreadCount(req.user.driverId);
    return { count };
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user.driverId);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.markRead(id, req.user.driverId);
  }
}
