import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany();
  console.log('=== Departments hospitalIds ===');
  depts.forEach((d) => {
    console.log(`- Dept: ${d.name} | ID: ${d.id} | hospitalId: ${d.hospitalId}`);
  });
  await prisma.$disconnect();
}

main().catch(console.error);
