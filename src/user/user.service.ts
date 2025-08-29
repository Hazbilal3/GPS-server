import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDriverDto, UpdateDriverDto } from './user.entity';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async getDriversWithId() {
    return this.prisma.user.findMany({
      where: {
        driverId: {
          not: null,
        },
      },
      select: {
        driverId: true,
        fullName: true,
        email: true,
        phoneNumber: true,
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

    await this.prisma.user.delete({ where: { id: driver.id } });

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
      userRole = 2, // e.g. 2 = Driver; adjust to your roles
      adminId,
    } = dto;

    if (!driverId) {
      throw new BadRequestException('driverId is required');
    }
    if (!fullName || !phoneNumber || !email || !password) {
      throw new BadRequestException('fullName, phoneNumber, email, and password are required');
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
        password: passwordHash, // store hash, not raw password
        userRole,
      },
      select: {
        id: true,
        driverId: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        userRole: true,
      },
    });

    return {
      message: 'Driver created successfully',
      driver: created,
    };
  }

  /**
   * Update driver by driverId.
   * Allows partial updates. Blocks email/phone conflicts.
   */
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
        // Only set provided fields
        fullName: dto.fullName ?? undefined,
        phoneNumber: dto.phoneNumber ?? undefined,
        email: dto.email ?? undefined,
        userRole: dto.userRole ?? undefined,
        adminId: dto.adminId ?? undefined,
        // If you want to allow moving driver to a new driverId:
        driverId: dto.driverId ?? undefined,
        // If you allow "un-assigning" a driver (turn into non-driver), set dto.driverId explicitly to null above
        password: passwordHash ?? undefined,
      },
      select: {
        id: true,
        driverId: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        userRole: true,
      },
    });

    return {
      message: 'Driver updated successfully',
      driver: updated,
    };
  }
}
