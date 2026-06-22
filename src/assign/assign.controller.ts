import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AssignService } from './assign.service';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

interface AssignmentRow {
  driverId: number;
  routes: string[];
}

@Controller('assign')
export class AssignController {
  constructor(private readonly service: AssignService) {}

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  async assign(@Body() body: AssignmentRow[]): Promise<{ message: string }> {
    await this.service.sendAssignments(body);
    return { message: 'Assignments sent successfully' };
  }
}
