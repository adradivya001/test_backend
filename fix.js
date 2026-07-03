const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
schema = schema.replace(/hospitalId\s+String\s+@default\("default-hospital-id"\)/g, 'hospitalId String? @default("default-hospital-id")');
schema = schema.replace(/hospitalId\s+String\s*$/gm, 'hospitalId String? @default("default-hospital-id")');
fs.writeFileSync('prisma/schema.prisma', schema);
