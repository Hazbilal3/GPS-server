import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  ParseIntPipe, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, BadRequestException, Request,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { FreightService } from './freight.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('freight')
@UseGuards(AuthGuard, AdminGuard)
export class FreightController {
  constructor(private service: FreightService) {}

  // ── PDF Parsing ──────────────────────────────────────────
  @Post('parse-order')
  @UseInterceptors(FileInterceptor('file'))
  async parseOrder(
    @UploadedFile() file: Express.Multer.File,
    @Body('company') company?: string,
  ) {
    if (!file) throw new BadRequestException('PDF file is required');
    const mime = file.mimetype || 'application/pdf';
    return this.service.parseOrderPdf(file.buffer, mime, company);
  }

  // ── Dashboard ────────────────────────────────────────────
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboardStats();
  }

  // ── Loads ────────────────────────────────────────────────
  @Get('loads')
  getLoads() {
    return this.service.getLoads();
  }

  @Get('loads/:id')
  getLoad(@Param('id', ParseIntPipe) id: number) {
    return this.service.getLoad(id);
  }

  @Post('loads')
  createLoad(@Body() body: any) {
    return this.service.createLoad(body);
  }

  @Patch('loads/:id')
  updateLoad(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateLoad(id, body);
  }

  @Delete('loads/:id')
  deleteLoad(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteLoad(id);
  }

  @Patch('loads/:id/assign')
  assignLoad(
    @Param('id', ParseIntPipe) id: number,
    @Body('driverId') driverId: any,
    @Body('truckId') truckId: any,
  ) {
    return this.service.assignLoad(
      id,
      driverId ? parseInt(driverId) : undefined,
      truckId  ? parseInt(truckId)  : undefined,
    );
  }

  @Patch('loads/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Body('notes') notes?: string,
  ) {
    return this.service.updateStatus(id, status, notes);
  }

  // ── Drivers ──────────────────────────────────────────────
  @Get('drivers')
  getDrivers() {
    return this.service.getDrivers();
  }

  @Post('drivers')
  createDriver(@Body() body: any) {
    return this.service.createDriver(body);
  }

  @Patch('drivers/:id')
  updateDriver(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateDriver(id, body);
  }

  @Patch('drivers/:id/deactivate')
  deleteDriver(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDriver(id);
  }

  @Patch('drivers/:id/credentials')
  setCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.service.setDriverCredentials(id, email, password);
  }

  // ── Billing / Invoice ────────────────────────────────────
  @Get('loads/:id/invoice-data')
  getInvoiceData(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInvoiceData(id);
  }

  @Post('loads/:id/send-invoice')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'invoicePdf', maxCount: 1 },
    { name: 'extraDoc', maxCount: 1 },
  ]))
  async sendInvoice(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: { invoicePdf?: Express.Multer.File[]; extraDoc?: Express.Multer.File[] },
    @Body() body: any,
  ) {
    const pdfFile = files?.invoicePdf?.[0];
    if (!pdfFile) throw new BadRequestException('Invoice PDF is required');
    const extraFile = files?.extraDoc?.[0] ?? null;
    return this.service.sendInvoice(
      id,
      pdfFile.buffer,
      extraFile ? extraFile.buffer : null,
      extraFile ? extraFile.originalname : null,
      body,
    );
  }

  // ── Trucks ───────────────────────────────────────────────
  @Get('trucks')
  getTrucks() {
    return this.service.getTrucks();
  }

  @Post('trucks')
  createTruck(@Body() body: any) {
    return this.service.createTruck(body);
  }

  @Patch('trucks/:id')
  updateTruck(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateTruck(id, body);
  }

  // ── Driver Payroll (admin) ───────────────────────────────
  @Get('payroll')
  getFreightPayroll() {
    return this.service.getFreightPayroll();
  }

  @Patch('payroll/:id/paid')
  markDriverPaid(@Param('id', ParseIntPipe) id: number) {
    return this.service.setDriverPayStatus(id, 'paid');
  }

  @Patch('payroll/:id/pending')
  markDriverPending(@Param('id', ParseIntPipe) id: number) {
    return this.service.setDriverPayStatus(id, 'pending');
  }

  // ── Driver Disputes (admin) ───────────────────────────────
  @Get('driver-disputes')
  getFreightDisputes() {
    return this.service.getFreightDisputes();
  }

  @Patch('driver-disputes/:id/status')
  updateDisputeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.service.updateFreightDisputeStatus(id, status, adminNotes);
  }

  @Post('driver-disputes/:id/messages')
  adminDisputeMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content: string,
  ) {
    return this.service.sendFreightDisputeAdminMessage(id, content);
  }

  // ── Driver Notifications (admin) ──────────────────────────
  @Post('driver-notifications')
  sendNotification(@Body() body: any) {
    return this.service.sendFreightDriverNotification(
      parseInt(body.freightDriverId),
      body.title,
      body.body,
      body.type ?? 'general',
    );
  }
}
