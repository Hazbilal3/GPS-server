import { Controller, Delete, Get, Param, ParseIntPipe } from '@nestjs/common';
import { DriverService } from './user.service';

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
}
