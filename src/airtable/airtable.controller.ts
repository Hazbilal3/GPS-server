// auth/auth.controller.ts
import { Controller, Get, Post,Put, Delete, Body, Param } from '@nestjs/common';
import { AirtableService } from './airtable.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';


@Controller('airtable')
export class AirtableController {
  constructor(private airtableService: AirtableService) {}

  @Get('drivers')
  drivers() {
    return this.airtableService.Drivers();
  }

  @Get('payrollSummary')
  payrollSummary() {
    return this.airtableService.PayRollSummary();
  }

  @Get('payrolls')
  payrolls() {
    return this.airtableService.PayRolls();
  }

  @Get('routes')
  routes() {
    return this.airtableService.routes();
  }

  @Post('customRoutes')
  customRoutes() {
    return this.airtableService.customroutes();
  }

  @Get('fetch-payroll')
  async fetchAndSavePayroll() {
    const result = await this.airtableService.fetchAndSavePayroll();
    return { message: 'Payroll saved successfully', data: result };
  }

  @Get('fetch-drivers')
  async fetchAndSaveDrivers() {
    const result = await this.airtableService.fetchAndSaveDrivers();
    return { message: 'driver saved successfully', data: result };
  }

  @Get('drivers-data')
  async fetchAndSaveRoutes() {
  return await this.airtableService.getDrivers();
  }

  @Get('payroll-data')
  async fetchAndSaveCustomRoutes() {
    return await this.airtableService.getPayrolls();
  }
  @Post('add-driver')
  async addDriver(@Body() driverData: CreateDriverDto) {
    const result = await this.airtableService.addDriver(driverData);
    return { message: 'Driver added successfully', data: result };
  }

  @Put('edit-driver/:id')
  async editDriver(@Param('id') id: number, @Body() updateData: UpdateDriverDto) {
    const result = await this.airtableService.editDriver(+id, updateData);
    return { message: 'Driver updated successfully', data: result };
  }

  @Delete('delete-driver/:id')
  async deleteDriver(@Param('id') id: number) {
    const result = await this.airtableService.deleteDriver(+id);
    return { message: 'Driver deleted successfully', data: result };
  }
}

