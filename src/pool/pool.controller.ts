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
  NotFoundException,
} from '@nestjs/common';
import { PoolService } from './pool.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { basename, resolve, join } from 'path';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { createS3Storage, getS3Object, S3File } from '../s3.storage';

const localUploadDir = join(__dirname, '../../uploads/pool-docs');
const poolDocStorage = createS3Storage('pool-docs');

@Controller('pool')
export class PoolController {
  constructor(private service: PoolService) {}

  @Get('file/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = basename(filename);
    const root = resolve(localUploadDir);
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
    const docUrl = (file as S3File).location || `/pool/file/${file.filename}`;
    return this.service.submitDocument(req.user.sub, docUrl);
  }

  @Post('submit-insurance')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: poolDocStorage }))
  async submitInsurance(
    @Req() req: any,
    @Body('number') number: string,
    @Body('expiry') expiry: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Insurance document is required.');
    if (!number) throw new BadRequestException('Insurance number is required.');
    if (!expiry) throw new BadRequestException('Insurance expiry is required.');
    return this.service.submitCard(req.user.sub, 'insurance', { number, expiry, docUrl: (file as S3File).location || `/pool/file/${file.filename}` });
  }

  @Post('submit-registration')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: poolDocStorage }))
  async submitRegistration(
    @Req() req: any,
    @Body('number') number: string,
    @Body('expiry') expiry: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Registration document is required.');
    if (!number) throw new BadRequestException('Registration number is required.');
    if (!expiry) throw new BadRequestException('Registration expiry is required.');
    return this.service.submitCard(req.user.sub, 'registration', { number, expiry, docUrl: (file as S3File).location || `/pool/file/${file.filename}` });
  }

  @Post('submit-license')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: poolDocStorage }))
  async submitLicense(
    @Req() req: any,
    @Body('number') number: string,
    @Body('expiry') expiry: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('License document is required.');
    if (!number) throw new BadRequestException('License number is required.');
    if (!expiry) throw new BadRequestException('License expiry is required.');
    return this.service.submitCard(req.user.sub, 'license', { number, expiry, docUrl: (file as S3File).location || `/pool/file/${file.filename}` });
  }

  @Post('submit-w9')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: poolDocStorage }))
  async submitW9(
    @Req() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) return { message: 'W-9 skipped.' };
    const docUrl = (file as S3File).location || `/pool/file/${file.filename}`;
    return this.service.submitW9(req.user.sub, docUrl);
  }

  @Get('s3proxy')
  @UseGuards(AuthGuard, AdminGuard)
  async proxyS3Doc(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException('url is required');
    try {
      const { body, contentType } = await getS3Object(decodeURIComponent(url));
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      (body as any).pipe(res);
    } catch {
      throw new NotFoundException('Document not found');
    }
  }

  @Post('finalize')
  @UseGuards(AuthGuard)
  async finalize(@Req() req: any) {
    return this.service.finalize(req.user.sub);
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
