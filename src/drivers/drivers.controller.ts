import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './drivers.entity';
import { AdminGuard } from '../auth/admin.guard';

@Controller('drivers')
@UseGuards(AdminGuard)
export class DriversController {
  constructor(
    @InjectRepository(Driver) private driverRepo: Repository<Driver>,
  ) {}

  @Post()
  async addDriver(@Body() body: { name: string }) {
    const driver = this.driverRepo.create(body);
    return await this.driverRepo.save(driver);
  }

  @Put(':id')
  async editDriver(@Param('id') id: number, @Body() body: { name: string }) {
    await this.driverRepo.update(id, body);
    return await this.driverRepo.findOne({ where: { id } });
  }

  @Delete(':id')
  async deleteDriver(@Param('id') id: number) {
    await this.driverRepo.delete(id);
    return { success: true };
  }
}
