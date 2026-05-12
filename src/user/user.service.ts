import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDriverDto, UpdateDriverDto } from './user.entity';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async getDriversWithId() {
    return this.prisma.user.findMany({
      where: { driverId: { not: null } },
      select: {
        driverId: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        salaryType: true,
        fixedSalary: true,
        schedule: true,
        status: true,
        driverAvailableToday: true,
      },
    });
  }

  async deleteByDriverId(driverId: number) {
    const driver = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true, driverId: true, fullName: true, phoneNumber: true },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with driverId ${driverId} not found`);
    }

    try {
      await this.prisma.$transaction(async (prisma) => {
        // Export references User.id and Upload.id, so delete it first
        await prisma.export.deleteMany({ where: { driverId: driver.id } });
        
        if (driver.driverId !== null) {
          // Upload references User.driverId
          await prisma.upload.deleteMany({ where: { driverId: driver.driverId } });
          // Dispute references User.driverId
          await prisma.dispute.deleteMany({ where: { driverId: driver.driverId } });
          // Payroll references User.driverId
          await prisma.payroll.deleteMany({ where: { driverId: driver.driverId } });
        }
        
        // Finally delete the user
        await prisma.user.delete({ where: { id: driver.id } });
      });
    } catch (error) {
      console.error('Error deleting user/driver:', error);
      throw new InternalServerErrorException('Failed to delete driver: ' + error.message);
    }

    return {
      message: 'Driver deleted successfully',
      deletedUserId: driver.id,
      driverId: driver.driverId,
      fullName: driver.fullName,
    };
  }

  /**
   * Create a new driver (User with non-null driverId).
   * - Ensures required fields
   * - Enforces unique email / phone (if your schema has unique constraints)
   * - Hashes password (optional but recommended)
   */
  async createDriver(dto: CreateDriverDto) {
    const {
      driverId,
      fullName,
      phoneNumber,
      email,
      password,
      userRole = 2,
      adminId,
      salaryType,
      fixedSalary,
      schedule,
      status,
      driverAvailableToday,
    } = dto;

    if (!driverId) {
      throw new BadRequestException('driverId is required');
    }
    if (!fullName || !phoneNumber || !email || !password) {
      throw new BadRequestException(
        'fullName, phoneNumber, email, and password are required',
      );
    }

    // Check uniqueness (optional but helpful before hitting DB unique constraints)
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    const existingByPhone = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });
    if (existingByPhone) {
      throw new ConflictException('Phone number already in use');
    }

    // If driverId is unique in your schema, you can pre-check it too:
    const existingByDriverId = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true },
    });
    if (existingByDriverId) {
      throw new ConflictException(`driverId ${driverId} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        adminId: adminId ?? null,
        driverId,
        fullName,
        phoneNumber,
        email,
        password: passwordHash,
        userRole,
        salaryType: salaryType ?? null,
        fixedSalary: fixedSalary ?? null,
        schedule: schedule ?? [],
        status: status ?? 'Active',
        driverAvailableToday: driverAvailableToday ?? false,
      },
      select: {
        id: true,
        driverId: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        userRole: true,
        salaryType: true,
        fixedSalary: true,
        schedule: true,
        status: true,
        driverAvailableToday: true,
      },
    });

    return {
      message: 'Driver created successfully',
      driver: created,
    };
  }

  async savePushToken(driverId: number, pushToken: string) {
    const driver = await this.prisma.user.findFirst({ where: { driverId } });
    if (!driver) throw new NotFoundException(`Driver ${driverId} not found`);
    await this.prisma.user.update({ where: { id: driver.id }, data: { pushToken } });
    return { message: 'Push token saved' };
  }

  async updateByDriverId(driverId: number, dto: UpdateDriverDto) {
    const driver = await this.prisma.user.findFirst({
      where: { driverId },
      select: { id: true, email: true, phoneNumber: true },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with driverId ${driverId} not found`);
    }

    // Prevent conflicts if email/phone are changing
    if (dto.email && dto.email !== driver.email) {
      const conflictEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (conflictEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    if (dto.phoneNumber && dto.phoneNumber !== driver.phoneNumber) {
      const conflictPhone = await this.prisma.user.findUnique({
        where: { phoneNumber: dto.phoneNumber },
        select: { id: true },
      });
      if (conflictPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // Optional: allow updating password
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: driver.id },
      data: {
        fullName: dto.fullName ?? undefined,
        phoneNumber: dto.phoneNumber ?? undefined,
        email: dto.email ?? undefined,
        userRole: dto.userRole ?? undefined,
        adminId: dto.adminId ?? undefined,
        driverId: dto.driverId ?? undefined,
        password: passwordHash ?? undefined,
        salaryType: dto.salaryType ?? undefined,
        fixedSalary: dto.fixedSalary ?? undefined,
        schedule: dto.schedule ?? undefined,
        status: dto.status ?? undefined,
        driverAvailableToday: dto.driverAvailableToday ?? undefined,
      },
      select: {
        id: true,
        driverId: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        userRole: true,
        salaryType: true,
        fixedSalary: true,
        schedule: true,
        status: true,
        driverAvailableToday: true,
      },
    });

    return {
      message: 'Driver updated successfully',
      driver: updated,
    };
  }
}
