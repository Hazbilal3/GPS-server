import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DriverScheduleService {
  constructor(private prisma: PrismaService) {}

  async getWeekSchedule(weekStart: string): Promise<any[]> {
    const [y, m, d] = weekStart.split('-').map(Number);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, m - 1, d + i);
      dates.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      );
    }
    return this.prisma.driverSchedule.findMany({ where: { date: { in: dates } } });
  }

  // weekDates: the 7 YYYY-MM-DD strings for this week (Sat–Fri)
  // entries: only the "off" entries — "available" is the implicit default
  async saveWeekSchedule(
    entries: { driverId: number; driverName: string; date: string; status: string }[],
    weekDates: string[],
  ): Promise<{ saved: number }> {
    if (weekDates.length === 0) return { saved: 0 };
    await this.prisma.$transaction(async (tx) => {
      await tx.driverSchedule.deleteMany({ where: { date: { in: weekDates } } });
      if (entries.length > 0) {
        await tx.driverSchedule.createMany({ data: entries });
      }
    });
    return { saved: entries.length };
  }

  // month is 0-based (JavaScript convention)
  async getMonthSchedule(year: number, month: number): Promise<any[]> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const m1 = month + 1; // convert to 1-based
    const startDate = `${year}-${pad(m1)}-01`;
    const endDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${pad(m1)}-${pad(endDay)}`;
    return this.prisma.driverSchedule.findMany({
      where: { date: { gte: startDate, lte: endDate }, status: 'off' },
    });
  }
}
