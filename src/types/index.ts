export type UserRole = 'regional' | 'division' | 'school';

export interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  fullName: string;
  logo?: string | null;
  divisionId: number | null;
  divisionName?: string | null;
  divisionCode?: string | null;
  divisionLogo?: string | null;
  schoolId: number | null;
  schoolDepedId?: string | null;
  schoolName?: string | null;
  schoolDistrict?: string | null;
  schoolClassification?: string | null;
  schoolHead?: string | null;
  schoolLogo?: string | null;
  regionLogo?: string | null;
  isActive: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  activeSchoolYear: SchoolYearSummary | null;
}

export interface SchoolYearSummary {
  id: number;
  name: string;
  isActive: boolean;
  isClosed: boolean;
  assessmentCount?: number;
  indicatorCount?: number;
}

export interface DivisionItem {
  id: number;
  divisionCode: string;
  divisionName: string;
  logo?: string | null;
  adminName?: string | null;
  username?: string | null;
  userId?: number | null;
  isActive?: boolean;
  schoolCount?: number;
  submittedCount?: number;
  draftCount?: number;
  notStartedCount?: number;
  averageRating?: string;
  completionPercentage?: number;
}

export interface SchoolItem {
  id: number;
  schoolId: string; // 6-digit DepEd ID
  schoolName: string;
  divisionId: number;
  divisionName?: string;
  district: string;
  classification: string;
  schoolHead: string;
  userAccountExists?: boolean;
  assessmentStatus?: 'Not started' | 'Draft' | 'Submitted';
  answeredCount?: number;
  totalActiveIndicators?: number;
  averageRating?: string;
  lastUpdated?: string;
}

export interface AssessmentFormConfig {
  id: number;
  schoolYearId: number;
  schoolYearName: string;
  title: string;
  instructions: string;
  ratingLabel1: string;
  ratingLabel2: string;
  ratingLabel3: string;
  ratingLabel4: string;
  status: 'draft' | 'published';
  allowEditAfterSubmission: boolean;
  requireAllIndicators: boolean;
  requireGlobalRemarks: boolean;
  requireIndicatorRemarks: boolean;
  sections: FormSectionItem[];
}

export interface FormSectionItem {
  id: number;
  formId: number;
  title: string;
  orderIndex: number;
  indicators: FormIndicatorItem[];
}

export interface FormIndicatorItem {
  id: number;
  formId: number;
  sectionId: number;
  code: string;
  content: string;
  orderIndex: number;
  isActive: boolean;
}

export interface AssessmentSubmissionData {
  schoolYearId: number;
  schoolId: number;
  status: 'Draft' | 'Submitted';
  globalRemarks: string;
  responses: {
    indicatorId: number;
    rating: number;
    remarks?: string;
  }[];
}

export interface MonitoringRow {
  schoolDbId: number;
  schoolId: string;
  schoolName: string;
  divisionId: number;
  divisionName: string;
  district: string;
  classification: string;
  status: 'Not started' | 'Draft' | 'Submitted';
  answeredCount: number;
  totalIndicators: number;
  averageRating: string;
  lastUpdated: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
}

export interface SystemCustomizationData {
  id: number;
  siteTitle: string;
  regionTitle: string;
  navbarLogo: string | null;
  regionLogo?: string | null;
  favicon: string | null;
  baseFontSize: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

export interface LoginCustomizationData {
  id: number;
  eyebrowText: string;
  mainHeading: string;
  description: string;
  loginFormTitle: string;
  loginFormDescription: string;
  publicAnnouncement: string;
  loginLogo: string | null;
  brandPanelBg: string | null;
  primaryColor: string;
  gradientColor: string;
  accentColor: string;
  loginPanelColor: string;
  showFullFooter: boolean;
}

export interface FooterCustomizationData {
  id: number;
  firstWideLogo: string | null;
  logo2: string | null;
  logo3: string | null;
  footerText: string;
  supportEmail: string;
  telephone: string;
  dataPrivacyUrl: string;
  termsUrl: string;
  userManualUrl: string;
  facebookUrl: string;
  websiteUrl: string;
}

export type User = UserProfile;
export type SchoolYear = SchoolYearSummary;
export type SystemCustomization = SystemCustomizationData;
export type LoginCustomization = LoginCustomizationData;
export type FooterCustomization = FooterCustomizationData;
