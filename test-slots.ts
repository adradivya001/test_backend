import axios from 'axios';

async function main() {
  // Simulate the appointment workflow step SELECT_DATE to see what slots are returned
  const res = await axios.post('http://localhost:8080/api/workflows/appointment', {
    phone: '+917670887235',
    step: 'SELECT_DATE',
    collectedData: {
      departmentId: '86bfd8bd-d992-44ce-ac91-27e81653382e',
      doctorId: 'c80f64dc-2f3d-4d7f-94d5-88496188240b',
      doctor: 'c80f64dc-2f3d-4d7f-94d5-88496188240b',
    },
    messageText: '2026-06-24',
    payloadText: '2026-06-24',
  });

  console.log('Appointment workflow response:');
  console.log(JSON.stringify(res.data, null, 2));
  
  // Check if slot 10:00 is in the list (it should NOT be since it's already booked)
  const slots = res.data?.data?.slots || [];
  console.log('\nSlots returned:', slots);
  console.log('Contains 10:00 (should be false):', slots.includes('10:00'));
}
main().catch(e => {
  console.error('Error:', e.response?.data || e.message);
});
