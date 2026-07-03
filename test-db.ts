import { PrismaClient } from '@prisma/client';

async function testConnection() {
  const regions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
    'sa-east-1', 'ca-central-1'
  ];
  const connectionStrings = [
    'postgresql://postgres:Narayanaswamy3152@db.fsidwhqotpclwrlwarml.supabase.co:5432/postgres',
    'postgresql://postgres:Narayanaswamy%403152@db.fsidwhqotpclwrlwarml.supabase.co:5432/postgres'
  ];

  for (const conn of connectionStrings) {
    console.log(`Testing: ${conn.replace(/Narayanaswamy%403152/, '****')}`);
    try {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: conn,
          },
        },
      });
      await prisma.$connect();
      console.log('  prisma: SUCCESS!');
      await prisma.$disconnect();
      break;
    } catch (e) {
      console.log(`  prisma: FAILED - ${e.message}`);
    }
  }
}

testConnection();
