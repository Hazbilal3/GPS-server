// auth/auth.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AirtableService } from './airtable.service';

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
    return this.airtableService.Routes();
  }
}
