import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { deleteS3File, S3File } from '../s3.storage';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DriverDocumentsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  /**
   * One-time migration: DriverDocument rows previously stored User.driverId
   * (the mutable 4-digit number). This converts them to store User.id
   * (the immutable autoincrement PK) so reassigning a driverId never leaks
   * documents to a new driver. Safe to run on every restart — rows already
   * storing User.id won't match any User.driverId and are untouched.
   */
  async onModuleInit() {
    // This touches every driver/document record and can delay API startup for
    // several minutes against a remote database. Run it explicitly once when
    // a legacy data migration is required, not on each application boot.
    if (process.env.RUN_DRIVER_DOCUMENT_ID_MIGRATION !== 'true') return;

    const users = await this.prisma.user.findMany({
      where: { driverId: { not: null } },
      select: { id: true, driverId: true },
    });
    for (const user of users) {
      if (user.driverId !== null) {
        await this.prisma.driverDocument.updateMany({
          where: { driverId: user.driverId },
          data: { driverId: user.id },
        });
      }
    }
  }

  async getDocuments(driverId: number) {
    const user = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true },
    });
    if (!user) return [];
    return this.prisma.driverDocument.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(driverId: number, file: Express.Multer.File, description: string) {
    const user = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`Driver with driverId ${driverId} not found`);
    const s3File = file as S3File;
    const fileUrl = s3File.location || `/driver-documents/file/${file.filename}`;
    const storedName = s3File.key || file.filename;
    return this.prisma.driverDocument.create({
      data: {
        driverId: user.id,
        fileName: file.originalname,
        storedName,
        description,
        fileUrl,
      },
    });
  }

  async deleteDocument(id: number) {
    const doc = await this.prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    if (doc.fileUrl?.startsWith('https://')) {
      await deleteS3File(doc.storedName);
    } else {
      const filePath = path.join('./uploads/driver-documents', doc.storedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    return this.prisma.driverDocument.delete({ where: { id } });
  }

  async approveDocument(id: number) {
    const doc = await this.prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return this.prisma.driverDocument.update({ where: { id }, data: { status: 'verified' } });
  }
}
