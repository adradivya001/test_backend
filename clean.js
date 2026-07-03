const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Strip out all injected hospitalId
    content = content.replace(/hospitalId:\s*(['"]default-hospital-id['"]|req\?.+?),\n?/g, '');
    
    // Fix the upsert findUnique/where issues in whatsapp.controller.ts
    content = content.replace(/where: \{ hospitalId_phone: \{ hospitalId: "default-hospital-id", phone \} \}/g, 'where: { phone }');

    // Fix bcrypt import missing in support.service.ts
    if (filePath.includes('support.service.ts') && !content.includes('import * as bcrypt')) {
      content = "import * as bcrypt from 'bcrypt';\n" + content;
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
    }
  }
});
