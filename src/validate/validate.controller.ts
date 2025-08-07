import { Controller, Post } from '@nestjs/common';
import { ValidateService } from './validate.service';

@Controller('validate')
export class ValidateController {
  constructor(private readonly validateService: ValidateService) {}

  @Post()
  async validate() {
    return this.validateService.validateDeliveries();
  }
}
