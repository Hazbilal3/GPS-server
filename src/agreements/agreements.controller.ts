import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('agreements')
@UseGuards(AuthGuard)
export class AgreementsController {
  constructor(private service: AgreementsService) {}

  @Post('sign')
  sign(@Req() req: any, @Body() body: { signatureName: string }) {
    return this.service.signAgreements(req.user.sub, body.signatureName);
  }

  @Get('status')
  status(@Req() req: any) {
    return this.service.getStatus(req.user.sub);
  }
}
