import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriverService } from './user.service';
import { CreateDriverDto, UpdateDriverDto } from './user.entity';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { createS3Storage } from '../s3.storage';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getDriversWithId() {
    return this.driverService.getDriversWithId();
  }

  @Get(':driverId')
  @UseGuards(AuthGuard)
  getOne(@Req() req: any, @Param('driverId', ParseIntPipe) driverId: number) {
    if (req.user.role !== 1 && req.user.driverId !== driverId) throw new ForbiddenException();
    return this.driverService.getDriverById(driverId);
  }

  @Delete(':driverId')
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.driverService.deleteByDriverId(driverId);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  create(@Body() dto: CreateDriverDto) {
    return this.driverService.createDriver(dto);
  }

  @Patch(':driverId/profile-image')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: createS3Storage('profile-images') }))
  uploadProfileImage(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
    @UploadedFile() file: any,
  ) {
    if (req.user.role !== 1 && req.user.driverId !== driverId) throw new ForbiddenException();
    const url: string = file?.location ?? file?.path ?? '';
    return this.driverService.updateProfileImage(driverId, url);
  }

  @Patch(':driverId/push-token')
  @UseGuards(AuthGuard)
  savePushToken(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() body: { pushToken: string },
  ) {
    if (req.user.role !== 1 && req.user.driverId !== driverId) throw new ForbiddenException();
    return this.driverService.savePushToken(driverId, body.pushToken);
  }

  @Patch(':driverId/email')
  @UseGuards(AuthGuard)
  updateEmail(
    @Req() req: any,
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() body: { email: string },
  ) {
    if (req.user.role !== 1 && req.user.driverId !== driverId) throw new ForbiddenException();
    return this.driverService.updateByDriverId(driverId, { email: body.email });
  }

  @Patch(':driverId/suspend')
  @UseGuards(AuthGuard, AdminGuard)
  suspend(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.driverService.suspendDriver(driverId);
  }

  @Patch(':driverId/unsuspend')
  @UseGuards(AuthGuard, AdminGuard)
  unsuspend(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.driverService.unsuspendDriver(driverId);
  }

  @Patch(':driverId')
  @UseGuards(AuthGuard, AdminGuard)
  update(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.driverService.updateByDriverId(driverId, dto);
  }
}
