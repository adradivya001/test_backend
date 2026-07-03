const fs = require('fs');

function fixFile(filePath, fixes) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    fixes.forEach(fix => {
      content = content.replace(fix.search, fix.replace);
    });
    fs.writeFileSync(filePath, content);
  }
}

// 1. AuditLog & PatientFollowUp (remove hospitalId from creates/updates)
fixFile('src/whatsapp/followup-automation.worker.ts', [
  { search: /hospitalId:\s*(req\?.+?\|\|\s*)?"default-hospital-id",\n/g, replace: '' }
]);

// 2. ConversationMapping (whatsapp.controller.ts)
// change findUnique({ where: { phone } }) to findFirst({ where: { phone } })
// change create: { phone... to create: { hospitalId: "default-hospital-id", phone...
fixFile('src/whatsapp/whatsapp.controller.ts', [
  { search: /\.findUnique\(/g, replace: '.findFirst(' },
  { search: /create:\s*\{\s*phone/g, replace: 'create: { hospitalId: "default-hospital-id", phone' }
]);

// 3. User & Department (remove hospitalId where it was injected blindly into updates or where it causes issues)
fixFile('src/users/users.service.ts', [
  { search: /\.findUnique\(/g, replace: '.findFirst(' }
]);

fixFile('src/support/support.service.ts', [
  { search: /hospitalId:\s*"default-hospital-id",\n/g, replace: '' }
]);

fixFile('src/whatsapp/appointment-reminder.worker.ts', [
  { search: /hospitalId:\s*"default-hospital-id",\n/g, replace: '' }
]);

fixFile('src/whatsapp/notification-queue.worker.ts', [
  { search: /hospitalId:\s*"default-hospital-id",\n/g, replace: '' }
]);
