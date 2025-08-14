import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { LoginDto } from 'src/user/dto/login.dto';
import { RegisterDto } from 'src/user/dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (dto.userRole === 1) { // Admin registration
      return this.prisma.user.create({
        data: {
          firstname: dto.firstname,
          lastname: dto.lastname,
          email: dto.email,
          password: hashedPassword,
          userRole: 1,
        },
      });
    } else if (dto.userRole === 2) { // Driver registration
      return this.prisma.user.create({
        data: {
          driverId: dto.driverId,
          firstname: dto.firstname,
          lastname: '', // Optional for drivers
          email: dto.email,
          password: hashedPassword,
          userRole: 2,
        },
      });
    }
    throw new UnauthorizedException('Invalid user role');
  }

  async login(dto: LoginDto) {
    let user;
    
    if (dto.userRole === 1) { // Admin login
      user = await this.prisma.user.findUnique({
        where: { email: dto.email, userRole: 1 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
    } else if (dto.userRole === 2) { // Driver login
      user = await this.prisma.user.findFirst({
        where: { driverId: dto.driverId, userRole: 2 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid driver credentials');
      }
    } else {
      throw new UnauthorizedException('Invalid user role');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.userRole,
      driverId: user.driverId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.userRole,
        driverId: user.driverId,
      },
    };
  }
}