import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000'; // test_bot simulator
const PHONE = '+917670887235'; // registered patient

async function send(text: string, payload = '') {
  const res = await axios.post(`${BASE}/api/simulator/send`, {
    phone: PHONE,
    text,
    payload,
    name: 'Swamy Adra'
  });
  const resp = res.data.responses?.[0];
  const session = res.data.session;
  console.log(`\n--- Step: ${session?.currentStep || 'NONE'} ---`);
  console.log('Response type:', resp?.type);
  console.log('Text:', resp?.text?.substring(0, 120));
  if (resp?.buttons) console.log('Buttons:', resp.buttons.map((b: any) => b.title));
  if (resp?.list) {
    const rows = resp.list.sections?.[0]?.rows || [];
    console.log('List rows:', rows.map((r: any) => r.title));
  }
  return { resp, session };
}

async function main() {
  console.log('=== 1. Reset session ===');
  await send('exit');
  
  console.log('\n=== 2. Start booking ===');
  let { resp, session } = await send('Book Appointment');
  
  // Helper to extract items from buttons or list
  const getOptions = (r: any) => {
    if (r?.buttons) return r.buttons.map((b: any) => ({ id: b.id, title: b.title }));
    if (r?.list) {
      const rows = r.list.sections?.[0]?.rows || [];
      return rows.map((row: any) => ({ id: row.id, title: row.title }));
    }
    return [];
  };

  // Step 3: Select Department
  let options = getOptions(resp);
  if (options.length === 0) throw new Error('No departments available');
  const dept = options.find((o: any) => o.title.includes('Cardiology')) || options[0];
  console.log('\n=== 3. Select department ===', dept.title);
  ({ resp, session } = await send(dept.title, dept.id));

  // Step 4: Select Doctor
  options = getOptions(resp);
  if (options.length === 0) throw new Error('No doctors available');
  const doc = options[0];
  console.log('\n=== 4. Select doctor ===', doc.title);
  ({ resp, session } = await send(doc.title, doc.id));

  // Step 5: Select Date
  options = getOptions(resp);
  if (options.length === 0) throw new Error('No dates available');
  const dateOpt = options[0];
  console.log('\n=== 5. Select date ===', dateOpt.title);
  ({ resp, session } = await send(dateOpt.title, dateOpt.id));

  // Step 6: Select Slot
  options = getOptions(resp);
  if (options.length === 0) throw new Error('No slots available');
  const slotOpt = options[0];
  console.log('\n=== 6. Select slot ===', slotOpt.title);
  ({ resp, session } = await send(slotOpt.title, slotOpt.id));

  console.log('\n=== Booking response ===');
  console.log(resp?.text);

  // Wait 12 seconds for the worker to process the queue (worker runs every 10 seconds)
  console.log('\nWaiting for notification worker to process queue...');
  await new Promise((resolve) => setTimeout(resolve, 12000));

  // Fetch the latest notification logs
  const latestLogs = await prisma.notificationLog.findMany({
    where: { patientId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  console.log('\n=== LATEST NOTIFICATION LOGS ===');
  for (const log of latestLogs) {
    console.log(`ID: ${log.id}`);
    console.log(`Type: ${log.type}`);
    console.log(`Delivery Status: ${log.deliveryStatus}`);
    console.log(`Payload: ${log.payload}`);
    console.log(`Failure Reason: ${log.failureReason}`);
    console.log('---');
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
