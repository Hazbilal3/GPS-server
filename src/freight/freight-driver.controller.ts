import {
  Controller, Get, Post, Patch, Delete, Param, Body, Request,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FreightService } from './freight.service';
import { AuthGuard } from '../auth/auth.guard';
import { FreightDriverGuard } from './freight-driver.guard';

@Controller('freight/driver')
@UseGuards(AuthGuard, FreightDriverGuard)
export class FreightDriverController {
  constructor(private service: FreightService) {}

  @Get('me')
  getProfile(@Request() req: any) {
    return this.service.getDriverProfile(req.user.freightDriverId);
  }

  @Get('me/settlement')
  getSettlement(@Request() req: any) {
    return this.service.getDriverSettlement(req.user.freightDriverId);
  }

  @Get('me/loads')
  getLoads(@Request() req: any) {
    return this.service.getDriverLoads(req.user.freightDriverId);
  }

  @Get('me/loads/:id')
  getLoad(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.getDriverLoad(req.user.freightDriverId, id);
  }

  @Post('me/loads/:id/clock-in')
  clockIn(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.driverClockIn(req.user.freightDriverId, id);
  }

  @Post('me/loads/:id/clock-out')
  clockOut(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.driverClockOut(req.user.freightDriverId, id);
  }

  @Post('me/loads/:id/action')
  action(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('action') action: string,
  ) {
    if (!action) throw new BadRequestException('action is required');
    return this.service.driverAction(req.user.freightDriverId, id, action);
  }

  @Post('me/loads/:id/pre-trip')
  preTrip(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.service.submitPreTrip(req.user.freightDriverId, id, body);
  }

  @Post('me/loads/:id/pod')
  @UseInterceptors(FileInterceptor('file'))
  uploadPod(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.service.uploadPod(req.user.freightDriverId, id, file);
  }

  // ── Load Expenses ─────────────────────────────────────────

  @Get('me/loads/:id/expenses')
  getExpenses(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.getLoadExpenses(req.user.freightDriverId, id);
  }

  @Post('me/loads/:id/expenses')
  addExpense(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('description') description: string,
    @Body('amount') amount: any,
  ) {
    if (!description) throw new BadRequestException('description is required');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) throw new BadRequestException('amount must be a positive number');
    return this.service.addLoadExpense(req.user.freightDriverId, id, description, amt);
  }

  @Delete('me/loads/:id/expenses/:expenseId')
  deleteExpense(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
  ) {
    return this.service.deleteLoadExpense(req.user.freightDriverId, id, expenseId);
  }

  // ── Disputes ──────────────────────────────────────────────

  @Get('me/disputes')
  getDisputes(@Request() req: any) {
    return this.service.getFreightDriverDisputes(req.user.freightDriverId);
  }

  @Post('me/disputes')
  createDispute(@Request() req: any, @Body() body: any) {
    if (!body.subject) throw new BadRequestException('subject is required');
    if (!body.message) throw new BadRequestException('message is required');
    return this.service.createFreightDriverDispute(req.user.freightDriverId, body);
  }

  @Post('me/disputes/:id/messages')
  sendMessage(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content: string,
  ) {
    if (!content) throw new BadRequestException('content is required');
    return this.service.sendFreightDisputeMessage(req.user.freightDriverId, id, content);
  }

  // ── Notifications ─────────────────────────────────────────

  @Get('me/notifications')
  getNotifications(@Request() req: any) {
    return this.service.getFreightDriverNotifications(req.user.freightDriverId);
  }

  @Patch('me/notifications/read-all')
  markAllRead(@Request() req: any) {
    return this.service.markAllFreightNotificationsRead(req.user.freightDriverId);
  }

  @Patch('me/notifications/:id/read')
  markRead(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.markFreightNotificationRead(req.user.freightDriverId, id);
  }
}
