import { Module } from '@nestjs/common';
import { PayrollOverrideController } from './payroll-override.controller';
import { PayrollOverrideService } from './payroll-override.service';

@Module({
  controllers: [PayrollOverrideController],
  providers: [PayrollOverrideService],
})
export class PayrollOverrideModule {}
