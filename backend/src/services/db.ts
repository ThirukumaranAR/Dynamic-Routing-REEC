import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  createDefaultWorkflows,
  getDefaultGeneralWorkflow,
  getDefaultDepartmentWorkflow,
  WORKFLOW_CONFIG_LIST
} from './workflowService';
import { hashPassword } from './auth';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

export const getPrisma = (): PrismaClient => prisma;

let isDbConnected = false;
let connectionPromise: Promise<void> | undefined;

const checkPortOpen = (port: number, host = '127.0.0.1', timeout = 1000): Promise<boolean> => {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
};

const ensureMySQLDaemon = async (): Promise<void> => {
  const isOpen = await checkPortOpen(3306, '127.0.0.1', 800);
  if (isOpen) {
    return;
  }

  const candidateBins = [
    process.env.MYSQL_BIN_PATH,
    'C:\\Users\\Thirukumaran AR\\flownexus-mysql\\mariadb-11.4.5-winx64\\bin\\mysqld.exe',
    path.resolve(process.cwd(), '../../flownexus-mysql/mariadb-11.4.5-winx64/bin/mysqld.exe'),
    path.resolve(process.cwd(), '../flownexus-mysql/mariadb-11.4.5-winx64/bin/mysqld.exe')
  ].filter(Boolean) as string[];

  const mysqldBin = candidateBins.find(p => fs.existsSync(p));
  if (!mysqldBin) {
    return;
  }

  const candidateDataDirs = [
    process.env.MYSQL_DATA_DIR,
    'C:\\Users\\Thirukumaran AR\\flownexus-mysql\\data',
    path.resolve(path.dirname(path.dirname(mysqldBin)), 'data')
  ].filter(Boolean) as string[];

  const dataDir = candidateDataDirs.find(p => fs.existsSync(p));
  if (!dataDir) {
    return;
  }

  console.log(`[MySQL] Port 3306 not active. Auto-starting portable MySQL from: ${mysqldBin}`);
  const child = spawn(mysqldBin, [
    `--datadir=${dataDir}`,
    '--port=3306',
    '--bind-address=127.0.0.1',
    '--console'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  const start = Date.now();
  while (Date.now() - start < 10000) {
    await new Promise(r => setTimeout(r, 400));
    if (await checkPortOpen(3306, '127.0.0.1', 500)) {
      console.log('[MySQL] Portable MySQL server successfully auto-started on port 3306.');
      return;
    }
  }
  console.warn('[MySQL] Timed out waiting for auto-started MySQL to open port 3306.');
};

const systemRoles = [
  'REQUESTER',
  'INSTITUTION_MANAGER',
  'MANAGER',
  'FINANCE',
  'ACCOUNTANT',
  'VP',
  'HOI',
  'DEAN',
  'IT',
  'AUDIT',
  'HR',
  'MMI',
  'GENERAL_MANAGER',
  'GM',
  'CEO',
  'CHAIRMAN'
];

const initialSops = [
  { id: 'sop-1', title: 'Procurement Policy v2.1', desc: 'Guidelines for vendor selection and purchase orders above ₹50,000.', date: '15/08/2026' },
  { id: 'sop-2', title: 'Travel & Expense Policy', desc: 'Reimbursement limits and approval hierarchy for official travel.', date: '01/07/2026' },
  { id: 'sop-3', title: 'SLA Guidelines', desc: '10-hour SLA threshold for all approval requests with auto-escalation rules.', date: '10/06/2026' },
  { id: 'sop-4', title: 'Business Activity Approval SOP', desc: 'Procedure for industrial visits, conferences, and FDP approvals.', date: '20/05/2026' }
];

const DEFAULT_PASSWORD = 'Password@123456';
const DEMO_PASSWORD = 'pass123';

const SEED_USERS = [
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

export const connectDatabase = async (url = process.env.DATABASE_URL): Promise<void> => {
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for MySQL connection. Configure it in backend/.env with mysql://USER:PASSWORD@HOST:PORT/DATABASE. No in-memory or MongoDB fallback is permitted.'
    );
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        await ensureMySQLDaemon();
        await prisma.$connect();
        isDbConnected = true;
        console.log(`[MySQL] Connected successfully via Prisma ORM (${url.replace(/:[^:@]+@/, ':****@')})`);
        await initializeDatabase();
      } catch (err: any) {
        isDbConnected = false;
        console.error(`[MySQL] Connection error: ${err.message}`);
        throw err;
      }
    })();
  }

  await connectionPromise;
};

export const initializeDatabase = async (): Promise<void> => {
  const now = new Date().toISOString();

  // 1. Initialize system roles
  for (const name of systemRoles) {
    const canCreate = ['REQUESTER', 'INSTITUTION_MANAGER', 'MANAGER', 'FINANCE', 'ACCOUNTANT', 'VP', 'HOI', 'DEAN'].includes(name);
    await prisma.role.upsert({
      where: { name },
      update: {
        canCreateRequests: canCreate,
        systemRole: true
      },
      create: {
        name,
        displayName: name,
        canCreateRequests: canCreate,
        systemRole: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      }
    });
  }

  // 2. Initialize General Approval Workflow
  const defaultGw = getDefaultGeneralWorkflow();
  const existingGw = await prisma.workflowDefinition.findUnique({ where: { id: defaultGw.id } });
  if (!existingGw) {
    const gwStagesJson = JSON.stringify({
      stages: defaultGw.stages,
      branchConfigs: defaultGw.branchConfigs,
      history: defaultGw.history || []
    });

    await prisma.workflowDefinition.create({
      data: {
        id: defaultGw.id,
        name: defaultGw.name,
        active: true,
        currentVersion: defaultGw.version,
        createdAt: defaultGw.activatedAt || now,
        updatedAt: defaultGw.activatedAt || now
      }
    });

    await prisma.workflowVersion.create({
      data: {
        id: `ver-${defaultGw.id}-${defaultGw.version}`,
        workflowId: defaultGw.id,
        version: defaultGw.version,
        name: `${defaultGw.name} v${defaultGw.version}`,
        description: 'Default general multi-stage workflow with Dean checkpoint and post-Dean branches',
        isPublished: true,
        publishedAt: defaultGw.activatedAt || now,
        publishedBy: defaultGw.activatedBy || 'system',
        stagesJson: gwStagesJson
      }
    });
  }

  // 3. Initialize the 4 Department Workflows (HR, IT, AUDIT, MMI)
  const deptConfigs: Array<'IT' | 'AUDIT' | 'HR' | 'MMI'> = ['IT', 'AUDIT', 'HR', 'MMI'];
  for (const dept of deptConfigs) {
    const deptWf = getDefaultDepartmentWorkflow(dept);
    const existing = await prisma.workflowDefinition.findUnique({
      where: { id: deptWf.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    const deptStagesJson = JSON.stringify({
      stages: deptWf.stages,
      branchConfigs: [],
      history: deptWf.history
    });

    if (!existing) {
      await prisma.workflowDefinition.create({
        data: {
          id: deptWf.id,
          name: deptWf.name,
          active: true,
          currentVersion: 1,
          createdAt: now,
          updatedAt: now
        }
      });

      await prisma.workflowVersion.create({
        data: {
          id: `ver-${deptWf.id}-1`,
          workflowId: deptWf.id,
          version: 1,
          name: `${deptWf.name} v1`,
          description: `Initial default multi-stage workflow for ${deptWf.name}`,
          isPublished: true,
          publishedAt: now,
          publishedBy: 'system',
          stagesJson: deptStagesJson
        }
      });
    } else {
      // Ensure department workflow has the full 9-stage sequence if older legacy structure was saved
      const latestVer = existing.versions[0];
      if (latestVer) {
        try {
          const parsed = JSON.parse(latestVer.stagesJson);
          if (!parsed.stages || !Array.isArray(parsed.stages) || parsed.stages.length < 9) {
            await prisma.workflowVersion.update({
              where: { id: latestVer.id },
              data: { stagesJson: deptStagesJson }
            });
          }
        } catch {
          await prisma.workflowVersion.update({
            where: { id: latestVer.id },
            data: { stagesJson: deptStagesJson }
          });
        }
      }
    }
  }

  // 4. Initialize initial SOPs
  for (const sop of initialSops) {
    await prisma.sOP.upsert({
      where: { id: sop.id },
      update: { title: sop.title, desc: sop.desc, date: sop.date },
      create: { id: sop.id, title: sop.title, desc: sop.desc, date: sop.date }
    });
  }

  // 5. Initialize demo users if not present
  // 5. Initialize demo users with pass123 credentials
  const demoHash = await hashPassword(DEMO_PASSWORD);
  for (const user of SEED_USERS) {
    const email = user.email.toLowerCase().trim();
    await prisma.user.upsert({
      where: { email },
      update: {
        name: user.name,
        role: user.role,
        dept: user.dept,
        employeeId: user.employeeId,
        passwordHash: demoHash,
        isActive: true
      },
      create: {
        id: randomUUID(),
        email,
        name: user.name,
        role: user.role,
        dept: user.dept,
        employeeId: user.employeeId,
        passwordHash: demoHash,
        company: 'FlowNexus',
        businessUnit: 'Main',
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    });
  }
};

export const writeAuditEvent = async (
  event: {
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  },
  clientOrTx: Prisma.TransactionClient | PrismaClient = prisma
) => {
  const ts = new Date().toISOString();
  return clientOrTx.auditLog.create({
    data: {
      id: randomUUID(),
      actorId: event.actorId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
      requestId: event.targetType === 'Request' ? event.targetId : null,
      ts
    }
  });
};

export const withTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    return operation(tx);
  }, {
    maxWait: 10000,
    timeout: 30000
  });
};

// Backward-compatible alias for existing controllers
export const withMongoTransaction = withTransaction;

export const databaseIsReady = () => isDbConnected;