const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date().toISOString();
  const stages = [
    { id: 'gw-1', stageKey: 'STAGE_IM', role: 'INSTITUTION_MANAGER', label: 'Institution Manager', stageOrder: 1, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-2', stageKey: 'STAGE_FINANCE', role: 'FINANCE', label: 'Finance Head', stageOrder: 2, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-3', stageKey: 'STAGE_ACCOUNTANT', role: 'ACCOUNTANT', label: 'Accountant', stageOrder: 3, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-4', stageKey: 'STAGE_VP', role: 'VP', label: 'Vice President', stageOrder: 4, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-5', stageKey: 'STAGE_HOI', role: 'HOI', label: 'Head of Institution', stageOrder: 5, stageType: 'PRE_DEAN', isApplicable: true },
    { id: 'gw-6', stageKey: 'STAGE_DEAN', role: 'DEAN', label: 'Dean Checkpoint', stageOrder: 6, stageType: 'DEAN', isApplicable: true },
    { id: 'gw-7', stageKey: 'STAGE_CEO', role: 'CEO', label: 'Chief Executive Officer', stageOrder: 7, stageType: 'POST_BRANCH', isApplicable: true },
    { id: 'gw-8', stageKey: 'STAGE_CHAIRMAN', role: 'CHAIRMAN', label: 'Chairman', stageOrder: 8, stageType: 'POST_BRANCH', isApplicable: true }
  ];

  const branchConfigs = [
    { branchKey: 'IT', displayName: 'IT Branch', role: 'IT', isActive: true },
    { branchKey: 'AUDIT', displayName: 'Audit Branch', role: 'AUDIT', isActive: true },
    { branchKey: 'HR', displayName: 'HR Branch', role: 'HR', isActive: true },
    { branchKey: 'MMI', displayName: 'MMI Branch', role: 'MMI', isActive: true }
  ];

  const history = [
    {
      version: 13,
      activatedAt: now,
      activatedBy: 'Chief Executive Officer',
      reason: 'Standard Institutional Workflow: Requester -> IM -> Finance -> Accountant -> VP -> HOI -> Dean -> (IT/Audit/HR/MMI) -> CEO -> Chairman'
    }
  ];

  const stagesJson = JSON.stringify({ stages, branchConfigs, history });

  // Find max version
  const highestVersion = await prisma.workflowVersion.findFirst({
    where: { workflowId: 'workflow-general' },
    orderBy: { version: 'desc' }
  });
  const newVersion = Math.max((highestVersion?.version || 12) + 1, 13);

  // Upsert definition
  await prisma.workflowDefinition.upsert({
    where: { id: 'workflow-general' },
    update: {
      name: 'General Approval Workflow',
      active: true,
      currentVersion: newVersion,
      updatedAt: now
    },
    create: {
      id: 'workflow-general',
      name: 'General Approval Workflow',
      active: true,
      currentVersion: newVersion,
      createdAt: now,
      updatedAt: now
    }
  });

  // Create version record
  const created = await prisma.workflowVersion.create({
    data: {
      id: `ver-workflow-general-${newVersion}`,
      workflowId: 'workflow-general',
      version: newVersion,
      name: `Standard Institutional Workflow v${newVersion}`,
      description: 'Requester -> Institution Manager -> Finance -> Accountant -> VP -> HOI -> Dean -> (IT/Audit/HR/MMI) -> CEO -> Chairman',
      isPublished: true,
      publishedAt: now,
      publishedBy: 'Chief Executive Officer',
      stagesJson
    }
  });

  console.log(`Successfully published workflow-general v${newVersion} to MySQL:`, created.id);
}

main()
  .catch(err => {
    console.error('Error syncing workflow:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
