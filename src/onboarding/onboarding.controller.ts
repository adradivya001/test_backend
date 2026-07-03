import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { IsString, IsNotEmpty } from 'class-validator';

class ImportCsvDto {
  @IsString()
  @IsNotEmpty()
  csv: string;
}

@ApiTags('Onboarding Data Import')
@Controller('api/onboarding/import')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('doctors')
  @ApiOperation({ summary: 'Import doctors from a CSV string' })
  @ApiBody({ type: ImportCsvDto, description: 'CSV data containing columns: Name, Specialization, Department, Experience, ConsultationFee, Email' })
  async importDoctors(@Body() body: ImportCsvDto) {
    return this.onboardingService.importDoctors(body.csv);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Import doctor schedules from a CSV string' })
  @ApiBody({ type: ImportCsvDto, description: 'CSV data containing columns: DoctorEmail, DayOfWeek, Start, End' })
  async importSchedules(@Body() body: ImportCsvDto) {
    return this.onboardingService.importSchedules(body.csv);
  }

  @Post('faqs')
  @ApiOperation({ summary: 'Import FAQs from a CSV string' })
  @ApiBody({ type: ImportCsvDto, description: 'CSV data containing columns: Question, Answer, Category, Language' })
  async importFAQs(@Body() body: ImportCsvDto) {
    return this.onboardingService.importFAQs(body.csv);
  }
}
