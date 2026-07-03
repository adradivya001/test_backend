import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantId } from '../common/tenant/tenant.context';
import { Language } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to parse CSV string into headers and row objects
   */
  private parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }

    if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      lines.push(row);
    }

    if (lines.length === 0) {
      throw new BadRequestException('Empty CSV file');
    }

    // Clean headers: lowercase and remove spaces/quotes
    const headers = lines[0].map(h => h.toLowerCase().replace(/["']/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = line[index] !== undefined ? line[index].replace(/["']/g, '').trim() : '';
      });
      return rowObj;
    });

    return { headers, rows };
  }

  /**
   * Imports Doctors from CSV
   */
  async importDoctors(csvText: string) {
    const tenantId = getTenantId();
    const { headers, rows } = this.parseCSV(csvText);

    // Validate headers
    const requiredHeaders = ['name', 'specialization', 'department', 'experience', 'consultationfee', 'email'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const errors: string[] = [];
    const validatedRows: any[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // CSV is 1-indexed, header is line 1
      const name = row['name'];
      const spec = row['specialization'];
      const deptName = row['department'];
      const expStr = row['experience'];
      const feeStr = row['consultationfee'];
      const email = row['email'];

      if (!name) errors.push(`Row ${rowNum}: Name is required`);
      if (!spec) errors.push(`Row ${rowNum}: Specialization is required`);
      if (!deptName) errors.push(`Row ${rowNum}: Department is required`);
      if (!email) errors.push(`Row ${rowNum}: Email is required`);

      const exp = parseInt(expStr, 10);
      if (isNaN(exp) || exp < 0) {
        errors.push(`Row ${rowNum}: Experience must be a non-negative number`);
      }

      const fee = parseFloat(feeStr);
      if (isNaN(fee) || fee < 0) {
        errors.push(`Row ${rowNum}: ConsultationFee must be a positive number`);
      }

      if (errors.length === 0) {
        validatedRows.push({ name, spec, deptName, exp, fee, email });
      }
    });

    if (errors.length > 0) {
      return { success: false, importedCount: 0, errors };
    }

    // Process in Transaction
    await this.prisma.$transaction(async (tx) => {
      for (const row of validatedRows) {
        // 1. Ensure Department exists
        let department = await tx.department.findUnique({
          where: {
            hospitalId_name: {
              hospitalId: tenantId,
              name: row.deptName
            }
          }
        });

        if (!department) {
          department = await tx.department.create({
            data: {
              name: row.deptName,
              description: `${row.deptName} Department`,
              hospitalId: tenantId,
            }
          });
        }

        // 2. Ensure User exists for Doctor
        let user = await tx.user.findUnique({
          where: { email: row.email }
        });

        if (!user) {
          user = await tx.user.create({
            data: {
              email: row.email,
              passwordHash: '$2b$10$mockpasswordhashforeasydfoauthentication',
              firstName: row.name.split(' ')[0] || 'Dr.',
              lastName: row.name.split(' ').slice(1).join(' ') || 'Kumar',
              role: 'DOCTOR',
              hospitalId: tenantId,
            }
          });
        }

        // 3. Upsert Doctor
        await tx.doctor.upsert({
          where: {
            hospitalId_name: {
              hospitalId: tenantId,
              name: row.name
            }
          },
          update: {
            specialization: row.spec,
            experience: row.exp,
            consultationFee: row.fee,
            departmentId: department.id,
            userId: user.id,
          },
          create: {
            name: row.name,
            specialization: row.spec,
            experience: row.exp,
            consultationFee: row.fee,
            departmentId: department.id,
            userId: user.id,
            hospitalId: tenantId,
          }
        });
      }
    });

    return { success: true, importedCount: validatedRows.length, errors: [] };
  }

  /**
   * Imports Doctor Schedules from CSV
   */
  async importSchedules(csvText: string) {
    const { headers, rows } = this.parseCSV(csvText);

    // Validate headers
    const requiredHeaders = ['doctoremail', 'dayofweek', 'start', 'end'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const dayMapping: Record<string, number> = {
      sunday: 0, sun: 0, '0': 0,
      monday: 1, mon: 1, '1': 1,
      tuesday: 2, tue: 2, '2': 2,
      wednesday: 3, wed: 3, '3': 3,
      thursday: 4, thu: 4, '4': 4,
      friday: 5, fri: 5, '5': 5,
      saturday: 6, sat: 6, '6': 6
    };

    const errors: string[] = [];
    const validatedRows: any[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const email = row['doctoremail'];
      const dayStr = row['dayofweek']?.toLowerCase();
      const start = row['start'];
      const end = row['end'];

      if (!email) errors.push(`Row ${rowNum}: DoctorEmail is required`);
      if (!dayStr) errors.push(`Row ${rowNum}: DayOfWeek is required`);
      if (!start) errors.push(`Row ${rowNum}: Start time is required`);
      if (!end) errors.push(`Row ${rowNum}: End time is required`);

      const dayNum = dayMapping[dayStr];
      if (dayNum === undefined) {
        errors.push(`Row ${rowNum}: Invalid DayOfWeek (${dayStr}). Must be Monday-Sunday or 0-6.`);
      }

      // Valid HH:MM time format checks
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (start && !timeRegex.test(start)) {
        errors.push(`Row ${rowNum}: Invalid Start time (${start}). Format must be HH:MM (24h).`);
      }
      if (end && !timeRegex.test(end)) {
        errors.push(`Row ${rowNum}: Invalid End time (${end}). Format must be HH:MM (24h).`);
      }

      if (errors.length === 0) {
        validatedRows.push({ email, dayOfWeek: dayNum, startTime: start, endTime: end });
      }
    });

    if (errors.length > 0) {
      return { success: false, importedCount: 0, errors };
    }

    // Process DB Updates
    await this.prisma.$transaction(async (tx) => {
      for (const row of validatedRows) {
        // Find doctor by user email
        const user = await tx.user.findUnique({
          where: { email: row.email },
          include: { doctor: true }
        });

        if (!user || !user.doctor) {
          throw new Error(`Doctor not found for email: ${row.email}. Please import the doctors list first.`);
        }

        // Upsert DoctorSchedule
        await tx.doctorSchedule.upsert({
          where: {
            doctorId_dayOfWeek_startTime_endTime: {
              doctorId: user.doctor.doctorId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
            }
          },
          update: {},
          create: {
            doctorId: user.doctor.doctorId,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
          }
        });
      }
    });

    return { success: true, importedCount: validatedRows.length, errors: [] };
  }

  /**
   * Imports FAQs from CSV
   */
  async importFAQs(csvText: string) {
    const tenantId = getTenantId();
    const { headers, rows } = this.parseCSV(csvText);

    // Validate headers
    const requiredHeaders = ['question', 'answer', 'category', 'language'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const errors: string[] = [];
    const validatedRows: any[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const question = row['question'];
      const answer = row['answer'];
      const category = row['category'] || 'General';
      const langStr = (row['language'] || 'EN').toUpperCase();

      if (!question) errors.push(`Row ${rowNum}: Question is required`);
      if (!answer) errors.push(`Row ${rowNum}: Answer is required`);

      let lang: Language = Language.EN;
      if (langStr === 'HI') lang = Language.HI;
      else if (langStr === 'TE') lang = Language.TE;
      else if (langStr !== 'EN') {
        errors.push(`Row ${rowNum}: Invalid language (${langStr}). Supported: EN, HI, TE.`);
      }

      if (errors.length === 0) {
        validatedRows.push({ question, answer, category, language: lang });
      }
    });

    if (errors.length > 0) {
      return { success: false, importedCount: 0, errors };
    }

    // Process FAQs
    await this.prisma.$transaction(async (tx) => {
      for (const row of validatedRows) {
        await tx.fAQ.create({
          data: {
            title: row.question.substring(0, 50),
            question: row.question,
            answer: row.answer,
            category: row.category,
            language: row.language,
            hospitalId: tenantId,
          }
        });
      }
    });

    return { success: true, importedCount: validatedRows.length, errors: [] };
  }
}
