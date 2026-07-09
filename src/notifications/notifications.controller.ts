import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
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

  @Get('templates')
  getTemplates() {
    return this.service.getTemplates();
  }

  @Post('templates')
  createTemplate(@Body() body: { name: string; title: string; message: string }) {
    return this.service.createTemplate(body.name, body.title, body.message);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteTemplate(id);
  }
}
