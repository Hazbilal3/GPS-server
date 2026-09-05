import { Controller, Get, Patch, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { DriverNotificationsService } from './driver-notifications.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('driver-notifications')
@UseGuards(AuthGuard)
export class DriverNotificationsController {
  constructor(private service: DriverNotificationsService) {}

  @Get()
  getAll(@Req() req: any) {
    if (req.user.role !== 2 || !req.user.driverId) return [];
    return this.service.getForDriver(req.user.driverId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    if (req.user.role !== 2 || !req.user.driverId) return { count: 0 };
    const count = await this.service.getUnreadCount(req.user.driverId);
    return { count };
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    if (req.user.role !== 2 || !req.user.driverId) return { success: false };
    return this.service.markAllRead(req.user.driverId);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (req.user.role !== 2 || !req.user.driverId) return { success: false };
    return this.service.markRead(id, req.user.driverId);
  }
}
