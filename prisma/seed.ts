import { PrismaClient, UserRole, SchoolYearStatus, AssessmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedFictionalDevelopmentData() {
  console.log('🌱 Starting Prisma fictional development database seed...');

  // Default fictional hashed password for testing environments
  const defaultSalt = await bcrypt.genSalt(10);
  const fictionalPasswordHash = await bcrypt.hash('Demo@Fictional2026', defaultSalt);

  // 1. Seed Classification Options
  const classifications = [
    { code: 'ELEM', name: 'Elementary School (Kinder - Grade 6)' },
    { code: 'JHS', name: 'Junior High School (Grade 7 - 10)' },
    { code: 'SHS', name: 'Senior High School (Grade 11 - 12)' },
    { code: 'INT', name: 'Integrated School (Kinder - Grade 12)' },
  ];

  for (const item of classifications) {
    await prisma.classificationOption.upsert({
      where: { code: item.code },
      update: { name: item.name },
      create: { code: item.code, name: item.name, isActive: true },
    });
  }

  // 2. Seed Two Fictional Divisions
  const divisionA = await prisma.division.upsert({
    where: { divisionCode: 'DIV-AURORA' },
    update: { divisionName: 'Division of Aurora Highlands' },
    create: {
      divisionCode: 'DIV-AURORA',
      divisionName: 'Division of Aurora Highlands',
    },
  });

  const divisionB = await prisma.division.upsert({
    where: { divisionCode: 'DIV-HORIZON' },
    update: { divisionName: 'Division of Horizon Coastline' },
    create: {
      divisionCode: 'DIV-HORIZON',
      divisionName: 'Division of Horizon Coastline',
    },
  });

  // 3. Seed One Regional Administrator (Fictional credentials)
  const regionalAdmin = await prisma.user.upsert({
    where: { username: 'fictional.regional.admin' },
    update: {
      fullName: 'Dr. Alex Vance (Fictional Regional Admin)',
      email: 'alex.vance@fictional-region.gov.example',
      role: UserRole.regional,
    },
    create: {
      username: 'fictional.regional.admin',
      fullName: 'Dr. Alex Vance (Fictional Regional Admin)',
      email: 'alex.vance@fictional-region.gov.example',
      passwordHash: fictionalPasswordHash,
      role: UserRole.regional,
      isActive: true,
    },
  });

  // Division Administrator for Division A (Fictional)
  await prisma.user.upsert({
    where: { username: 'fictional.division.aurora' },
    update: {
      fullName: 'Morgan Bailey (Fictional Division Lead)',
      divisionId: divisionA.id,
    },
    create: {
      username: 'fictional.division.aurora',
      fullName: 'Morgan Bailey (Fictional Division Lead)',
      email: 'morgan.bailey@fictional-aurora.gov.example',
      passwordHash: fictionalPasswordHash,
      role: UserRole.division,
      divisionId: divisionA.id,
      isActive: true,
    },
  });

  // 4. Seed Four Fictional Schools
  const fictionalSchools = [
    {
      schoolId: '990001',
      schoolName: 'Aurora Summit Science High School',
      divisionId: divisionA.id,
      district: 'District North Alpha',
      classification: 'Junior High School (Grade 7 - 10)',
      schoolHead: 'Jordan Chen (Fictional Principal)',
    },
    {
      schoolId: '990002',
      schoolName: 'Silver Valley Community Elementary',
      divisionId: divisionA.id,
      district: 'District North Beta',
      classification: 'Elementary School (Kinder - Grade 6)',
      schoolHead: 'Taylor Brooks (Fictional Principal)',
    },
    {
      schoolId: '990003',
      schoolName: 'Horizon Bay Comprehensive High School',
      divisionId: divisionB.id,
      district: 'District South Coastal',
      classification: 'Integrated School (Kinder - Grade 12)',
      schoolHead: 'Casey Miller (Fictional Principal)',
    },
    {
      schoolId: '990004',
      schoolName: 'Coral Reef Maritime Integrated Academy',
      divisionId: divisionB.id,
      district: 'District South Islands',
      classification: 'Senior High School (Grade 11 - 12)',
      schoolHead: 'Riley Harper (Fictional Principal)',
    },
  ];

  for (const s of fictionalSchools) {
    const schoolRecord = await prisma.school.upsert({
      where: { schoolId: s.schoolId },
      update: {
        schoolName: s.schoolName,
        district: s.district,
        classification: s.classification,
        schoolHead: s.schoolHead,
      },
      create: s,
    });

    // Seed dedicated school user account
    await prisma.user.upsert({
      where: { username: s.schoolId },
      update: {
        schoolId: schoolRecord.id,
        divisionId: s.divisionId,
      },
      create: {
        username: s.schoolId,
        fullName: `${s.schoolHead} - ${s.schoolName}`,
        email: `principal.${s.schoolId}@fictional-school.example`,
        passwordHash: fictionalPasswordHash,
        role: UserRole.school,
        divisionId: s.divisionId,
        schoolId: schoolRecord.id,
        isActive: true,
      },
    });
  }

  // 5. Seed One Active School Year (2026-2027)
  const activeSchoolYear = await prisma.schoolYear.upsert({
    where: { label: '2026-2027' },
    update: {
      status: SchoolYearStatus.Active,
    },
    create: {
      label: '2026-2027',
      status: SchoolYearStatus.Active,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-05-31'),
    },
  });

  // Ensure any other school years are not Active
  await prisma.schoolYear.updateMany({
    where: {
      id: { not: activeSchoolYear.id },
      status: SchoolYearStatus.Active,
    },
    data: { status: SchoolYearStatus.Open },
  });

  // 6. Seed One Editable Assessment Form
  const assessmentForm = await prisma.assessmentForm.upsert({
    where: { schoolYearId: activeSchoolYear.id },
    update: {
      title: 'Standard School-Based Management Quality Assessment Form (SY 2026-2027)',
      isEditable: true,
      instructions:
        'Conduct a collaborative self-assessment across all key dimensions with the School SBM Committee. Ratings (1-4) must be validated with authentic Means of Verification (MOVs).',
      ratingLabel1: 'Level 1: Developing (Basic Implementation)',
      ratingLabel2: 'Level 2: Maturing (Systematized Practices)',
      ratingLabel3: 'Level 3: Advanced (Sustained Culture)',
      ratingLabel4: 'Level 4: Exemplary (Benchmark Best Practice)',
      requireAllIndicators: true,
      requireGlobalRemarks: true,
    },
    create: {
      schoolYearId: activeSchoolYear.id,
      title: 'Standard School-Based Management Quality Assessment Form (SY 2026-2027)',
      isEditable: true,
      instructions:
        'Conduct a collaborative self-assessment across all key dimensions with the School SBM Committee. Ratings (1-4) must be validated with authentic Means of Verification (MOVs).',
      ratingLabel1: 'Level 1: Developing (Basic Implementation)',
      ratingLabel2: 'Level 2: Maturing (Systematized Practices)',
      ratingLabel3: 'Level 3: Advanced (Sustained Culture)',
      ratingLabel4: 'Level 4: Exemplary (Benchmark Best Practice)',
      requireAllIndicators: true,
      requireGlobalRemarks: true,
    },
  });

  // 7. Seed Six Sample Indicators covering Two Sections
  const sampleIndicators = [
    // Section 1: Leadership and Governance
    {
      sectionName: 'Leadership and Governance',
      sectionOrder: 1,
      indicatorNumber: '1.1',
      orderIndex: 1,
      content:
        'The school development plan (SIP/AIP) is formulated collaboratively with internal and external community stakeholders and monitored regularly.',
    },
    {
      sectionName: 'Leadership and Governance',
      sectionOrder: 1,
      indicatorNumber: '1.2',
      orderIndex: 2,
      content:
        'The organizational governance framework encourages shared leadership, ethical stewardship, and institutional transparency.',
    },
    {
      sectionName: 'Leadership and Governance',
      sectionOrder: 1,
      indicatorNumber: '1.3',
      orderIndex: 3,
      content:
        'A functional monitoring and evaluation (M&E) system tracks school improvement progress systematically and informs policy adjustments.',
    },
    // Section 2: Curriculum and Instruction
    {
      sectionName: 'Curriculum and Instruction',
      sectionOrder: 2,
      indicatorNumber: '2.1',
      orderIndex: 4,
      content:
        'Curriculum delivery is contextualized and differentiated to address diverse learner demographics, talents, and developmental needs.',
    },
    {
      sectionName: 'Curriculum and Instruction',
      sectionOrder: 2,
      indicatorNumber: '2.2',
      orderIndex: 5,
      content:
        'Appropriate instructional materials, digital technologies, and interactive learning resources are utilized effectively.',
    },
    {
      sectionName: 'Curriculum and Instruction',
      sectionOrder: 2,
      indicatorNumber: '2.3',
      orderIndex: 6,
      content:
        'Diagnostic, formative, and summative assessments are consistently administered and analyzed to guide learner interventions and enrichment.',
    },
  ];

  for (const ind of sampleIndicators) {
    await prisma.assessmentFormIndicator.upsert({
      where: {
        uq_form_indicator_number: {
          formId: assessmentForm.id,
          indicatorNumber: ind.indicatorNumber,
        },
      },
      update: {
        content: ind.content,
        sectionName: ind.sectionName,
        sectionOrder: ind.sectionOrder,
        orderIndex: ind.orderIndex,
        isActive: true,
      },
      create: {
        formId: assessmentForm.id,
        sectionName: ind.sectionName,
        sectionOrder: ind.sectionOrder,
        indicatorNumber: ind.indicatorNumber,
        content: ind.content,
        orderIndex: ind.orderIndex,
        isActive: true,
      },
    });
  }

  // 8. Seed System Settings for Structured Customization Values
  await prisma.systemSetting.upsert({
    where: { key: 'portal_branding' },
    update: {
      value: {
        eyebrow: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE',
        portalTitle: 'Project SBM Online',
        primaryColor: '#0038a8',
        accentColor: '#ce1126',
        publicAdvisory: 'Development mode active. All entities use fictional simulation data.',
      },
    },
    create: {
      key: 'portal_branding',
      value: {
        eyebrow: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE',
        portalTitle: 'Project SBM Online',
        primaryColor: '#0038a8',
        accentColor: '#ce1126',
        publicAdvisory: 'Development mode active. All entities use fictional simulation data.',
      },
      description: 'Regional login portal visual branding and theme configuration',
    },
  });

  // 9. Record Initial Audit Log entry
  await prisma.auditLog.create({
    data: {
      userId: regionalAdmin.id,
      action: 'SYSTEM_SEED',
      resourceType: 'Database',
      resourceId: 'prisma_init',
      details: {
        message: 'Initialized fictional development database via Prisma seed',
        fictionalDivisionsCount: 2,
        fictionalSchoolsCount: 4,
        activeSchoolYear: '2026-2027',
      },
    },
  });

  console.log('✅ Fictional development database seeded successfully!');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedFictionalDevelopmentData()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
