import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" DROP CONSTRAINT IF EXISTS "Patient_phone_key" CASCADE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" DROP CONSTRAINT IF EXISTS "Patient_email_key" CASCADE;`);
    console.log('Constraints dropped successfully!');
  } catch (error) {
    console.error('Error dropping constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
