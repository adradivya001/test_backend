const fs = require('fs');

// Fix whatsapp.controller.ts
let wacontroller = fs.readFileSync('src/whatsapp/whatsapp.controller.ts', 'utf8');
wacontroller = wacontroller.replace(/where:\s*\{\s*hospitalId_phone:\s*\{\s*phone\s*\}\s*\}/g, 'where: { phone }');
fs.writeFileSync('src/whatsapp/whatsapp.controller.ts', wacontroller);

// Fix appointments.service.ts
let apptservice = fs.readFileSync('src/appointments/appointments.service.ts', 'utf8');
// findUnique -> findFirst
apptservice = apptservice.replace(/\.findUnique\(\s*\{\s*where:\s*\{\s*doctorId_date/g, '.findFirst({ where: { doctorId_date');
// if that fails, just change doctorId_date inside findFirst
apptservice = apptservice.replace(/where:\s*\{\s*doctorId_date:\s*\{\s*doctorId,\s*date:\s*targetDate\s*\}\s*\}/g, 'where: { doctorId, date: targetDate }');
fs.writeFileSync('src/appointments/appointments.service.ts', apptservice);

console.log('Final fixes applied.');
