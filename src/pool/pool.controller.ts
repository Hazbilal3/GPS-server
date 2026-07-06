import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PoolService } from './pool.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, basename, resolve, join } from 'path';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

const uploadDir = './uploads/pool-docs';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const poolDocStorage = diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const randomName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${randomName}${extname(file.originalname)}`);
  },
});

@Controller('pool')
export class PoolController {
  constructor(private service: PoolService) {}

  @Get('file/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(uploadDir);
    const fullPath = join(root, safeName);
    if (!fullPath.startsWith(root)) throw new ForbiddenException();
    return res.sendFile(fullPath);
  }

  @Post('submit-document')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: poolDocStorage }))
  async submitDocument(
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Document file is required.');
    const docUrl = `/pool/file/${file.filename}`;
    return this.service.submitDocument(req.user.sub, docUrl);
  }

  @Get('my-status')
  @UseGuards(AuthGuard)
  async getMyStatus(@Req() req: any) {
    return this.service.getMyStatus(req.user.sub);
  }

  @Get('next-driver-id')
  @UseGuards(AuthGuard, AdminGuard)
  async getNextDriverId() {
    return this.service.getNextDriverId();
  }

  @Get('all')
  @UseGuards(AuthGuard, AdminGuard)
  async getAll(@Query('status') status?: string) {
    return this.service.getAll(status);
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  async getAllPending() {
    return this.service.getAllPending();
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, AdminGuard)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body('driverId', ParseIntPipe) driverId: number,
  ) {
    return this.service.approve(id, driverId);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, AdminGuard)
  async reject(@Param('id', ParseIntPipe) id: number) {
    return this.service.reject(id);
  }
}
