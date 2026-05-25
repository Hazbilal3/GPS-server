/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from 'src/prisma.service';
import { Prisma, User } from '@prisma/client';


// [NEW HELPER]
// This is the standard ISO week calculation. We need it for our new functions.
function getISOWeek(date: Date): number {
  const tempDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // Set to Thursday of the same week
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  // Calculate week number
  return Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

// [NEW HELPER]
// This is the core logic for the Sat-Fri week.
// It finds the Friday that *ends* the pay period for any given date.
function getPayrollWeekKey(date: Date): {
  key: number;
  periodStart: Date;
  periodEnd: Date;
} {
  const tempDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = tempDate.getUTCDay(); // 0=Sun, 6=Sat

  // Formula to find days to add to get to the next Friday
  // If Sat (6), adds 6 days. If Fri (5), adds 0 days. If Sun (0), adds 5 days.
  const daysToAdd = (5 - dayNum + 7) % 7;

  const periodEnd = new Date(tempDate);
  periodEnd.setUTCDate(tempDate.getUTCDate() + daysToAdd); // This is the Friday (end)

  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodEnd.getUTCDate() - 6); // This is the Saturday (start)

  const year = periodEnd.getUTCFullYear();
  const week = getISOWeek(periodEnd); // Get ISO week of the ending Friday

  // Create a unique key: e.g., 202546
  const key = year * 100 + week;
  return { key, periodStart, periodEnd };
}

// [REPLACE THIS FUNCTION]
// We now group by the new 'weekKey' (e.g., 202546)
function groupUploadsByWeek(uploads: any[]): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const upload of uploads) {
    const date = new Date(upload.createdAt);
    const { key } = getPayrollWeekKey(date); // Use our new helper
    const weekKey = String(key); // e.g., "202546"
    if (!result[weekKey]) result[weekKey] = [];
    result[weekKey].push(upload);
  }
  return result;
}

// [REPLACE THIS FUNCTION]
// This now decodes the 'weekKey' (e.g., 202546) back into a Sat-Fri date range
function getWeekDateRange(weekKey: number): string {
  const year = Math.floor(weekKey / 100);
  const week = weekKey % 100;

  // Find the Friday of the target ISO week and year
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const firstDayOfWeek = firstDayOfYear.getUTCDay() || 7; // 1=Mon, 7=Sun
  const thursdayOfWeek1 = new Date(firstDayOfYear);
  thursdayOfWeek1.setUTCDate(firstDayOfYear.getUTCDate() + (4 - firstDayOfWeek));

  const targetFriday = new Date(thursdayOfWeek1);
  targetFriday.setUTCDate(thursdayOfWeek1.getUTCDate() + (week - 1) * 7 + 1); // +1 from Thu to Fri

  // Find the Saturday (6 days before)
  const targetSaturday = new Date(targetFriday);
  targetSaturday.setUTCDate(targetFriday.getUTCDate() - 6);

  const f = targetFriday.toISOString().slice(0, 10);
  const s = targetSaturday.toISOString().slice(0, 10);
  return `${s} - ${f}`;
}

// --------


// --- THIS IS THE MODIFIED INTERFACE ---
// It now perfectly matches the `Payroll` model from `schema.prisma`
export interface PayrollRecord {
  driverId: number;
  driverName: string;
  zipCode: string | null; // <-- FIX: Allows null
  address?: string | null; // <-- FIX: Allows null
  weekNumber: number; // <-- FIX: Is non-nullable
  payPeriod: string | null; // <-- FIX: Allows null
  paycheck?: string;
  salaryType: string | null; // <-- FIX: Allows null
  stopsCompleted: number;
  totalDeliveries: number | null; // <-- FIX: Allows null
  rate?: number;
  amount: number;
  totalDeduction: number;
  totalBonus: number;
  netPay: number; // <-- FIX: Is non-nullable
  zipBreakdown?: Prisma.JsonValue;
  createdAt?: Date;
}
// ----------------------------------------


function getUtcDayBounds(yyyyMmDd: string) {
  const start = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const end = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (isNaN(start.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return { start, end };
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private routeCache: { data: any[]; expiresAt: number } | null = null;
  private readonly ROUTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) {}

  async processExcel(
    file: Express.Multer.File,
    driverId: number,
    date?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { driverId } });
    if (!user)
      throw new NotFoundException(`Driver with ID ${driverId} not found`);

    const fkValue = user.driverId;

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Validate format against header row, not first data row
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    const headers = (rawRows[0] ?? []) as string[];
    if (!headers.includes('Name') || !headers.includes('Pieces')) {
      throw new BadRequestException(
        'Invalid file format. Upload the new manifest format with columns: Name, Status, Pieces, Sequence, City, Zip, Address.',
      );
    }

    const sheet = XLSX.utils.sheet_to_json(worksheet);

    const createdAtOverride = date ? new Date(`${date}T12:00:00Z`) : undefined;
    const dbDriverMatch = await this.prisma.user.findFirst({
      where: { driverId },
      select: { salaryType: true, fixedSalary: true },
    });
    const currentSalaryType = dbDriverMatch?.salaryType || 'Regular';
    const currentFixedRate = dbDriverMatch?.fixedSalary || 0;

    const uploads: any[] = [];

    const transactionResult = await this.prisma.$transaction(
      async (prisma) => {
        for (const row of sheet as any[]) {
          const recipientName = String(row['Name'] ?? '').trim();
          const statusNum = Number(row['Status'] ?? 0);
          const lastEvent = statusNum === 3 ? 'delivered' : statusNum === 2 ? 'attempted' : `status_${statusNum}`;
          const pieces = Number(row['Pieces'] ?? 1) || 1;
          const sequenceNo = String(row['Sequence'] ?? '');
          const rawZip = String(row['Zip'] ?? '');
          const zipCode = rawZip.split('-')[0].trim().padStart(5, '0');
          const city = String(row['City'] ?? '').trim();
          const addressRaw = String(row['Address'] ?? '').trim();

          const saved = await prisma.upload.create({
            data: {
              driverId: fkValue,
              barcode: recipientName,
              sequenceNo,
              lastevent: lastEvent,
              address: addressRaw,
              pieces,
              zipCode,
              city,
              salaryType: currentSalaryType,
              rate: currentSalaryType.toLowerCase().includes('fixed') ? currentFixedRate : null,
              createdAt: createdAtOverride || new Date(),
            },
          });
          uploads.push(saved);
        }

        if (uploads.length > 0) {
          this.logger.log(`Uploads saved for driver ${driverId}. Recalculating payroll...`);
          const uploadDate = createdAtOverride || new Date();
          await this.calculateAndSavePayrollForDriver(driverId, user, prisma, uploadDate);
        }

        return {
          message: 'Upload successful',
          uploadedCount: uploads.length,
        };
      },
      { maxWait: 500000, timeout: 500000 },
    );

    return transactionResult;
  }

// [REPLACE THIS ENTIRE FUNCTION]
async deleteByDriverAndDate(driverId: number, dateStr: string) {
  const { start, end } = getUtcDayBounds(dateStr);

  // 1. Delete uploads for that day
  const result = await this.prisma.upload.deleteMany({
    where: {
      driverId,
      createdAt: { gte: start, lt: end },
    },
  });

  if (result.count === 0) {
    this.logger.warn(`No uploads found to delete for ${driverId} on ${dateStr}`);
    // Still, we should run a recalc in case this was an orphan payroll week
  }

  const user = await this.prisma.user.findUnique({ where: { driverId } });
  if (!user) {
    this.logger.warn(`No user found for driverId ${driverId}`);
    return { driverId, date: dateStr, deleted: result.count };
  }

  // 2. --- FIX: Use the NEW payroll week logic ---
  // Get the payroll week key (e.g., 202546) and the Sat-Fri date range
  const deletedDate = new Date(`${dateStr}T12:00:00.000Z`); // Use noon to avoid TZ issues
  const {
    key: weekKey,
    periodStart,
    periodEnd,
  } = getPayrollWeekKey(deletedDate);

  // 3. Check for remaining uploads *within that Sat-Fri week*
  // We must add 1 day to periodEnd for the 'lt' (less than) query
  const queryEndDate = new Date(periodEnd);
  queryEndDate.setUTCDate(queryEndDate.getUTCDate() + 1);

  const remainingUploads = await this.prisma.upload.count({
    where: {
      driverId,
      createdAt: { gte: periodStart, lt: queryEndDate }, // Use the correct Sat-Fri range
    },
  });

  // 4. Act based on remaining uploads
  if (remainingUploads === 0) {
    // No uploads left in this Sat-Fri week, so delete the weekly payroll record
    const deletedPayroll = await this.prisma.payroll.deleteMany({
      where: {
        driverId,
        weekNumber: weekKey, // <-- Use the correct payroll week key
      },
    });

    this.logger.warn(
      `🧾 Deleted payroll record for driver ${driverId} | week ${weekKey} because all uploads were removed.`,
    );

    return {
      driverId,
      date: dateStr,
      deletedUploads: result.count,
      deletedPayroll: deletedPayroll.count,
      message: 'Uploads and corresponding weekly payroll deleted.',
    };
  } else {
    // Uploads still exist, so just trigger a recalculation for the driver
    // calculateAndSavePayrollForDriver will recalculate ALL weeks for this driver,
    // which correctly updates the modified week.
    this.logger.log(
      `Uploads deleted for driver ${driverId}, recalculating affected week...`,
    );
    const deletedDate = new Date(`${dateStr}T12:00:00.000Z`);
    await this.calculateAndSavePayrollForDriver(driverId, user, this.prisma, deletedDate);

    return {
      driverId,
      date: dateStr,
      deletedUploads: result.count,
      message: 'Uploads deleted; weekly payroll recalculated.',
  };
  }
}

  /**
   * NEW: This function recalculates and saves payroll for ALL drivers.
   * Triggered by the new controller endpoint.
   */
  async deletePayrollByWeek(weekNumber: number) {
    this.logger.warn(`🗑️ Deleting all payroll records for week ${weekNumber}`);
    return await this.prisma.payroll.deleteMany({
      where: { weekNumber },
    });
  }

  async recalculateAllPayroll() {
    this.logger.log('Starting global payroll recalculation for all drivers...');
    const drivers = await this.prisma.user.findMany({
      where: { driverId: { not: null } },
    });
    let successCount = 0;
    let errorCount = 0;

    for (const driver of drivers) {
      try {
        await this.calculateAndSavePayrollForDriver(
          driver.driverId!,
          driver,
          this.prisma,
        );
        successCount++;
        this.logger.log(
          `Successfully recalculated payroll for driver: ${driver.fullName}`,
        );
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Failed to recalculate payroll for driver: ${driver.fullName}`,
          error.stack,
        );
      }
    }

    const message = `Global payroll recalculation complete. Success: ${successCount}, Failed: ${errorCount}`;
    this.logger.log(message);
    return { message, successCount, errorCount };
  }

  /**
   * NEW: This is the core logic, refactored into a private method.
   * It calculates payroll for a single driver and saves it to the DB.
   * Can be used within a transaction.
   */
  private async calculateAndSavePayrollForDriver(
    driverId: number,
    driver: User,
    prisma: Prisma.TransactionClient | PrismaService,
    uploadDate?: Date,
  ) {
    const driverName = driver.fullName;

    // 1. Fetch routes and driver's salary info from User table
    const [airtableRoutes, dbDriver, existingPayrolls] = await Promise.all([
      this.getAirtableRoutes(),
      this.prisma.user.findFirst({
        where: { driverId },
        select: { salaryType: true, fixedSalary: true },
      }),
      this.prisma.payroll.findMany({
        where: { driverId },
        select: {
          weekNumber: true,
          salaryType: true,
          zipBreakdown: true,
          totalDeduction: true,
          totalBonus: true,
          remarks: true
        },
      }),
    ]);

    if (!dbDriver) {
      this.logger.warn(
        `❌ No User record found for driverId ${driverId} (${driverName}). Skipping payroll.`,
      );
      return;
    }

    // 2. Fetch uploads for this driver
const driverUploads = await prisma.upload.findMany({
  where: {
    driverId,
    lastevent: {
      contains: 'delivered',
      mode: 'insensitive',
    },
  },
  select: { address: true, createdAt: true, salaryType: true, rate: true, pieces: true, zipCode: true },
});



    if (driverUploads.length === 0) {
      this.logger.warn(`No 'delivered' uploads found for ${driverName}.`);
      // --- FIX: We should still save a $0 payroll record if they have no uploads ---
      // This allows deductions to be applied to a $0 payroll.
      // Let's check if they have *any* payroll weeks.
      const existingPayrollWeeks = await prisma.payroll.findMany({
        where: { driverId },
        select: { weekNumber: true },
      });
      if (existingPayrollWeeks.length === 0) {
         this.logger.warn(`No uploads and no past payroll for ${driverName}. Skipping.`);
         return;
      }
      // If they have past payroll, we can assume we should continue
      // and process $0 weeks.
    }

    // 3. Group uploads by week
    const uploadsByWeek = groupUploadsByWeek(driverUploads);

    // --- Helpers ---
    const normalizeZip = (zip?: string): string | null => {
      if (!zip) return null;
      // Address format: "STREET. CITY. STATE. ZIP" — scan from last segment
      // so street/unit numbers (e.g. "1212", "1411") are never mistaken for zip codes.
      const parts = zip.split('.').map(p => p.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const m = parts[i].match(/^(\d{4,5})(?:-\d{4})?$/);
        if (m) {
          let z = m[1];
          if (z.length === 4) z = '0' + z;
          return z;
        }
      }
      return null;
    };

    const extractRouteZips = (route: any): string[] => {
      if (!route.zipCode) return [];
      const raw = Array.isArray(route.zipCode)
        ? route.zipCode
        : String(route.zipCode).split(/[, ]+/);
      return raw.map((z) => normalizeZip(String(z))).filter(Boolean) as string[];
    };

    // Build zip→route index once (O(routes×zips)) instead of scanning on every zip lookup
    const zipToRoute = new Map<string, any>();
    for (const route of airtableRoutes) {
      for (const zip of extractRouteZips(route)) {
        if (!zipToRoute.has(zip)) zipToRoute.set(zip, route);
      }
    }

    // 4. Loop through each week and calculate
    for (const [weekNumberStr, weekUploads] of Object.entries(uploadsByWeek)) {
      const weekNumber = Number(weekNumberStr);
      const totalStops = weekUploads.reduce((sum, u) => sum + (u.pieces ?? 1), 0);

      // When called from a specific upload event, only recalculate the affected week.
      // All other weeks already have correct payroll — skip them to prevent
      // route/salary-type changes from rewriting historical records.
      if (uploadDate) {
        const { key: targetWeekKey } = getPayrollWeekKey(uploadDate);
        if (weekNumber !== targetWeekKey) continue;
      }

      // Group week uploads by day
      const weekUploadsByDay: Record<string, any[]> = {};
      for (const upload of weekUploads) {
        const dateKey = upload.createdAt.toISOString().split('T')[0];
        if (!weekUploadsByDay[dateKey]) weekUploadsByDay[dateKey] = [];
        weekUploadsByDay[dateKey].push(upload);
      }

      // --- FIX: Fetch existing record to check daily history ---
      const existing = existingPayrolls.find((p) => p.weekNumber === weekNumber);
      const existingBreakdown = (existing?.zipBreakdown as any[]) || [];

      let weeklySubtotal = 0;
      const zipBreakdown: any[] = [];
      const usedSalaryTypes = new Set<string>();

      // Iterate through each day in the week
      for (const [dateKey, dayUploads] of Object.entries(weekUploadsByDay)) {
        // --- NEW: Use the salary type CAPTURED on the upload itself ---
        // If multiple uploads on same day have different types (rare), we'll use the most frequent one
        const typesOnDay = dayUploads.map(u => (u.salaryType || '').toLowerCase()).filter(Boolean);
        let daySalaryType = typesOnDay.length > 0 ? typesOnDay[0] : (dbDriver.salaryType || 'regular').toLowerCase();

        // Normalize
        if (daySalaryType.includes('fixed')) daySalaryType = 'fixed rate';
        else if (daySalaryType.includes('company')) daySalaryType = 'company vehicle';
        else daySalaryType = 'regular';

        usedSalaryTypes.add(daySalaryType);

        if (daySalaryType === 'fixed rate') {
          // Use captured rate if available, otherwise current
          const capturedRate = dayUploads.find(u => u.rate > 0)?.rate;
          const fixedRatePerStop = capturedRate || dbDriver.fixedSalary || 0;
          const deliveredStops = dayUploads.reduce((sum, u) => sum + (u.pieces ?? 1), 0);
          const dayAmount = Number((fixedRatePerStop * deliveredStops).toFixed(2));
          weeklySubtotal += dayAmount;
          zipBreakdown.push({
            zip: 'N/A',
            date: dateKey,
            stops: deliveredStops,
            rate: fixedRatePerStop,
            amount: dayAmount,
            salaryType: 'Fixed Rate'
          });
        } else {
          // Regular logic for this day
          const dayZips: Record<string, number> = {};
          for (const upload of dayUploads) {
            const zip = upload.zipCode || normalizeZip(upload.address);
            if (zip) dayZips[zip] = (dayZips[zip] || 0) + (upload.pieces ?? 1);
          }

          for (const [zip, stopCount] of Object.entries(dayZips)) {
            const route = zipToRoute.get(zip) ?? zipToRoute.get(zip.padStart(5, '0'));
            // For existing records: always prefer the stored historical rate.
            // This prevents route rate changes or deletions from rewriting past payroll.
            const hist = existingBreakdown.find(b => b.zip === zip && b.rate > 0);
            let rate = 0;
            if (hist) {
              rate = hist.rate;
            } else if (route) {
              if (daySalaryType.includes('company vehicle')) rate = route.ratePerStopCompanyVehicle || 0;
              else rate = route.ratePerStop || 0;
            }
            
            const amount = stopCount * rate;
            weeklySubtotal += amount;
            zipBreakdown.push({
              zip,
              date: dateKey,
              stops: stopCount,
              rate,
              amount,
              salaryType: daySalaryType.includes('company') ? 'Company Vehicle' : 'Regular'
            });
          }
        }
      }

      const finalAmount = Number(weeklySubtotal.toFixed(2));
      const displaySalaryType = usedSalaryTypes.size > 1 ? 'Mixed' : 
                               Array.from(usedSalaryTypes)[0] === 'fixed rate' ? 'Fixed Rate' :
                               Array.from(usedSalaryTypes)[0] === 'company vehicle' ? 'Company Vehicle' : 'Regular';

      // 5. --- Save to DB using upsert ---
      try {
        const totalDeduction = existing?.totalDeduction || 0;
        const totalBonus = existing?.totalBonus || 0;
        const netPay = finalAmount - totalDeduction + totalBonus;

        const allZipsUsed = Array.from(new Set(zipBreakdown.map(z => z.zip).filter(z => z !== 'N/A')));
        const payrollData = {
          driverId,
          driverName: String(driverName),
          weekNumber,
          payPeriod: getWeekDateRange(weekNumber),
          salaryType: displaySalaryType,
          zipCode: allZipsUsed.join(', ') || null,
          totalDeliveries: totalStops,
          stopsCompleted: totalStops,
          amount: finalAmount,
          totalDeduction,
          totalBonus,
          netPay,
          remarks: existing?.remarks || null,
          zipBreakdown: zipBreakdown.length > 0 ? zipBreakdown : Prisma.JsonNull, // Save breakdown
        };

        await prisma.payroll.upsert({
          where: { driverId_weekNumber: { driverId, weekNumber } },
          update: payrollData,
          create: payrollData,
        });

        this.logger.log(
          `✅ Upserted payroll for ${driverName} | Week ${weekNumber} | Amount: ${finalAmount}`,
        );
      } catch (error) {
        this.logger.error(
        `❌ Failed to upsert payroll for ${driverName} | Week ${weekNumber}`,
          error.stack,
        );
      }
    }
  }

  /**
   * REWRITTEN: Get all payroll, now reads from the DB
   */
  async getDriverPayroll(): Promise<any[]> {
    // --- FIX: Added explicit select to ensure zipBreakdown is fetched ---
    const payrollData = await this.prisma.payroll.findMany({
      select: {
        id: true,
        driverId: true,
        driverName: true,
        weekNumber: true,
        payPeriod: true,
        salaryType: true,
        totalDeliveries: true,
        amount: true,
        totalDeduction: true,
        totalBonus: true,
        netPay: true,
        remarks: true,
        zipBreakdown: true, // <-- Explicitly select zipBreakdown
      },
      orderBy: {
        weekNumber: 'desc',
      },
    });

    // --- Group payroll by week (to match existing output format) ---
    const groupedPayroll = Object.entries(
      payrollData.reduce((acc, record) => {
        const week = record.weekNumber;
        if (typeof week !== 'number') return acc;
        if (!acc[week]) acc[week] = [];
        // The record now perfectly matches PayrollRecord, so this push is safe
        acc[week].push(record as unknown as PayrollRecord); // Cast to PayrollRecord
        return acc;
      }, {} as Record<number, PayrollRecord[]>),
    ).map(([weekNumber, records]) => ({
      weekNumber: Number(weekNumber),
      payPeriod: records[0]?.payPeriod || '',
      totalStops: records.reduce((sum, r) => sum + (r.totalDeliveries || 0), 0),
      subtotal: Number(
        records.reduce((sum, r) => sum + (r.amount || 0), 0).toFixed(2),
      ),
      totalDeductions: Number(
        records.reduce((sum, r) => sum + (r.totalDeduction || 0), 0).toFixed(2),
      ),
      totalBonuses: Number(
        records.reduce((sum, r) => sum + ((r as any).totalBonus || 0), 0).toFixed(2),
      ),
      netPay: Number(
        records.reduce((sum, r) => sum + (r.netPay || 0), 0).toFixed(2),
      ),
      drivers: records.map((r) => ({
        driverId: r.driverId, // Pass driverId to frontend
        driverName: r.driverName,
        salaryType: r.salaryType,
        totalStops: r.totalDeliveries,
        subtotal: r.amount,
        totalDeduction: r.totalDeduction,
        totalBonus: (r as any).totalBonus || 0,
        netPay: r.netPay,
        remarks: (r as any).remarks || '',
        bonusRemarks: (r as any).bonusRemarks || '',
        zipBreakdown: r.zipBreakdown ?? [], // <-- This line should now work
      })),
    }));

    return groupedPayroll;
  }

  /**
   * REWRITTEN: Get payroll by driver, now reads from the DB
   */
  async getPayrollByDriver(driverId: number): Promise<any[]> {
    const driverPayroll = await this.prisma.payroll.findMany({
      where: { driverId },
      orderBy: {
        weekNumber: 'desc',
      },
      // --- FIX: Add select to ensure all fields are returned ---
      select: {
        weekNumber: true,
        payPeriod: true,
        salaryType: true,
        stopsCompleted: true,
        amount: true,
        totalDeduction: true,
        totalBonus: true,
        netPay: true,
        remarks: true,
        bonusRemarks: true,
        zipBreakdown: true, // <-- Explicitly select zipBreakdown
      },
    });

    if (!driverPayroll) {
      return [];
    }

    // Format to match old output (simplified)
    return driverPayroll.map((record) => ({
      weekNumber: record.weekNumber,
      payPeriod: record.payPeriod,
      salaryType: record.salaryType,
      totalStops: record.stopsCompleted,
      subtotal: record.amount,
      totalDeduction: record.totalDeduction,
      totalBonus: (record as any).totalBonus || 0,
      netPay: record.netPay,
      remarks: record.remarks,
      bonusRemarks: (record as any).bonusRemarks || '',
      zipBreakdown: record.zipBreakdown ?? [], // <-- FIX: Return the zipBreakdown
    }));
  }

  /**
   * FIXED: This will now find the record and update it.
   */
  async updatePayrollDeduction({
    driverId,
    weekNumber,
    totalDeduction,
    remarks,
  }: {
    driverId: number;
    weekNumber: number;
    totalDeduction: number;
    remarks?: string;
  }) {
    // This query now uses the compound unique index
    const existing = await this.prisma.payroll.findUnique({
      where: {
        driverId_weekNumber: { driverId, weekNumber },
      },
    });

    if (!existing) {
      this.logger.error(
        `Payroll not found for driverId ${driverId}, week ${weekNumber}`,
      );
      // Throw a user-friendly error
      throw new NotFoundException(
        `Payroll record not found for driver ${driverId}, week ${weekNumber}. It may need to be calculated first.`,
      );
    }

    const netPay = existing.amount - totalDeduction + (existing.totalBonus || 0);

    try {
      return await this.prisma.payroll.update({
        where: {
          id: existing.id, // Update by the primary key
       },
        data: {
          totalDeduction,
          netPay,
          remarks: remarks ?? existing.remarks,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update deduction for driver ${driverId}, week ${weekNumber}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update payroll.');
    }
  }

  async getDailyPayroll(driverId?: number): Promise<any[]> {
    this.logger.log(`Fetching daily payroll... Driver: ${driverId ?? 'All'}`);

    // 1. Get relevant user IDs
    const driverFilter = driverId ? { driverId } : { driverId: { not: null } };
    const drivers = await this.prisma.user.findMany({ where: driverFilter });
    const driverIds = drivers.map((d) => d.driverId).filter(Boolean) as number[];
    if (driverIds.length === 0) return [];

    // 2. Read stored weekly payroll records — these hold historically-accurate
    //    amounts (rates frozen at upload time, not recalculated from current routes).
    const storedPayrolls = await this.prisma.payroll.findMany({
      where: { driverId: { in: driverIds } },
      select: {
        driverId: true,
        driverName: true,
        weekNumber: true,
        totalDeduction: true,
        totalBonus: true,
        zipBreakdown: true,
      },
      orderBy: { weekNumber: 'desc' },
    });

    // 3. Derive daily records from stored zipBreakdown (each entry has a date field)
    const dailyRecords: {
      driverId: number;
      driverName: string | null;
      date: string;
      totalStops: number;
      subtotal: number;
      deduction: number;
      bonus: number;
      netPay: number;
    }[] = [];

    for (const payroll of storedPayrolls) {
      const breakdown = (payroll.zipBreakdown as any[]) || [];

      // Group breakdown entries by date (only new-format records include date)
      const byDate: Record<string, any[]> = {};
      for (const entry of breakdown) {
        if (!entry.date) continue;
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
      }

      const numDays = Object.keys(byDate).length || 1;
      const proratedDeduction = (payroll.totalDeduction || 0) / numDays;
      const proratedBonus = ((payroll.totalBonus as number) || 0) / numDays;

      for (const [date, entries] of Object.entries(byDate)) {
        const totalStops = entries.reduce((s: number, e: any) => s + (e.stops || 0), 0);
        const subtotal = entries.reduce((s: number, e: any) => s + (e.amount || 0), 0);
        const netPay = subtotal - proratedDeduction + proratedBonus;

        dailyRecords.push({
          driverId: payroll.driverId,
          driverName: payroll.driverName,
          date,
          totalStops,
          subtotal: Number(subtotal.toFixed(2)),
          deduction: Number(proratedDeduction.toFixed(2)),
          bonus: Number(proratedBonus.toFixed(2)),
          netPay: Number(netPay.toFixed(2)),
        });
      }
    }

    return dailyRecords.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.driverName || '').localeCompare(b.driverName || ''),
    );
  }
  async getAirtableRoutes(): Promise<any[]> {
    const now = Date.now();
    if (this.routeCache && now < this.routeCache.expiresAt) {
      return this.routeCache.data;
    }
    const routes = await this.prisma.route.findMany();
    this.routeCache = { data: routes, expiresAt: now + this.ROUTE_CACHE_TTL_MS };
    return routes;
  }


  async updateRoute(
    id: number,
    data: {
      ratePerStop?: number;
      ratePerStopCompanyVehicle?: number;
      baseRate?: number;
      baseRateCompanyVehicle?: number;
    },
  ) {
    const updateData: any = {};
    if (data.ratePerStop !== undefined) updateData.ratePerStop = Number(data.ratePerStop);
    if (data.ratePerStopCompanyVehicle !== undefined) updateData.ratePerStopCompanyVehicle = Number(data.ratePerStopCompanyVehicle);
    if (data.baseRate !== undefined) updateData.baseRate = Number(data.baseRate);
    if (data.baseRateCompanyVehicle !== undefined) updateData.baseRateCompanyVehicle = Number(data.baseRateCompanyVehicle);
    this.routeCache = null;
    const updated = await this.prisma.route.update({ where: { id }, data: updateData });
    this.logger.log('Route ' + id + ' rates updated. Future payroll will use new rates.');
    return updated;
  }
  async updatePayrollBonus({
    driverId,
    weekNumber,
    totalBonus,
    bonusRemarks,
  }: {
    driverId: number;
    weekNumber: number;
    totalBonus: number;
    bonusRemarks?: string;
  }) {
    const existing = await this.prisma.payroll.findUnique({
      where: { driverId_weekNumber: { driverId, weekNumber } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Payroll record not found for driver ${driverId}, week ${weekNumber}.`,
      );
    }
    const netPay = existing.amount - (existing.totalDeduction || 0) + totalBonus;
    return this.prisma.payroll.update({
      where: { id: existing.id },
      data: { totalBonus, netPay, bonusRemarks: bonusRemarks ?? existing['bonusRemarks'] ?? null },
    });
  }

  async createRoute(data: {
    routeNumber?: string;
    description: string;
    ratePerStop: number;
    ratePerStopCompanyVehicle?: number;
    baseRate?: number;
    baseRateCompanyVehicle?: number;
    zone?: string;
    status?: string;
    zipCode?: string[];
    schedule?: string[];
  }) {
    this.routeCache = null;
    return this.prisma.route.create({
      data: {
        routeNumber: data.routeNumber || null,
        description: data.description,
        ratePerStop: Number(data.ratePerStop),
        ratePerStopCompanyVehicle: data.ratePerStopCompanyVehicle ? Number(data.ratePerStopCompanyVehicle) : null,
        baseRate: data.baseRate ? Number(data.baseRate) : null,
        baseRateCompanyVehicle: data.baseRateCompanyVehicle ? Number(data.baseRateCompanyVehicle) : null,
        zone: data.zone || null,
        status: data.status || 'Active',
        zipCode: data.zipCode || [],
      },
    });
  }

  async deleteRoute(id: number) {
    this.routeCache = null;
    const deleted = await this.prisma.route.delete({ where: { id } });
    this.logger.log('Route ' + id + ' deleted.');
    return deleted;
  }
}
