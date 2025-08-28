import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReportFilterDto } from './dto/report.dto';
import { Response } from 'express';
import { parse } from 'json2csv';
import { Prisma, Upload } from '@prisma/client';
import { DateTime } from 'luxon';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}
  private MAX_EXPORT_LIMIT = 10000;
  async getUploadReport(filters: ReportFilterDto & { isExport?: boolean }) {
    // Convert and validate pagination parameters
    const page = filters.page ? Number(filters.page) : 1;
    let limit = filters.limit ? Number(filters.limit) : 10;
    if (isNaN(limit)) limit = 10;
    if (limit <= 0) limit = 10;
    if (limit > 100 && !filters.isExport) {
      limit = 100;
    }
    const skip = (page - 1) * limit;
    const whereClause = this.buildWhereClause(filters);
    try {
      const [data, total] = await Promise.all([
        this.prisma.upload.findMany({
          where: whereClause,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
            exports: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.upload.count({ where: whereClause }),
      ]);
      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch report data');
    }
  }
  async exportToCsv(filters: ReportFilterDto, res: Response) {
    const { page, limit, ...exportFilters } = filters;
    try {
      // Process in batches using cursor pagination
      let cursor: number | undefined;
      let hasMore = true;
      const allData: Prisma.UploadGetPayload<{
        include: {
          user: {
            select: {
              fullName: true;
              email: true;
            };
          };
          exports: true;
        };
      }>[] = [];
      while (hasMore) {
        const batch = await this.prisma.upload.findMany({
          where: this.buildWhereClause(exportFilters),
          take: 1000,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
            exports: true,
          },
          orderBy: {
            id: 'asc',
          },
        });
        if (batch.length > 0) {
          allData.push(...batch);
          cursor = batch[batch.length - 1].id;
        } else {
          hasMore = false;
        }
        if (allData.length >= this.MAX_EXPORT_LIMIT) {
          hasMore = false;
        }
      }
      const fields = [
        { label: 'ID', value: 'id' },
        { label: 'Barcode', value: 'barcode' },
        { label: 'Address', value: 'address' },
        { label: 'Status', value: 'status' },
        {
          label: 'Created At',
          value: (row: any) => row.createdAt.toISOString(),
        },
        {
          label: 'Driver Name',
          value: (row: any) => row.user?.fullName.trim(),
        },
        {
          label: 'Driver Email',
          value: (row: any) => row.user?.email || '',
        },
        { label: 'GPS Location', value: 'gpsLocation' },
        { label: 'Expected Latitude', value: 'expectedLat' },
        { label: 'Expected Longitude', value: 'expectedLng' },
        { label: 'Distance (km)', value: 'distanceKm' },
        { label: 'Google Maps Link', value: 'googleMapsLink' },
      ];
      const csv = parse(allData.slice(0, this.MAX_EXPORT_LIMIT), { fields });
      res.header('Content-Type', 'text/csv');
      res.attachment(`uploads-report-${new Date().toISOString()}.csv`);
      return res.send(csv);
    } catch (error) {
      throw new BadRequestException('Failed to generate CSV export');
    }
  }
  private buildWhereClause(
    filters: Omit<ReportFilterDto, 'page' | 'limit'>,
  ): Prisma.UploadWhereInput {
    const where: Prisma.UploadWhereInput = {};
    if (filters.driverId) {
      where.driverId = Number(filters.driverId);
    }
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    return where;
  }
}
