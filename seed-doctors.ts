import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const doctorData: Record<string, { name: string; email: string; spec: string }[]> = {
  'Cardiology': [
    { name: 'Dr. Kumar', email: 'dr.kumar@hospital.com', spec: 'Cardiologist' },
    { name: 'Dr. Sharma', email: 'dr.sharma@hospital.com', spec: 'Cardiologist' },
    { name: 'Dr. Mehta', email: 'dr.mehta@hospital.com', spec: 'Cardiologist' },
    { name: 'Dr. Joshi', email: 'dr.joshi@hospital.com', spec: 'Cardiologist' },
    { name: 'Dr. Singh', email: 'dr.singh@hospital.com', spec: 'Cardiologist' },
  ],
  'Neurology': [
    { name: 'Dr. Rao', email: 'dr.rao@hospital.com', spec: 'Neurologist' },
    { name: 'Dr. Gupta', email: 'dr.gupta@hospital.com', spec: 'Neurologist' },
    { name: 'Dr. Iyer', email: 'dr.iyer@hospital.com', spec: 'Neurologist' },
    { name: 'Dr. Nair', email: 'dr.nair@hospital.com', spec: 'Neurologist' },
    { name: 'Dr. Roy', email: 'dr.roy@hospital.com', spec: 'Neurologist' },
  ],
  'Orthology': [
    { name: 'Dr. Reddy', email: 'dr.reddy@hospital.com', spec: 'Orthopedist' },
    { name: 'Dr. Murthy', email: 'dr.murthy@hospital.com', spec: 'Orthopedist' },
    { name: 'Dr. Bose', email: 'dr.bose@hospital.com', spec: 'Orthopedist' },
    { name: 'Dr. Gill', email: 'dr.gill@hospital.com', spec: 'Orthopedist' },
    { name: 'Dr. Fernandez', email: 'dr.fernandez@hospital.com', spec: 'Orthopedist' },
  ],
  'General Surgeon': [
    { name: 'Dr. Verma', email: 'dr.verma@hospital.com', spec: 'Surgeon' },
    { name: 'Dr. Sen', email: 'dr.sen@hospital.com', spec: 'Surgeon' },
    { name: 'Dr. Das', email: 'dr.das@hospital.com', spec: 'Surgeon' },
    { name: 'Dr. Mishra', email: 'dr.mishra@hospital.com', spec: 'Surgeon' },
    { name: 'Dr. Chawla', email: 'dr.chawla@hospital.com', spec: 'Surgeon' },
  ],
  'Dermatology': [
    { name: 'Dr. Patel', email: 'dr.patel@hospital.com', spec: 'Dermatologist' },
    { name: 'Dr. Kapoor', email: 'dr.kapoor@hospital.com', spec: 'Dermatologist' },
    { name: 'Dr. Shah', email: 'dr.shah@hospital.com', spec: 'Dermatologist' },
    { name: 'Dr. Menon', email: 'dr.menon@hospital.com', spec: 'Dermatologist' },
    { name: 'Dr. Bhat', email: 'dr.bhat@hospital.com', spec: 'Dermatologist' },
  ],
};

async function main() {
  console.log('Seeding doctors and 7-day schedules for all departments...');

  const hospitalId = 'mock_hospital_id';

  for (const [deptName, doctors] of Object.entries(doctorData)) {
    // 1. Find or create Department
    let dept = await prisma.department.findFirst({
      where: { name: deptName, hospitalId },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: deptName,
          description: `${deptName} department services`,
          hospitalId,
        },
      });
      console.log(`Created Department: ${deptName}`);
    }

    for (const docInfo of doctors) {
      // 2. Find or create User
      let user = await prisma.user.findUnique({
        where: { email: docInfo.email },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: docInfo.email,
            passwordHash: 'mock-hash-123',
            firstName: docInfo.name.split(' ')[1] || 'Doctor',
            lastName: docInfo.name.split(' ')[0] || 'Dr',
            role: 'DOCTOR',
            hospitalId,
          },
        });
      }

      // 3. Find or create Doctor
      let doctor = await prisma.doctor.findFirst({
        where: { name: docInfo.name, hospitalId },
      });
      if (!doctor) {
        doctor = await prisma.doctor.create({
          data: {
            name: docInfo.name,
            specialization: docInfo.spec,
            departmentId: dept.id,
            experience: Math.floor(Math.random() * 15) + 5,
            consultationFee: Math.floor(Math.random() * 100) + 100,
            userId: user.id,
            status: 'ACTIVE',
            hospitalId,
          },
        });
        console.log(`Created Doctor: ${docInfo.name} in ${deptName}`);
      }

      // 4. Ensure doctor has schedules for all 7 days of the week
      for (let day = 0; day < 7; day++) {
        const schedExists = await prisma.doctorSchedule.findFirst({
          where: { doctorId: doctor.doctorId, dayOfWeek: day },
        });
        if (!schedExists) {
          await prisma.doctorSchedule.create({
            data: {
              doctorId: doctor.doctorId,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '17:00',
            },
          });
        }
      }
    }
  }

  console.log('Seeding completed successfully!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
