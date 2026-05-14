import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DriverDocumentsService {
  constructor(private prisma: PrismaService) {}

  async getDocuments(driverId: number) {
    return this.prisma.driverDocument.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(driverId: number, file: Express.Multer.File, description: string) {
    return this.prisma.driverDocument.create({
      data: {
        driverId,
        fileName: file.originalname,
        storedName: file.filename,
        description,
        fileUrl: `/driver-documents/file/${file.filename}`,
      },
    });
  }

  async deleteDocument(id: number) {
    const doc = await this.prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    const filePath = path.join('./uploads/driver-documents', doc.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return this.prisma.driverDocument.delete({ where: { id } });
  }

  async approveDocument(id: number) {
    const doc = await this.prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return this.prisma.driverDocument.update({ where: { id }, data: { status: 'verified' } });
  }
}