import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mock reports for all patients in the database...');
  
  const patients = await prisma.patient.findMany();
  const uploader = await prisma.user.findFirst({
    where: { role: 'DOCTOR' }
  });

  if (!uploader) {
    console.error('No doctor/user found to act as report uploader.');
    return;
  }

  for (const patient of patients) {
    const existingReport = await prisma.report.findFirst({
      where: { patientId: patient.patientId }
    });

    if (!existingReport) {
      await prisma.report.create({
        data: {
          patientId: patient.patientId,
          reportType: 'BLOOD_TEST',
          reportStatus: 'READY',
          reportUrl: 'http://127.0.0.1:3000/mock_report.pdf',
          uploadedBy: uploader.id,
          hospitalId: patient.hospitalId || 'mock_hospital_id',
        }
      });
      console.log(`Created Blood Test report for patient: ${patient.firstName} ${patient.lastName}`);
    } else {
      console.log(`Patient ${patient.firstName} already has a report.`);
    }
  }

  console.log('Reports seeding completed successfully!');
  await prisma.$disconnect();
}

main().catch(console.error);
