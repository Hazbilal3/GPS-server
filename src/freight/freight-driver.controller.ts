import {
  Controller, Get, Post, Patch, Param, Body, Request,
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
}
