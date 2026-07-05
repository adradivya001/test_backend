import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:8080/api/workflows/report-status';
const TENANT_ID = 'mock_hospital_id';

async function testReports() {
  console.log('🔍 Fetching all patients and reports from DB...');
  const reports = await prisma.report.findMany({
    include: {
      patient: true,
    },
  });

  if (reports.length === 0) {
    console.log('❌ No reports found in the database. Please run seed-resilience-data first.');
    return;
  }

  console.log(`📋 Found ${reports.length} reports in the database.\n`);

  for (const report of reports) {
    const patient = report.patient;
    const phone = patient.phone;
    const correctName = patient.firstName;

    console.log(`--------------------------------------------------`);
    console.log(`👤 Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`📱 Phone: ${phone}`);
    console.log(`📅 Correct Name: ${correctName}`);
    console.log(`📄 Report Type: ${report.reportType} (Status: ${report.reportStatus})`);
    console.log(`--------------------------------------------------`);

    // Step 1: Query without Name
    console.log('Sending request without Name...');
    try {
      const res1 = await axios.post(
        BACKEND_URL,
        { phone },
        { headers: { 'x-tenant-id': TENANT_ID } }
      );
      console.log('Response Status:', res1.data.status);
      console.log('Response Message:', res1.data.message);
    } catch (err: any) {
      console.log('❌ Request failed:', err.response?.data || err.message);
    }

    // Step 2: Query with incorrect Name
    const incorrectName = 'WrongName';
    console.log(`\nSending request with incorrect Name: ${incorrectName}...`);
    try {
      const res2 = await axios.post(
        BACKEND_URL,
        { phone, dob: incorrectName },
        { headers: { 'x-tenant-id': TENANT_ID } }
      );
      console.log('Response Status:', res2.data.status);
      console.log('Response Message:', res2.data.message);
    } catch (err: any) {
      console.log('❌ Request failed:', err.response?.data || err.message);
    }

    // Step 3: Query with correct Name
    console.log(`\nSending request with correct Name: ${correctName}...`);
    try {
      const res3 = await axios.post(
        BACKEND_URL,
        { phone, dob: correctName },
        { headers: { 'x-tenant-id': TENANT_ID } }
      );
      console.log('Response Status:', res3.data.status);
      console.log('Download URL:', res3.data.downloadUrl);
      console.log('Report Details:', {
        reportId: res3.data.reportId,
        reportType: res3.data.reportType,
      });
    } catch (err: any) {
      console.log('❌ Request failed:', err.response?.data || err.message);
    }
    console.log(`--------------------------------------------------\n`);
  }

  await prisma.$disconnect();
}

testReports().catch((err) => {
  console.error('Test Execution Error:', err);
  prisma.$disconnect();
});
