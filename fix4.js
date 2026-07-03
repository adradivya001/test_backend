const fs = require('fs');

function replaceAll(file, search, replace) {
  let content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, content.replace(search, replace));
}

// 1. notification-queue.worker.ts
replaceAll('src/whatsapp/notification-queue.worker.ts',
  /data: \{\n\s*patientId:/g,
  'data: {\n                    hospitalId: "default-hospital-id",\n                    patientId:'
);

// 2. followup-automation.worker.ts
replaceAll('src/whatsapp/followup-automation.worker.ts',
  /data: \{\n\s*patientId:/g,
  'data: {\n            hospitalId: "default-hospital-id",\n            patientId:'
);

// 3. whatsapp.controller.ts (fix findUnique to findFirst)
replaceAll('src/whatsapp/whatsapp.controller.ts',
  /\.findUnique\(/g,
  '.findFirst('
);

// 4. workflows.service.ts
replaceAll('src/workflows/workflows.service.ts',
  /ticket\.assignedAgent \?/g,
  '((ticket as any).assignedAgent) ?'
);
replaceAll('src/workflows/workflows.service.ts',
  /ticket\.assignedAgent\./g,
  '(ticket as any).assignedAgent.'
);

console.log('Fixes applied.');
