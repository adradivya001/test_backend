import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Controller('internal/tenant-lookup')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async lookupTenant(@Query('phone_id') phoneId: string) {
    if (!phoneId) {
      throw new BadRequestException('phone_id query parameter is required');
    }
    return await this.tenantService.getTenantByPhoneNumberId(phoneId);
  }
}
