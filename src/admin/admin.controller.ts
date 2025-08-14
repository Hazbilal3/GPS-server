import { Controller, Get, UseGuards } from '@nestjs/common';
import { UploadService } from 'src/upload/upload.service';
import { AdminGuard } from 'src/auth/admin.guard';
@Controller('admin')
export class AdminController {
  constructor(private deliveryService: UploadService) {}

  // @UseGuards(AdminGuard)
  // @Get('verify_all')
  // async verifyAllDeliveries() {
  //   return await this.deliveryService.();
  // }
}
