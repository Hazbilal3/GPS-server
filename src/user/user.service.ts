import { Injectable, NotFoundException } from '@nestjs/common';
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
        fullName: true,
        email: true,
        phoneNumber: true
      },
    });
  }

  async deleteByDriverId(driverId: number) {
    const driver = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true, driverId: true, fullName: true ,phoneNumber: true},
    });

    if (!driver) {
      throw new NotFoundException(`Driver with driverId ${driverId} not found`);
    }

    await this.prisma.user.delete({ where: { id: driver.id } });

    return {
      message: 'Driver deleted successfully',
      deletedUserId: driver.id,
      driverId: driver.driverId,
      fullName: driver.fullName,
    };
  }
}
