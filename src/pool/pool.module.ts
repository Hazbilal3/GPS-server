import { Module } from '@nestjs/common';
import { PoolController } from './pool.controller';
import { PoolService } from './pool.service';
import { PrismaModule } from '../prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'secret' })],
  controllers: [PoolController],
  providers: [PoolService],
})
export class PoolModule {}
