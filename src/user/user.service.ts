import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // or your DB service

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async getDriversWithId() {
    return this.prisma.user.findMany({
      where: {
        driverId: {
          not: null, // must not be null
        },
      },
      select: {
        driverId: true,
        firstname: true,
      },
    });
  }
}
