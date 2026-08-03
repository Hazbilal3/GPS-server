import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AvailableDriversService {
  constructor(private prisma: PrismaService) {}

  async getAll(): Promise<number[]> {
    const rows = await this.prisma.availableDriver.findMany({ orderBy: { driverId: 'asc' } });
    return rows.map(r => r.driverId);
  }

  async saveAll(driverIds: number[]): Promise<void> {
    await this.prisma.availableDriver.deleteMany();
    if (driverIds.length > 0) {
      await this.prisma.availableDriver.createMany({
        data: driverIds.map(driverId => ({ driverId })),
        skipDuplicates: true,
      });
    }
  }
}
