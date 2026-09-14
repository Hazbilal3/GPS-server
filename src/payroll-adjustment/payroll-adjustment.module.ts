import { Module } from '@nestjs/common';
import { PayrollAdjustmentController } from './payroll-adjustment.controller';
import { PayrollAdjustmentService } from './payroll-adjustment.service';

@Module({
  controllers: [PayrollAdjustmentController],
  providers: [PayrollAdjustmentService],
})
export class PayrollAdjustmentModule {}
