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
  UseGuards,
} from '@nestjs/common';
import { DriverService } from './user.service';
import { CreateDriverDto, UpdateDriverDto } from './user.entity';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

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

  @Patch(':driverId')
  @UseGuards(AuthGuard, AdminGuard)
  update(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.driverService.updateByDriverId(driverId, dto);
  }
}
