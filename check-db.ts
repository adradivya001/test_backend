import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const appts = await prisma.appointment.findMany({
    select: {
      appointmentId: true,
      doctorId: true,
      appointmentDate: true,
      slotTime: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('=== Recent Appointments ===');
  appts.forEach((a) =>
    console.log(
      JSON.stringify({
        id: a.appointmentId.slice(0, 8),
        doctorId: a.doctorId.slice(0, 8),
        date: a.appointmentDate.toISOString(),
        slot: a.slotTime,
        status: a.status,
      }),
    ),
  );

  const doctors = await prisma.doctor.findMany({
    select: { doctorId: true, name: true },
  });
  console.log('\n=== Doctors ===');
  doctors.forEach((d) => console.log(JSON.stringify(d)));

  // Test getAvailableSlots logic manually
  if (doctors.length > 0 && appts.length > 0) {
    const testDoctor = appts[0].doctorId;
    const testDate = appts[0].appointmentDate;
    
    console.log(`\n=== Testing slot filtering for doctor ${testDoctor.slice(0,8)} on ${testDate.toISOString()} ===`);
    
    const bookedAppts = await prisma.appointment.findMany({
      where: {
        doctorId: testDoctor,
        appointmentDate: testDate,
        status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
      },
      select: { slotTime: true, status: true },
    });
    
    console.log('Booked slots found:', JSON.stringify(bookedAppts));
    
    // Also test with raw date string
    const dateStr = testDate.toISOString().split('T')[0];
    console.log(`\nDate string from ISO: "${dateStr}"`);
    const newDate = new Date(dateStr);
    console.log(`new Date("${dateStr}"): ${newDate.toISOString()}`);
    console.log(`Original date from DB: ${testDate.toISOString()}`);
    console.log(`Dates equal?`, newDate.getTime() === testDate.getTime());
    
    const bookedAppts2 = await prisma.appointment.findMany({
      where: {
        doctorId: testDoctor,
        appointmentDate: newDate,
        status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'] },
      },
      select: { slotTime: true, status: true },
    });
    
    console.log('Booked slots with new Date:', JSON.stringify(bookedAppts2));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
