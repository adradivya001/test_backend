import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const doctor = await prisma.doctor.findFirst({
    where: { name: 'Dr. Kumar' },
  });
  if (doctor) {
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.doctorId },
    });
    console.log('Total schedules count:', schedules.length);
    console.log('Schedules:', JSON.stringify(schedules));
  } else {
    console.log('Doctor not found!');
  }
  await prisma.$disconnect();
}

main().catch(console.error);
