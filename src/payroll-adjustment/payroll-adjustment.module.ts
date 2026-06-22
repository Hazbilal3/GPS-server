import { Module } from '@nestjs/common';
import { PayrollAdjustmentController } from './payroll-adjustment.controller';
import { PayrollAdjustmentService } from './payroll-adjustment.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PayrollAdjustmentController],
  providers: [PayrollAdjustmentService, PrismaService],
})
export class PayrollAdjustmentModule {}
