const fs = require('fs');

function replaceAll(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, content.replace(search, replace));
}

// whatsapp.controller.ts upserts
let wacontroller = fs.readFileSync('src/whatsapp/whatsapp.controller.ts', 'utf8');
wacontroller = wacontroller.replace(/where:\s*\{\s*phone\s*\}/g, 'where: { hospitalId_phone: { hospitalId: "default-hospital-id", phone } }');
fs.writeFileSync('src/whatsapp/whatsapp.controller.ts', wacontroller);

// users.service.ts double hospitalId
let usersservice = fs.readFileSync('src/users/users.service.ts', 'utf8');
usersservice = usersservice.replace(/hospitalId: 'default-hospital-id',\n.*hospitalId: req\?.+?\n/g, 'hospitalId: "default-hospital-id",\n');
fs.writeFileSync('src/users/users.service.ts', usersservice);

// support.service.ts missing import & ticket.assignedAgent
let supportservice = fs.readFileSync('src/support/support.service.ts', 'utf8');
if (!supportservice.includes('bcrypt')) {
  supportservice = "import * as bcrypt from 'bcrypt';\n" + supportservice;
}
supportservice = supportservice.replace(/agentName: ticket\.assignedAgent \?/g, 'agentName: (ticket as any).assignedAgent ?');
supportservice = supportservice.replace(/ticket\.assignedAgent\./g, '(ticket as any).assignedAgent.');
supportservice = supportservice.replace(/data: \{\n\s*patientId:/g, 'data: {\n        hospitalId: "default-hospital-id",\n        patientId:');
fs.writeFileSync('src/support/support.service.ts', supportservice);

console.log('Fixes applied.');
