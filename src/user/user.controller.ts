import { Controller, Get } from '@nestjs/common';
import { DriverService } from './user.service';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Get()
  async getDriversWithId() {
    return this.driverService.getDriversWithId();
  }
}
