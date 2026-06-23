import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
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

  // ── Draft endpoints ──────────────────────────────────────────────────────

  @Post('drafts')
  @UseGuards(AuthGuard, AdminGuard)
  createDraft(@Body() body: { name: string; rows: AssignmentRow[] }) {
    return this.service.createDraft(body.name, body.rows);
  }

  @Get('drafts')
  @UseGuards(AuthGuard, AdminGuard)
  listDrafts() {
    return this.service.listDrafts();
  }

  @Patch('drafts/:id')
  @UseGuards(AuthGuard, AdminGuard)
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string; rows: AssignmentRow[] },
  ) {
    return this.service.updateDraft(id, body.name, body.rows);
  }

  @Delete('drafts/:id')
  @UseGuards(AuthGuard, AdminGuard)
  deleteDraft(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDraft(id);
  }
}
