import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const patients = await p.patient.findMany({
    select: { patientId: true, firstName: true, lastName: true, phone: true },
    take: 5,
  });
  console.log('Patients:', JSON.stringify(patients, null, 2));
  
  // Also check departments
  const depts = await p.department.findMany({
    select: { id: true, name: true },
  });
  console.log('\nDepartments:', JSON.stringify(depts, null, 2));
  
  await p.$disconnect();
}
main();
