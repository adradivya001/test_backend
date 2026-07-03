import { PrismaClient, Gender, Language, SupportTicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing test data...');
  // Optional cleanup of specific test profiles
  await prisma.patientFollowUp.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.patient.deleteMany({ where: { phone: '+917670887235' } });
  await prisma.whatsAppChannel.deleteMany({});
  await prisma.hospital.deleteMany({});
  
  console.log('Seeding Hospital and Channel...');
  const hospital = await prisma.hospital.upsert({
    where: { id: 'mock_hospital_id' },
    update: { name: 'Apollo Hospital' },
    create: {
      id: 'mock_hospital_id',
      name: 'Apollo Hospital',
    }
  });

  await prisma.whatsAppChannel.upsert({
    where: { phoneNumberId: 'mock_phone_number_id' },
    update: {},
    create: {
      tenantId: 'mock_hospital_id',
      phoneNumberId: 'mock_phone_number_id',
      phoneNumber: '+917670887235',
      accessToken: 'mock_access_token',
      verifyToken: 'mock_verify_token',
      webhookSecret: 'mock_app_secret',
      status: 'ACTIVE',
    }
  });

  // 1. Ensure Department exists
  console.log('Seeding Department...');
  const department = await prisma.department.upsert({
    where: {
      hospitalId_name: {
        hospitalId: 'mock_hospital_id',
        name: 'Cardiology'
      }
    },
    update: {},
    create: {
      name: 'Cardiology',
      description: 'Comprehensive heart care and diagnostic services',
      slotDuration: 30,
      hospitalId: 'mock_hospital_id',
    },
  });

  // 2. Ensure Doctors exist in Department
  console.log('Seeding Doctors and Schedules...');
  const doctor1 = await prisma.doctor.upsert({
    where: { doctorId: 'c80f64dc-2f3d-4d7f-94d5-88496188240b' },
    update: { status: 'ACTIVE' },
    create: {
      doctorId: 'c80f64dc-2f3d-4d7f-94d5-88496188240b',
      name: 'Dr. Kumar',
      specialization: 'Interventional Cardiologist',
      departmentId: department.id,
      experience: 12,
      consultationFee: 500,
      slotDuration: 30,
      status: 'ACTIVE',
      hospitalId: 'mock_hospital_id',
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { doctorId: 'd91f64dc-2f3d-4d7f-94d5-88496188240c' },
    update: { status: 'ACTIVE' },
    create: {
      doctorId: 'd91f64dc-2f3d-4d7f-94d5-88496188240c',
      name: 'Dr. Sharma',
      specialization: 'Pediatric Cardiologist',
      departmentId: department.id,
      experience: 8,
      consultationFee: 400,
      slotDuration: 30,
      status: 'ACTIVE',
      hospitalId: 'mock_hospital_id',
    },
  });

  // Create Schedules for Tuesday (dayOfWeek 2) and Wednesday (dayOfWeek 3)
  for (const docId of [doctor1.doctorId, doctor2.doctorId]) {
    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek_startTime_endTime: {
          doctorId: docId,
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '12:00',
        },
      },
      update: {},
      create: {
        doctorId: docId,
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '12:00',
      },
    });

    await prisma.doctorSchedule.upsert({
      where: {
        doctorId_dayOfWeek_startTime_endTime: {
          doctorId: docId,
          dayOfWeek: 3,
          startTime: '09:00',
          endTime: '12:00',
        },
      },
      update: {},
      create: {
        doctorId: docId,
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '12:00',
      },
    });
  }

  // 3. Seed Family Members (sharing the phone number +917670887235)
  console.log('Seeding Patient Family Profiles...');
  
  // Profile A: Primary Patient (Aravind - no past history, first consult 30m)
  const patientAravind = await prisma.patient.create({
    data: {
      firstName: 'Aravind',
      lastName: 'Reddy',
      gender: Gender.MALE,
      age: 45,
      dateOfBirth: new Date('1981-05-15'),
      phone: '+917670887235',
      email: 'aravind@example.com',
      preferredLanguage: Language.EN,
      hospitalId: 'mock_hospital_id',
    },
  });

  // Profile B: Dependent (Siri - has past completed history, follow-up 15m)
  const patientSiri = await prisma.patient.create({
    data: {
      firstName: 'Siri',
      lastName: 'Reddy',
      gender: Gender.FEMALE,
      age: 12,
      dateOfBirth: new Date('2014-10-20'),
      phone: '+917670887235',
      email: 'siri@example.com',
      preferredLanguage: Language.EN,
      hospitalId: 'mock_hospital_id',
    },
  });

  // 4. Seed history for Siri (to trigger 15m follow-up durations)
  console.log('Seeding Past Consultation History for Siri...');
  const pastAppt = await prisma.appointment.create({
    data: {
      patientId: patientSiri.patientId,
      doctorId: doctor1.doctorId,
      departmentId: department.id,
      appointmentDate: new Date('2026-05-01'),
      slotTime: '10:00',
      status: 'COMPLETED',
      completedAt: new Date('2026-05-01T10:30:00.000Z'),
      diagnosis: 'Mild arrhythmia, recommended follow-up in 1 month.',
      hospitalId: 'mock_hospital_id',
    },
  });

  // 5. Seed Medical Report for Siri
  console.log('Seeding Diagnostic Report for Siri...');
  // Find system user to associate uploader
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@hospital.com' },
  });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'system@hospital.com',
        passwordHash: 'dummy_hash',
        firstName: 'System',
        lastName: 'Uploader',
        role: 'SUPER_ADMIN',
        hospitalId: 'mock_hospital_id',
      },
    });
  }

  await prisma.report.create({
    data: {
      patientId: patientSiri.patientId,
      reportType: 'ECG_HEART_SCAN',
      reportStatus: 'READY',
      reportUrl: 'https://dfo-hospital.com/secure-vault/ecg_siri_10023.pdf',
      uploadedBy: systemUser.id,
      hospitalId: 'mock_hospital_id',
    },
  });

  // 6. Seed Support Ticket for Agent Lock Verification
  console.log('Seeding Support Ticket...');
  await prisma.supportTicket.create({
    data: {
      patientId: patientAravind.patientId,
      conversationId: 'conv_aravind_test',
      priority: SupportTicketPriority.MEDIUM,
      status: 'OPEN',
      hospitalId: 'mock_hospital_id',
    },
  });

  // 7. Seed FAQ and Knowledge Base
  console.log('Seeding FAQs & Knowledge Base...');
  await prisma.fAQ.create({
    data: {
      title: 'Visiting Hours',
      category: 'General',
      question: 'What are the visiting hours?',
      answer: 'Our general visiting hours are from 9:00 AM to 8:00 PM daily.',
      language: Language.EN,
      reviewStatus: 'APPROVED',
      expiryDate: new Date('2027-12-31'),
      hospitalId: 'mock_hospital_id',
    },
  });

  await prisma.knowledgeBase.create({
    data: {
      title: 'Billing Policy',
      category: 'Billing',
      content: 'Cardiology consultations cost 500 INR for first consultations and 400 INR for follow-ups.',
      language: Language.EN,
      reviewStatus: 'APPROVED',
      expiryDate: new Date('2027-12-31'),
      hospitalId: 'mock_hospital_id',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
