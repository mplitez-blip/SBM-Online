import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import {
  divisions,
  schools,
  schoolClassifications,
  users,
  schoolYears,
  assessmentForms,
  formSections,
  formIndicators,
  assessments,
  assessmentResponses,
  systemCustomization,
  loginCustomization,
  footerCustomization,
} from './schema.ts';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  console.log('--- Starting SBM Online Database Seeding ---');

  // 1. School Classifications
  const existingClassifications = await db.select().from(schoolClassifications);
  if (existingClassifications.length === 0) {
    await db.insert(schoolClassifications).values([
      { name: 'Elementary', isActive: true },
      { name: 'Integrated School', isActive: true },
      { name: 'Secondary (JHS with SHS)', isActive: true },
    ]);
    console.log('Seeded classifications');
  }

  // 2. Divisions of Region VIII
  const divisionList = [
    { divisionCode: 'LEYTE', divisionName: 'Division of Leyte' },
    { divisionCode: 'SOUTHERN_LEYTE', divisionName: 'Division of Southern Leyte' },
    { divisionCode: 'SAMAR', divisionName: 'Division of Samar' },
    { divisionCode: 'EASTERN_SAMAR', divisionName: 'Division of Eastern Samar' },
    { divisionCode: 'NORTHERN_SAMAR', divisionName: 'Division of Northern Samar' },
    { divisionCode: 'BILIRAN', divisionName: 'Division of Biliran' },
    { divisionCode: 'TACLOBAN_CITY', divisionName: 'Division of Tacloban City' },
    { divisionCode: 'ORMOC_CITY', divisionName: 'Division of Ormoc City' },
    { divisionCode: 'BAYBAY_CITY', divisionName: 'Division of Baybay City' },
    { divisionCode: 'BORONGAN_CITY', divisionName: 'Division of Borongan City' },
    { divisionCode: 'CATBALOGAN_CITY', divisionName: 'Division of Catbalogan City' },
    { divisionCode: 'CALBAYOG_CITY', divisionName: 'Division of Calbayog City' },
    { divisionCode: 'MAASIN_CITY', divisionName: 'Division of Maasin City' },
  ];

  for (const div of divisionList) {
    const existing = await db.select().from(divisions).where(eq(divisions.divisionCode, div.divisionCode));
    if (existing.length === 0) {
      await db.insert(divisions).values(div);
    }
  }
  const allDivisions = await db.select().from(divisions);
  const divMap = new Map(allDivisions.map((d) => [d.divisionCode, d.id]));

  // 3. Sample Schools
  const sampleSchools = [
    {
      schoolId: '303512',
      schoolName: 'Leyte National High School',
      divisionId: divMap.get('TACLOBAN_CITY') || allDivisions[0].id,
      district: 'District I',
      classification: 'Secondary (JHS with SHS)',
      schoolHead: 'Dr. Bernabe L. Linabog',
    },
    {
      schoolId: '121345',
      schoolName: 'Tacloban City Pilot Elementary School',
      divisionId: divMap.get('TACLOBAN_CITY') || allDivisions[0].id,
      district: 'District II',
      classification: 'Elementary',
      schoolHead: 'Ma. Elena S. De la Cruz',
    },
    {
      schoolId: '303601',
      schoolName: 'Ormoc City Senior High School',
      divisionId: divMap.get('ORMOC_CITY') || allDivisions[0].id,
      district: 'Ormoc North District',
      classification: 'Secondary (JHS with SHS)',
      schoolHead: 'Roberto G. Sanchez',
    },
    {
      schoolId: '122456',
      schoolName: 'Tanauan Integrated School',
      divisionId: divMap.get('LEYTE') || allDivisions[0].id,
      district: 'Tanauan I',
      classification: 'Integrated School',
      schoolHead: 'Cynthia M. Perez',
    },
    {
      schoolId: '123789',
      schoolName: 'Catbalogan Central Elementary School',
      divisionId: divMap.get('CATBALOGAN_CITY') || allDivisions[0].id,
      district: 'Catbalogan District I',
      classification: 'Elementary',
      schoolHead: 'Ramon V. Tan',
    },
    {
      schoolId: '303889',
      schoolName: 'Samar National High School',
      divisionId: divMap.get('SAMAR') || allDivisions[0].id,
      district: 'Catbalogan District II',
      classification: 'Secondary (JHS with SHS)',
      schoolHead: 'Lilia F. Navarro',
    },
    {
      schoolId: '124501',
      schoolName: 'Baybay City Demonstration School',
      divisionId: divMap.get('BAYBAY_CITY') || allDivisions[0].id,
      district: 'Baybay District 3',
      classification: 'Elementary',
      schoolHead: 'Arturo P. Ramirez',
    },
    {
      schoolId: '304112',
      schoolName: 'Maasin City National High School',
      divisionId: divMap.get('MAASIN_CITY') || allDivisions[0].id,
      district: 'Maasin West',
      classification: 'Secondary (JHS with SHS)',
      schoolHead: 'Grace L. Mercado',
    },
  ];

  for (const sch of sampleSchools) {
    const existing = await db.select().from(schools).where(eq(schools.schoolId, sch.schoolId));
    if (existing.length === 0) {
      await db.insert(schools).values(sch);
    }
  }

  const allSchools = await db.select().from(schools);
  const schoolMap = new Map(allSchools.map((s) => [s.schoolId, s.id]));

  // 4. Default Users
  const salt = await bcrypt.genSalt(10);
  const regionalHash = await bcrypt.hash('Admin@123', salt);
  const divisionHash = await bcrypt.hash('Division@123', salt);
  const schoolHash = await bcrypt.hash('School@123', salt);

  const defaultUsers = [
    {
      username: 'regional.admin',
      email: 'regional.admin@deped.gov.ph',
      passwordHash: regionalHash,
      role: 'regional',
      fullName: 'Dr. Evelyn R. Fetalvero, CESO IV (Regional Director)',
    },
    {
      username: 'division.tacloban',
      email: 'tacloban.division@deped.gov.ph',
      passwordHash: divisionHash,
      role: 'division',
      divisionId: divMap.get('TACLOBAN_CITY'),
      fullName: 'Dr. Sherlita A. Palma (Schools Division Superintendent)',
    },
    {
      username: 'division.leyte',
      email: 'leyte.division@deped.gov.ph',
      passwordHash: divisionHash,
      role: 'division',
      divisionId: divMap.get('LEYTE'),
      fullName: 'Dr. Mariza S. Magan (Schools Division Superintendent)',
    },
    {
      username: 'division.ormoc',
      email: 'ormoc.division@deped.gov.ph',
      passwordHash: divisionHash,
      role: 'division',
      divisionId: divMap.get('ORMOC_CITY'),
      fullName: 'Dr. Manuel P. Albaño (Schools Division Superintendent)',
    },
    {
      username: 'division.samar',
      email: 'samar.division@deped.gov.ph',
      passwordHash: divisionHash,
      role: 'division',
      divisionId: divMap.get('SAMAR'),
      fullName: 'Dr. Carmela R. Tamayo (Schools Division Superintendent)',
    },
    {
      username: 'school.303512',
      email: '303512@deped.gov.ph',
      passwordHash: schoolHash,
      role: 'school',
      divisionId: divMap.get('TACLOBAN_CITY'),
      schoolId: schoolMap.get('303512'),
      fullName: 'Dr. Bernabe L. Linabog (School Head)',
    },
    {
      username: 'school.121345',
      email: '121345@deped.gov.ph',
      passwordHash: schoolHash,
      role: 'school',
      divisionId: divMap.get('TACLOBAN_CITY'),
      schoolId: schoolMap.get('121345'),
      fullName: 'Ma. Elena S. De la Cruz (School Head)',
    },
    {
      username: 'school.303601',
      email: '303601@deped.gov.ph',
      passwordHash: schoolHash,
      role: 'school',
      divisionId: divMap.get('ORMOC_CITY'),
      schoolId: schoolMap.get('303601'),
      fullName: 'Roberto G. Sanchez (School Head)',
    },
  ];

  for (const u of defaultUsers) {
    const existing = await db.select().from(users).where(eq(users.username, u.username));
    if (existing.length === 0) {
      await db.insert(users).values(u);
    }
  }

  // 5. School Years
  let syCurrent = await db.select().from(schoolYears).where(eq(schoolYears.name, '2024-2025'));
  if (syCurrent.length === 0) {
    const inserted = await db
      .insert(schoolYears)
      .values([
        { name: '2024-2025', isActive: true, isClosed: false },
        { name: '2023-2024', isActive: false, isClosed: true },
      ])
      .returning();
    syCurrent = inserted.filter((s) => s.name === '2024-2025');
  }

  const activeSY = syCurrent[0];

  // 6. Assessment Form for active School Year
  const existingForm = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, activeSY.id));
  let activeFormId: number;

  if (existingForm.length === 0) {
    const [insertedForm] = await db
      .insert(assessmentForms)
      .values({
        schoolYearId: activeSY.id,
        title: 'DepEd SBM Assessment Tool (Standard Dimensions)',
        instructions:
          'Assess your school performance objectively across all key dimensions. Select the appropriate rating level (1-4) supported by verified Means of Verification (MOVs). Provide actionable qualitative remarks.',
        ratingLabel1: 'Level 1: Developing',
        ratingLabel2: 'Level 2: Maturing',
        ratingLabel3: 'Level 3: Advanced',
        ratingLabel4: 'Level 4: Exemplary',
        status: 'published',
        allowEditAfterSubmission: false,
        requireAllIndicators: true,
        requireGlobalRemarks: true,
        requireIndicatorRemarks: false,
      })
      .returning();

    activeFormId = insertedForm.id;

    // Dimensions/Sections
    const [s1] = await db
      .insert(formSections)
      .values({
        formId: activeFormId,
        title: 'Dimension 1: Leadership and Governance',
        orderIndex: 1,
      })
      .returning();

    const [s2] = await db
      .insert(formSections)
      .values({
        formId: activeFormId,
        title: 'Dimension 2: Curriculum and Learning',
        orderIndex: 2,
      })
      .returning();

    const [s3] = await db
      .insert(formSections)
      .values({
        formId: activeFormId,
        title: 'Dimension 3: Accountability and Continuous Improvement',
        orderIndex: 3,
      })
      .returning();

    const [s4] = await db
      .insert(formSections)
      .values({
        formId: activeFormId,
        title: 'Dimension 4: Management of Resources',
        orderIndex: 4,
      })
      .returning();

    // Indicators for Section 1
    await db.insert(formIndicators).values([
      {
        formId: activeFormId,
        sectionId: s1.id,
        code: '1.1',
        content:
          'The school development plan (SIP/AIP) is collaboratively developed and regularly reviewed by stakeholders.',
        orderIndex: 1,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s1.id,
        code: '1.2',
        content:
          'The school organizational structure promotes shared leadership, active collaboration, and responsiveness.',
        orderIndex: 2,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s1.id,
        code: '1.3',
        content:
          'A functional monitoring and evaluation (M&E) system tracks school improvement outcomes systematically.',
        orderIndex: 3,
        isActive: true,
      },
    ]);

    // Indicators for Section 2
    await db.insert(formIndicators).values([
      {
        formId: activeFormId,
        sectionId: s2.id,
        code: '2.1',
        content:
          'The curriculum is contextualized and enriched to address the distinct learning needs of all students.',
        orderIndex: 1,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s2.id,
        code: '2.2',
        content:
          'Diverse and appropriate learning resources (LRs) and instructional technologies are utilized effectively.',
        orderIndex: 2,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s2.id,
        code: '2.3',
        content:
          'Formative and summative learning assessment tools are consistently applied to improve learner performance.',
        orderIndex: 3,
        isActive: true,
      },
    ]);

    // Indicators for Section 3
    await db.insert(formIndicators).values([
      {
        formId: activeFormId,
        sectionId: s3.id,
        code: '3.1',
        content:
          'School community stakeholders actively participate in school governance and shared decision-making.',
        orderIndex: 1,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s3.id,
        code: '3.2',
        content:
          'Accountability mechanisms and transparent communication channels are established and maintained.',
        orderIndex: 2,
        isActive: true,
      },
    ]);

    // Indicators for Section 4
    await db.insert(formIndicators).values([
      {
        formId: activeFormId,
        sectionId: s4.id,
        code: '4.1',
        content:
          'Material, physical, and financial resources are allocated prudently according to prioritized school needs.',
        orderIndex: 1,
        isActive: true,
      },
      {
        formId: activeFormId,
        sectionId: s4.id,
        code: '4.2',
        content:
          'Resource mobilization engages internal and external community partners to support school initiatives.',
        orderIndex: 2,
        isActive: true,
      },
    ]);

    console.log('Seeded active assessment form and indicators');
  } else {
    activeFormId = existingForm[0].id;
  }

  // 7. Seed Sample Assessments for active school year (some Submitted, some Draft, some Not started)
  const activeIndicators = await db
    .select()
    .from(formIndicators)
    .where(eq(formIndicators.formId, activeFormId));

  const school1Id = schoolMap.get('303512');
  if (school1Id) {
    const existingAss = await db
      .select()
      .from(assessments)
      .where(eq(assessments.schoolId, school1Id));
    if (existingAss.length === 0) {
      const [ass1] = await db
        .insert(assessments)
        .values({
          schoolId: school1Id,
          schoolYearId: activeSY.id,
          status: 'Submitted',
          submittedAt: new Date(),
          submittedByName: 'Dr. Bernabe L. Linabog',
          globalRemarks:
            'All school improvement indicators were verified with the SBM Validation Committee and stakeholder council.',
          calculatedAverage: '3.60',
        })
        .returning();

      // Seed responses for school 1
      for (const ind of activeIndicators) {
        await db.insert(assessmentResponses).values({
          assessmentId: ass1.id,
          indicatorId: ind.id,
          rating: ind.orderIndex % 2 === 0 ? 4 : 3,
          remarks: 'Verified against school portfolio and MOVs.',
        });
      }
    }
  }

  const school2Id = schoolMap.get('121345');
  if (school2Id) {
    const existingAss = await db
      .select()
      .from(assessments)
      .where(eq(assessments.schoolId, school2Id));
    if (existingAss.length === 0) {
      const [ass2] = await db
        .insert(assessments)
        .values({
          schoolId: school2Id,
          schoolYearId: activeSY.id,
          status: 'Draft',
          submittedByName: 'Ma. Elena S. De la Cruz',
          globalRemarks: 'Draft ongoing review by School Quality Circle.',
          calculatedAverage: '2.80',
        })
        .returning();

      // Seed partial responses for school 2
      for (let i = 0; i < Math.min(5, activeIndicators.length); i++) {
        const ind = activeIndicators[i];
        await db.insert(assessmentResponses).values({
          assessmentId: ass2.id,
          indicatorId: ind.id,
          rating: 3,
          remarks: 'Initial assessment completed.',
        });
      }
    }
  }

  // 8. Customization Records
  const existingSys = await db.select().from(systemCustomization);
  if (existingSys.length === 0) {
    await db.insert(systemCustomization).values({
      siteTitle: 'Project SBM Online',
      regionTitle: 'Department of Education Regional Office VIII',
      baseFontSize: 15,
      primaryColor: '#0038a8', // DepEd Blue
      secondaryColor: '#495057',
      accentColor: '#ce1126', // DepEd Red / Gold
      backgroundColor: '#f4f6f9',
    });
  }

  const existingLogin = await db.select().from(loginCustomization);
  if (existingLogin.length === 0) {
    await db.insert(loginCustomization).values({
      eyebrowText: 'DEPARTMENT OF EDUCATION - REGIONAL OFFICE VIII',
      mainHeading: 'Project SBM Online',
      description:
        'A unified School-Based Management Self-Assessment, Monitoring, Administration, and Reporting System for Schools Division Offices and Schools in Region VIII.',
      loginFormTitle: 'Sign In to Your Account',
      loginFormDescription:
        'Enter your Regional, Division, or School credentials to continue.',
      publicAnnouncement:
        'DepEd RO8 Announcement: The SBM Validation Window for SY 2024-2025 is now OPEN. Divisions are requested to monitor school submissions actively.',
      primaryColor: '#0038a8',
      gradientColor: '#002266',
      accentColor: '#ce1126',
      loginPanelColor: '#ffffff',
      showFullFooter: true,
    });
  }

  const existingFooter = await db.select().from(footerCustomization);
  if (existingFooter.length === 0) {
    const defaultFooterText = `**Republic of the Philippines**
**DEPARTMENT OF EDUCATION**
**Regional Office No. VIII**
Government Center, Candahug, Palo, Leyte 6501

**Project SBM ONLINE**
Version 1.0 (2026) | *Regional Administrative Portal*

For technical support and system inquiries:
Quality Assurance Division (QAD) & Regional IT Officer`;

    await db.insert(footerCustomization).values({
      footerText: defaultFooterText,
      supportEmail: 'qad.region8@deped.gov.ph',
      telephone: '(053) 832-2997',
      dataPrivacyUrl: 'https://region8.deped.gov.ph/data-privacy-notice',
      termsUrl: 'https://region8.deped.gov.ph/terms-of-use',
      userManualUrl: 'https://region8.deped.gov.ph/sbm-user-manual',
      facebookUrl: 'https://www.facebook.com/DepEdROVIII',
      websiteUrl: 'https://region8.deped.gov.ph',
    });
  }

  console.log('--- SBM Online Database Seeding Complete ---');
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectExecution) {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ALLOW_DEVELOPMENT_SEED !== 'true'
  ) {
    console.error(
      'Development seeding is disabled. Set NODE_ENV=development and ' +
      'ALLOW_DEVELOPMENT_SEED=true to run this command.'
    );
    process.exit(1);
  }

  seedDatabase()
    .then(() => {
      console.log('Development seed completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Development seed failed.');
      console.error(error);
      process.exit(1);
    });
}
