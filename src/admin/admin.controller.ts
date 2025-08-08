import { Controller, Get, UseGuards } from '@nestjs/common';
import { DeliveryService } from 'src/upload/upload.service';
import { AdminGuard } from 'src/auth/admin.guard';
@Controller('admin')
export class AdminController {
  constructor(private deliveryService: DeliveryService) {}

  @UseGuards(AdminGuard)
  @Get('verify_all')
  async verifyAllDeliveries() {
    return await this.deliveryService.getAllDeliveries();
  }
}
