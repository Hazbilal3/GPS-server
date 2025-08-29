import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post} from '@nestjs/common';
import { DriverService } from './user.service';
import { CreateDriverDto, UpdateDriverDto } from './user.entity';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get()
  async getDriversWithId() {
    return this.driverService.getDriversWithId();
  }

  @Delete(':driverId')
  remove(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.driverService.deleteByDriverId(driverId);
  }

   @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.driverService.createDriver(dto);
  }

  @Patch(':driverId')
  update(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.driverService.updateByDriverId(driverId, dto);
  }
}
