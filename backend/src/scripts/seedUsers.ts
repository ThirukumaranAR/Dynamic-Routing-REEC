import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, prisma } from '../services/db';
import { hashPassword } from '../services/auth';

const DEFAULT_PASSWORD = 'Password@123456';
const DEMO_PASSWORD = 'pass123';

const SEED_USERS = [
  // Enterprise accounts (@flownexus.com)
  { email: 'chairman@flownexus.com', name: 'Chairman Executive', role: 'CHAIRMAN', dept: 'Executive Office', employeeId: 'FN-001' },
  { email: 'ceo@flownexus.com', name: 'Chief Executive Officer', role: 'CEO', dept: 'Executive Management', employeeId: 'FN-002' },
  { email: 'gm@flownexus.com', name: 'General Manager', role: 'GENERAL_MANAGER', dept: 'Operations', employeeId: 'FN-003' },
  { email: 'dean@flownexus.com', name: 'Dean of Faculty', role: 'DEAN', dept: 'Academics', employeeId: 'FN-004' },
  { email: 'manager@flownexus.com', name: 'Institution Manager', role: 'INSTITUTION_MANAGER', dept: 'Administration', employeeId: 'FN-005' },
  { email: 'finance@flownexus.com', name: 'Finance Controller', role: 'FINANCE', dept: 'Finance & Accounts', employeeId: 'FN-006' },
  { email: 'accountant@flownexus.com', name: 'Accountant Lead', role: 'ACCOUNTANT', dept: 'Finance & Accounts', employeeId: 'FN-006B' },
  { email: 'vp@flownexus.com', name: 'Vice President', role: 'VP', dept: 'Executive Operations', employeeId: 'FN-006C' },
  { email: 'hoi@flownexus.com', name: 'Head of Institution', role: 'HOI', dept: 'Campus Administration', employeeId: 'FN-006D' },
  { email: 'requester@flownexus.com', name: 'Alex Requester', role: 'REQUESTER', dept: 'Product Development', employeeId: 'FN-007' },
  { email: 'hr@flownexus.com', name: 'HR Lead', role: 'HR', dept: 'Human Resources', employeeId: 'FN-008' },
  { email: 'it@flownexus.com', name: 'IT Administrator', role: 'IT', dept: 'Information Technology', employeeId: 'FN-009' },
  { email: 'audit@flownexus.com', name: 'Audit Officer', role: 'AUDIT', dept: 'Internal Audit', employeeId: 'FN-009B' },
  { email: 'mmi@flownexus.com', name: 'MMI Head', role: 'MMI', dept: 'MMI Department', employeeId: 'FN-009C' },

  // Standard Demo / Test accounts (@gmail.com)
  { email: 'chairman@gmail.com', name: 'Board Chairman', role: 'CHAIRMAN', dept: 'Board of Directors', employeeId: 'GM-001', legacyPassword: DEMO_PASSWORD },
  { email: 'ceo@gmail.com', name: 'Dr. Suresh Kumar (CEO)', role: 'CEO', dept: 'Chief Executive Office', employeeId: 'GM-002', legacyPassword: DEMO_PASSWORD },
  { email: 'requester@gmail.com', name: 'Arun Requester', role: 'REQUESTER', dept: 'Computer Science and Engineering', employeeId: 'GM-003', legacyPassword: DEMO_PASSWORD },
  { email: 'manager@gmail.com', name: 'Kavitha Institution Manager', role: 'INSTITUTION_MANAGER', dept: 'Campus Administration', employeeId: 'GM-004', legacyPassword: DEMO_PASSWORD },
  { email: 'finance@gmail.com', name: 'Finance Head', role: 'FINANCE', dept: 'Finance & Accounts', employeeId: 'GM-005', legacyPassword: DEMO_PASSWORD },
  { email: 'accountant@gmail.com', name: 'Accountant Senior', role: 'ACCOUNTANT', dept: 'Accounts Office', employeeId: 'GM-006', legacyPassword: DEMO_PASSWORD },
  { email: 'vp@gmail.com', name: 'Vice President Operations', role: 'VP', dept: 'Executive Operations', employeeId: 'GM-007', legacyPassword: DEMO_PASSWORD },
  { email: 'hoi@gmail.com', name: 'Head of Institution', role: 'HOI', dept: 'Campus Leadership', employeeId: 'GM-008', legacyPassword: DEMO_PASSWORD },
  { email: 'dean@gmail.com', name: 'Dean Academics', role: 'DEAN', dept: 'Academic Directorate', employeeId: 'GM-009', legacyPassword: DEMO_PASSWORD },
  { email: 'it@gmail.com', name: 'IT Systems Head', role: 'IT', dept: 'IT Services', employeeId: 'GM-010', legacyPassword: DEMO_PASSWORD },
  { email: 'audit@gmail.com', name: 'Internal Audit Head', role: 'AUDIT', dept: 'Audit & Compliance', employeeId: 'GM-011', legacyPassword: DEMO_PASSWORD },
  { email: 'hr@gmail.com', name: 'HR Department Head', role: 'HR', dept: 'Human Resources', employeeId: 'GM-012', legacyPassword: DEMO_PASSWORD },
  { email: 'mmi@gmail.com', name: 'MMI Operations Lead', role: 'MMI', dept: 'MMI Directorate', employeeId: 'GM-013', legacyPassword: DEMO_PASSWORD },
  { email: 'authority@gmail.com', name: 'General Manager Authority', role: 'GENERAL_MANAGER', dept: 'Operations Management', employeeId: 'GM-014', legacyPassword: DEMO_PASSWORD },
  { email: 'approver@gmail.com', name: 'Rajan Mehta', role: 'DEAN', dept: 'IT Department', employeeId: 'GM-015', legacyPassword: DEMO_PASSWORD }
];

export const seedUsers = async () => {
  await connectDatabase();
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  const now = new Date().toISOString();

  console.log(`Seeding demo users in MySQL...`);

  for (const item of SEED_USERS) {
    const { legacyPassword, ...user } = item;
    const pwdHash = legacyPassword ? await hashPassword(legacyPassword) : defaultHash;
    const email = user.email.toLowerCase().trim();

    await prisma.user.upsert({
      where: { email },
      update: {
        name: user.name,
        role: user.role,
        dept: user.dept,
        company: 'FlowNexus',
        businessUnit: 'Main',
        employeeId: user.employeeId,
        passwordHash: pwdHash,
        isActive: true,
        updatedAt: now
      },
      create: {
        id: randomUUID(),
        email,
        name: user.name,
        role: user.role,
        dept: user.dept,
        company: 'FlowNexus',
        businessUnit: 'Main',
        employeeId: user.employeeId,
        passwordHash: pwdHash,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    });
    console.log(`✓ Seeded user: ${email} (${user.role}) [pwd: ${legacyPassword || DEFAULT_PASSWORD}]`);
  }

  console.log('User seeding completed successfully.');
};

if (require.main === module) {
  seedUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
