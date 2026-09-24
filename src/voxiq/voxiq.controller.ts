import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { VoxiqService } from './voxiq.service';

@Controller('voxiq')
export class VoxiqController {
  constructor(private readonly voxiqService: VoxiqService) {}

  @Post('click-to-call-session')
  @UseGuards(AuthGuard, AdminGuard)
  async createClickToCallSession(@Req() req: any, @Body() body: unknown) {
    return this.voxiqService.createLaunchSession(req.user, body);
  }

  @Post('click-to-call/webrtc-session')
  @UseGuards(AuthGuard, AdminGuard)
  async createWebRtcSession(@Req() req: any, @Body() body: unknown) {
    return this.voxiqService.createWebRtcSession(req.user, body);
  }
}
