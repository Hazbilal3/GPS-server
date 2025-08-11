import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.entity';
import { RegisterDto } from 'src/user/dto/register.dto';
import { LoginDto } from 'src/user/dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new Error('User already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({ ...dto, password: hashed });
    await this.usersRepo.save(user);
    return { message: 'User registered successfully' };
  }

  // async login(dto: LoginDto) {
  //   const user = await this.usersRepo.findOne({ where: { email: dto.email } });
  //   if (!user || !(await bcrypt.compare(dto.password, user.password))) {
  //     throw new Error('Invalid credentials');
  //   }

  //   const token = this.jwtService.sign({
  //     sub: user.id,
  //     email: user.email,
  //     role: user.userRole,
  //   });

  //   return {
  //     accessToken: token,
  //     user: {
  //       id: user.id,
  //       email: user.email,
  //       role: user.userRole,
  //     },
  //   };
  // }

  async login(dto: LoginDto) {
    let user;
    if (dto.userRole === 1) {
      user = await this.usersRepo.findOne({
        where: { email: dto.email, userRole: 1 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new Error('Invalid admin credentials');
      }
    } else if (dto.userRole === 2) {
      user = await this.usersRepo.findOne({
        where: { driverId: dto.driverId, userRole: 2 },
      });
      if (!user || !(await bcrypt.compare(dto.password, user.password))) {
        throw new Error('Invalid driver credentials');
      }
    } else {
      throw new Error('Invalid user role');
    }
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.userRole,
      driverId: user.driverId,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.userRole,
        driverId: user.driverId,
      },
    };
  }
}
