import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Divisions in Regional Office VIII
export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  divisionCode: text('division_code').notNull().unique(),
  divisionName: text('division_name').notNull(),
  logo: text('logo'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Schools
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  schoolId: text('school_id').notNull().unique(),
  schoolName: text('school_name').notNull(),
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'cascade' }).notNull(),
  district: text('district').notNull(),
  classification: text('classification').notNull(),
  schoolHead: text('school_head').notNull(),
  logo: text('logo'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// School classifications (managed by regional admins)
export const schoolClassifications = pgTable('school_classifications', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // 'regional' | 'division' | 'school'
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'set null' }),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  logo: text('logo'),
  isActive: boolean('is_active').notNull().default(true),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockoutUntil: timestamp('lockout_until'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// School Years (YYYY-YYYY format)
export const schoolYears = pgTable('school_years', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isActive: boolean('is_active').notNull().default(false),
  isClosed: boolean('is_closed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Assessment Form per School Year
export const assessmentForms = pgTable('assessment_forms', {
  id: serial('id').primaryKey(),
  schoolYearId: integer('school_year_id').references(() => schoolYears.id, { onDelete: 'cascade' }).notNull().unique(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  ratingLabel1: text('rating_label_1').notNull().default('Level 1: Developing'),
  ratingLabel2: text('rating_label_2').notNull().default('Level 2: Maturing'),
  ratingLabel3: text('rating_label_3').notNull().default('Level 3: Advanced'),
  ratingLabel4: text('rating_label_4').notNull().default('Level 4: Exemplary'),
  status: text('status').notNull().default('draft'), // 'draft' | 'published'
  allowEditAfterSubmission: boolean('allow_edit_after_submission').notNull().default(false),
  requireAllIndicators: boolean('require_all_indicators').notNull().default(true),
  requireGlobalRemarks: boolean('require_global_remarks').notNull().default(false),
  requireIndicatorRemarks: boolean('require_indicator_remarks').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Form Sections / Dimensions
export const formSections = pgTable('form_sections', {
  id: serial('id').primaryKey(),
  formId: integer('form_id').references(() => assessmentForms.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Form Indicators
export const formIndicators = pgTable('form_indicators', {
  id: serial('id').primaryKey(),
  formId: integer('form_id').references(() => assessmentForms.id, { onDelete: 'cascade' }).notNull(),
  sectionId: integer('section_id').references(() => formSections.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull(),
  content: text('content').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// School Assessments
export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  schoolYearId: integer('school_year_id').references(() => schoolYears.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull().default('Not started'), // 'Not started' | 'Draft' | 'Submitted'
  submittedAt: timestamp('submitted_at'),
  submittedByName: text('submitted_by_name'),
  globalRemarks: text('global_remarks'),
  calculatedAverage: text('calculated_average').notNull().default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  schoolYearUnique: uniqueIndex('assessments_school_year_idx').on(table.schoolId, table.schoolYearId),
}));

// Assessment Responses per Indicator
export const assessmentResponses = pgTable('assessment_responses', {
  id: serial('id').primaryKey(),
  assessmentId: integer('assessment_id').references(() => assessments.id, { onDelete: 'cascade' }).notNull(),
  indicatorId: integer('indicator_id').references(() => formIndicators.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull().default(0), // 0=unanswered, 1-4
  remarks: text('remarks'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  assessmentIndicatorUnique: uniqueIndex('responses_assessment_indicator_idx').on(table.assessmentId, table.indicatorId),
}));

// System Branding Customization
export const systemCustomization = pgTable('system_customization', {
  id: serial('id').primaryKey(),
  siteTitle: text('site_title').notNull().default('Project SBM Online'),
  regionTitle: text('region_title').notNull().default('Department of Education Regional Office VIII'),
  navbarLogo: text('navbar_logo'),
  regionLogo: text('region_logo'),
  favicon: text('favicon'),
  baseFontSize: integer('base_font_size').notNull().default(15),
  primaryColor: text('primary_color').notNull().default('#0d6efd'),
  secondaryColor: text('secondary_color').notNull().default('#495057'),
  accentColor: text('accent_color').notNull().default('#ffc107'),
  backgroundColor: text('background_color').notNull().default('#f8f9fa'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Login Page Customization
export const loginCustomization = pgTable('login_customization', {
  id: serial('id').primaryKey(),
  eyebrowText: text('eyebrow_text').notNull().default('DEPARTMENT OF EDUCATION - REGIONAL OFFICE VIII'),
  mainHeading: text('main_heading').notNull().default('Project SBM Online'),
  description: text('description').notNull().default('A centralized School-Based Management Self-Assessment, Monitoring, Administration, and Reporting System for Eastern Visayas.'),
  loginFormTitle: text('login_form_title').notNull().default('Sign In to SBM Portal'),
  loginFormDescription: text('login_form_description').notNull().default('Enter your DepEd regional, division, or school credentials to access the system.'),
  publicAnnouncement: text('public_announcement').notNull().default('Official SBM self-assessment portal for Regional Office VIII. Validated data serves as the basis for school technical assistance and quality assurance.'),
  loginLogo: text('login_logo'),
  brandPanelBg: text('brand_panel_bg'),
  primaryColor: text('primary_color').notNull().default('#0d6efd'),
  gradientColor: text('gradient_color').notNull().default('#0a58ca'),
  accentColor: text('accent_color').notNull().default('#ffc107'),
  loginPanelColor: text('login_panel_color').notNull().default('#ffffff'),
  showFullFooter: boolean('show_full_footer').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Footer Customization
export const footerCustomization = pgTable('footer_customization', {
  id: serial('id').primaryKey(),
  firstWideLogo: text('first_wide_logo'),
  logo2: text('logo_2'),
  logo3: text('logo_3'),
  footerText: text('footer_text').notNull(),
  supportEmail: text('support_email').notNull().default('qad.region8@deped.gov.ph'),
  telephone: text('telephone').notNull().default('(053) 832-2997'),
  dataPrivacyUrl: text('data_privacy_url').notNull().default('#'),
  termsUrl: text('terms_url').notNull().default('#'),
  userManualUrl: text('user_manual_url').notNull().default('#'),
  facebookUrl: text('facebook_url').notNull().default('https://www.facebook.com/DepEdROVIII'),
  websiteUrl: text('website_url').notNull().default('https://region8.deped.gov.ph'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  username: text('username'),
  role: text('role'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const schoolsRelations = relations(schools, ({ one, many }) => ({
  division: one(divisions, {
    fields: [schools.divisionId],
    references: [divisions.id],
  }),
  assessments: many(assessments),
  users: many(users),
}));

export const divisionsRelations = relations(divisions, ({ many }) => ({
  schools: many(schools),
  users: many(users),
}));

export const assessmentFormsRelations = relations(assessmentForms, ({ one, many }) => ({
  schoolYear: one(schoolYears, {
    fields: [assessmentForms.schoolYearId],
    references: [schoolYears.id],
  }),
  sections: many(formSections),
  indicators: many(formIndicators),
}));

export const formSectionsRelations = relations(formSections, ({ one, many }) => ({
  form: one(assessmentForms, {
    fields: [formSections.formId],
    references: [assessmentForms.id],
  }),
  indicators: many(formIndicators),
}));

export const formIndicatorsRelations = relations(formIndicators, ({ one, many }) => ({
  section: one(formSections, {
    fields: [formIndicators.sectionId],
    references: [formSections.id],
  }),
  responses: many(assessmentResponses),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  school: one(schools, {
    fields: [assessments.schoolId],
    references: [schools.id],
  }),
  schoolYear: one(schoolYears, {
    fields: [assessments.schoolYearId],
    references: [schoolYears.id],
  }),
  responses: many(assessmentResponses),
}));

export const assessmentResponsesRelations = relations(assessmentResponses, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentResponses.assessmentId],
    references: [assessments.id],
  }),
  indicator: one(formIndicators, {
    fields: [assessmentResponses.indicatorId],
    references: [formIndicators.id],
  }),
}));
