const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Make all hospitalId strictly optional and remove defaults
schema = schema.replace(/hospitalId\s+String\??\s*(@default\("[^"]+"\))?/g, 'hospitalId String?');

// 2. Revert compound unique constraints back to simple ones
// For User:
schema = schema.replace(/@@unique\(\[hospitalId, email\]\)/g, '');
schema = schema.replace(/email\s+String\s*/g, 'email String @unique\n  ');

// For Patient:
schema = schema.replace(/@@index\(\[hospitalId, phone\]\)/g, '@@index([phone])');

// For Department:
schema = schema.replace(/@@unique\(\[hospitalId, name\]\)/g, '');
schema = schema.replace(/name\s+String\s*/g, 'name String @unique\n  ');

// For ConversationMapping:
schema = schema.replace(/@@unique\(\[hospitalId, phone\]\)/g, '');
schema = schema.replace(/phone\s+String\s*/g, 'phone String @unique\n  ');

// For HolidayCalendar:
schema = schema.replace(/@@unique\(\[hospitalId, date\]\)/g, '');
schema = schema.replace(/date\s+DateTime\s+@db\.Date\s*/g, 'date DateTime @db.Date @unique\n  ');

// For ChatMessage:
schema = schema.replace(/@@index\(\[hospitalId, phone\]\)/g, '@@index([phone])');

// Save
fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema simplified for compatibility.');
