import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hospitals = await prisma.hospital.findMany();
  console.log('=== Hospitals in Database ===');
  console.log(JSON.stringify(hospitals));
  await prisma.$disconnect();
}

main().catch(console.error);
