import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReportFilterDto } from './dto/report.dto';
import { Response } from 'express';
import { parse } from 'json2csv';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getUploadReport(filters: ReportFilterDto) {
  const { driverId, date, startDate, endDate, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;
  
  const whereClause: any = {};
  if (driverId) {
    whereClause.driverId = Number(driverId); // Explicit conversion
  }

  // Date filtering logic remains the same
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    whereClause.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  } else if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  const [data, total] = await Promise.all([
    this.prisma.upload.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        exports: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    this.prisma.upload.count({ where: whereClause }), // Simplified count
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
}

  async exportToCsv(filters: ReportFilterDto, res: Response) {
    // Remove pagination for export
    const { page, limit, ...exportFilters } = filters;
    const data = await this.getUploadReport({ ...exportFilters, page: 1, limit: 1000000 });

    const fields = [
      'id',
      'barcode',
      'address',
      'status',
      'createdAt',
      { label: 'Driver Name', value: 'user.firstname' },
      { label: 'Driver Email', value: 'user.email' },
    ];

    const csv = parse(data.data, { fields });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('uploads-report.csv');
    return res.send(csv);
  }
}