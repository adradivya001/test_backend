import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Re-associating all departments and doctors to mock_hospital_id...');

  const deptUpdate = await prisma.department.updateMany({
    data: { hospitalId: 'mock_hospital_id' },
  });
  console.log(`Updated ${deptUpdate.count} departments.`);

  const docUpdate = await prisma.doctor.updateMany({
    data: { hospitalId: 'mock_hospital_id' },
  });
  console.log(`Updated ${docUpdate.count} doctors.`);

  await prisma.$disconnect();
}

main().catch(console.error);
