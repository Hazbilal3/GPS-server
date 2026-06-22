import { Module } from '@nestjs/common';
import { PayrollOverrideController } from './payroll-override.controller';
import { PayrollOverrideService } from './payroll-override.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PayrollOverrideController],
  providers: [PayrollOverrideService, PrismaService],
})
export class PayrollOverrideModule {}
