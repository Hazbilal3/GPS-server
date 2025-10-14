// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AirtableController } from './airtable.controller';
import { AirtableService } from './airtable.service';

@Module({
  imports: [],
  providers: [AirtableService],
  controllers: [AirtableController],
})
export class AuthModule {}
