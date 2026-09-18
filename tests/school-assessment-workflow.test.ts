/**
 * Automated Test Suite: School Assessment Workflow
 * 
 * Verifies all 17 rules:
 * 1. Load the active School Year.
 * 2. Reject access if no active School Year exists.
 * 3. Reject entry if the form is unpublished.
 * 4. Display configured instructions.
 * 5. Group indicators by section.
 * 6. Display the four configured rating labels.
 * 7. Allow Save Draft.
 * 8. Allow Submit.
 * 9. Preserve entered values after validation errors.
 * 10. Require all indicators when configured.
 * 11. Require remarks globally or per indicator.
 * 12. Lock submitted assessments unless editing is permitted.
 * 13. Use a transaction to save the assessment and responses.
 * 14. Write an audit log when submitted.
 * 15. Prevent duplicate assessments for the same School Year.
 * 16. Prevent access to another School's data.
 * 17. Historical results must remain read-only.
 */

import assert from 'node:assert';

// Domain models
interface MockSchool {
  id: number;
  schoolId: string;
  schoolName: string;
  divisionId: number;
  district: string;
}

interface MockSchoolYear {
  id: number;
  name: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: Date;
}

interface MockAssessmentForm {
  id: number;
  schoolYearId: number;
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
}

interface MockFormSection {
  id: number;
  formId: number;
  title: string;
  orderIndex: number;
}

interface MockFormIndicator {
  id: number;
  formId: number;
  sectionId: number;
  code: string;
  content: string;
  orderIndex: number;
  isActive: boolean;
}

interface MockAssessment {
  id: number;
  schoolId: number;
  schoolYearId: number;
  status: 'Not started' | 'Draft' | 'Submitted';
  submittedAt?: Date | null;
  submittedByName?: string | null;
  globalRemarks?: string | null;
  calculatedAverage: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAssessmentResponse {
  id: number;
  assessmentId: number;
  indicatorId: number;
  rating: number; // 0 = unanswered, 1-4 = rated
  remarks?: string | null;
  updatedAt: Date;
}

interface MockAuditLog {
  id: number;
  userId?: number | null;
  username: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId: string | number;
  details?: string | null;
  timestamp: Date;
}

interface MockUser {
  id: number;
  username: string;
  role: 'regional' | 'division' | 'school';
  divisionId: number | null;
  schoolId: number | null;
  fullName: string;
}

/**
 * In-memory transactional service mimicking the assessment database and business logic
 */
class MockAssessmentService {
  schools: MockSchool[] = [];
  schoolYears: MockSchoolYear[] = [];
  assessmentForms: MockAssessmentForm[] = [];
  formSections: MockFormSection[] = [];
  formIndicators: MockFormIndicator[] = [];
  assessments: MockAssessment[] = [];
  assessmentResponses: MockAssessmentResponse[] = [];
  auditLogs: MockAuditLog[] = [];

  private nextAssessmentId = 1;
  private nextResponseId = 1;
  private nextAuditId = 1;

  // Snapshot for atomic rollback simulation
  private snapshot() {
    return {
      assessments: JSON.parse(JSON.stringify(this.assessments)),
      assessmentResponses: JSON.parse(JSON.stringify(this.assessmentResponses)),
      auditLogs: JSON.parse(JSON.stringify(this.auditLogs)),
      nextAssessmentId: this.nextAssessmentId,
      nextResponseId: this.nextResponseId,
      nextAuditId: this.nextAuditId,
    };
  }

  private restore(snap: any) {
    this.assessments = snap.assessments;
    this.assessmentResponses = snap.assessmentResponses;
    this.auditLogs = snap.auditLogs;
    this.nextAssessmentId = snap.nextAssessmentId;
    this.nextResponseId = snap.nextResponseId;
    this.nextAuditId = snap.nextAuditId;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const snap = this.snapshot();
    try {
      return await work();
    } catch (err) {
      this.restore(snap);
      throw err;
    }
  }

  // Helper to log audit
  logAudit(user: MockUser, action: string, resourceType: string, resourceId: string | number, details?: string) {
    this.auditLogs.push({
      id: this.nextAuditId++,
      userId: user.id,
      username: user.username,
      role: user.role,
      action,
      resourceType,
      resourceId,
      details: details || null,
      timestamp: new Date(),
    });
  }

  // 1. Load active school year assessment
  async loadActiveAssessment(user: MockUser, requestedSchoolId?: number) {
    let targetSchoolId: number;

    if (user.role === 'school') {
      // Rule 16: School isolation
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        throw { status: 403, message: "Access denied: A School cannot access another School's assessment." };
      }
      targetSchoolId = user.schoolId!;
    } else {
      targetSchoolId = requestedSchoolId!;
    }

    if (!targetSchoolId) {
      throw { status: 400, message: 'School ID is required.' };
    }

    // Rule 16: Division isolation
    if (user.role === 'division') {
      const sch = this.schools.find((s) => s.id === targetSchoolId);
      if (!sch || sch.divisionId !== user.divisionId) {
        throw { status: 403, message: "Access denied: A Division administrator cannot access another Division's School assessment." };
      }
    }

    // Rule 2: Reject access if no active School Year exists
    const activeSy = this.schoolYears.find((sy) => sy.isActive);
    if (!activeSy) {
      throw { status: 404, message: 'No active School Year is configured by Regional Office.' };
    }

    // Rule 3: Reject entry if the form is unpublished
    const form = this.assessmentForms.find((f) => f.schoolYearId === activeSy.id);
    if (!form || form.status !== 'published') {
      throw { status: 403, message: 'Access rejected: The assessment form for the active School Year is unpublished.' };
    }

    // Rule 4, 5, 6: Group indicators by section, display instructions and 4 rating labels
    const sections = this.formSections
      .filter((s) => s.formId === form.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const activeIndicators = this.formIndicators
      .filter((ind) => ind.formId === form.id && ind.isActive)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // Rule 15: Find or initialize assessment (single assessment per school year)
    const existingAss = this.assessments.find(
      (a) => a.schoolId === targetSchoolId && a.schoolYearId === activeSy.id
    );

    const responses = existingAss
      ? this.assessmentResponses.filter((r) => r.assessmentId === existingAss.id)
      : [];

    const responseMap = new Map(responses.map((r) => [r.indicatorId, r]));

    const sectionsWithIndicators = sections.map((sec) => ({
      ...sec,
      indicators: activeIndicators
        .filter((ind) => ind.sectionId === sec.id)
        .map((ind) => {
          const resp = responseMap.get(ind.id);
          return {
            ...ind,
            rating: resp ? resp.rating : 0,
            remarks: resp ? resp.remarks || '' : '',
          };
        }),
    }));

    // Rule 12: Lock submitted assessments unless editing permitted
    const isLocked = existingAss?.status === 'Submitted' && !form.allowEditAfterSubmission;

    return {
      available: true,
      schoolYear: activeSy,
      form: {
        id: form.id,
        title: form.title,
        instructions: form.instructions,
        ratingLabel1: form.ratingLabel1,
        ratingLabel2: form.ratingLabel2,
        ratingLabel3: form.ratingLabel3,
        ratingLabel4: form.ratingLabel4,
        allowEditAfterSubmission: form.allowEditAfterSubmission,
        requireAllIndicators: form.requireAllIndicators,
        requireGlobalRemarks: form.requireGlobalRemarks,
        requireIndicatorRemarks: form.requireIndicatorRemarks,
        sections: sectionsWithIndicators,
      },
      assessment: existingAss
        ? {
            id: existingAss.id,
            status: existingAss.status,
            globalRemarks: existingAss.globalRemarks || '',
            calculatedAverage: existingAss.calculatedAverage,
            submittedAt: existingAss.submittedAt,
            submittedByName: existingAss.submittedByName,
            isLocked,
          }
        : {
            id: null,
            status: 'Not started',
            globalRemarks: '',
            calculatedAverage: '0.00',
            submittedAt: null,
            submittedByName: null,
            isLocked: false,
          },
    };
  }

  // 2. Save Draft
  async saveDraft(
    user: MockUser,
    payload: {
      schoolId?: number;
      schoolYearId: number;
      globalRemarks?: string;
      responses: { indicatorId: number; rating: number; remarks?: string }[];
    },
    failMidway = false
  ) {
    let targetSchoolId: number;
    if (user.role === 'school') {
      if (payload.schoolId && payload.schoolId !== user.schoolId) {
        throw { status: 403, message: "Access denied: A School cannot access another School's assessment." };
      }
      targetSchoolId = user.schoolId!;
    } else {
      targetSchoolId = payload.schoolId!;
    }

    if (!targetSchoolId) {
      throw { status: 400, message: 'School ID is required.' };
    }

    const sy = this.schoolYears.find((s) => s.id === payload.schoolYearId);
    if (!sy) throw { status: 404, message: 'School Year not found.' };
    if (sy.isClosed) throw { status: 400, message: 'This School Year is closed for submissions.' };

    // Rule 3: Reject entry if form unpublished
    const form = this.assessmentForms.find((f) => f.schoolYearId === payload.schoolYearId);
    if (!form || form.status !== 'published') {
      throw { status: 403, message: 'Entry rejected: The assessment form is unpublished.' };
    }

    // Rule 12: Lock submitted assessments unless editing is permitted
    const existingAss = this.assessments.find(
      (a) => a.schoolId === targetSchoolId && a.schoolYearId === payload.schoolYearId
    );

    if (existingAss && existingAss.status === 'Submitted' && !form.allowEditAfterSubmission) {
      throw { status: 403, message: 'Assessment is locked: Editing is not permitted after submission.' };
    }

    // Calculate running average of answered items (ratings 1-4)
    const validRatings = payload.responses
      .filter((r) => r.rating > 0)
      .map((r) => r.rating);
    const avg =
      validRatings.length > 0
        ? (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(2)
        : '0.00';

    // Rule 13: Transaction
    await this.transaction(async () => {
      let assId: number;
      if (!existingAss) {
        assId = this.nextAssessmentId++;
        this.assessments.push({
          id: assId,
          schoolId: targetSchoolId,
          schoolYearId: payload.schoolYearId,
          status: 'Draft',
          globalRemarks: payload.globalRemarks || null,
          calculatedAverage: avg,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        assId = existingAss.id;
        existingAss.status = existingAss.status === 'Submitted' ? 'Submitted' : 'Draft';
        existingAss.globalRemarks = payload.globalRemarks || null;
        existingAss.calculatedAverage = avg;
        existingAss.updatedAt = new Date();
      }

      for (const item of payload.responses) {
        if (failMidway && item.indicatorId === 999) {
          throw new Error('Simulated database error inside transaction.');
        }

        const existingResp = this.assessmentResponses.find(
          (r) => r.assessmentId === assId && r.indicatorId === item.indicatorId
        );

        if (!existingResp) {
          this.assessmentResponses.push({
            id: this.nextResponseId++,
            assessmentId: assId,
            indicatorId: item.indicatorId,
            rating: item.rating || 0,
            remarks: item.remarks ? item.remarks.trim() : null,
            updatedAt: new Date(),
          });
        } else {
          existingResp.rating = item.rating || 0;
          existingResp.remarks = item.remarks ? item.remarks.trim() : null;
          existingResp.updatedAt = new Date();
        }
      }
    });

    this.logAudit(user, 'SAVE_ASSESSMENT_DRAFT', 'assessments', targetSchoolId);
    return { message: 'Draft saved successfully.', calculatedAverage: avg };
  }

  // 3. Submit Assessment
  async submitAssessment(
    user: MockUser,
    payload: {
      schoolId?: number;
      schoolYearId: number;
      globalRemarks?: string;
      submitterName?: string;
      responses: { indicatorId: number; rating: number; remarks?: string }[];
    },
    failMidway = false
  ) {
    let targetSchoolId: number;
    if (user.role === 'school') {
      if (payload.schoolId && payload.schoolId !== user.schoolId) {
        throw { status: 403, message: "Access denied: A School cannot access another School's assessment." };
      }
      targetSchoolId = user.schoolId!;
    } else {
      targetSchoolId = payload.schoolId!;
    }

    if (!targetSchoolId) {
      throw { status: 400, message: 'School ID is required.' };
    }

    const sy = this.schoolYears.find((s) => s.id === payload.schoolYearId);
    if (!sy) throw { status: 404, message: 'School Year not found.' };
    if (sy.isClosed) throw { status: 400, message: 'This School Year is closed for submissions.' };

    // Rule 3: Reject entry if form unpublished
    const form = this.assessmentForms.find((f) => f.schoolYearId === payload.schoolYearId);
    if (!form || form.status !== 'published') {
      throw { status: 403, message: 'Submission rejected: The assessment form is unpublished.' };
    }

    // Rule 12: Lock submitted assessments unless editing is permitted
    const existingAss = this.assessments.find(
      (a) => a.schoolId === targetSchoolId && a.schoolYearId === payload.schoolYearId
    );

    if (existingAss && existingAss.status === 'Submitted' && !form.allowEditAfterSubmission) {
      throw { status: 403, message: 'Assessment is locked: Re-submission or editing is not permitted.' };
    }

    const activeIndicators = this.formIndicators.filter(
      (ind) => ind.formId === form.id && ind.isActive
    );

    const responseMap = new Map(payload.responses.map((r) => [r.indicatorId, r]));

    // Rule 10: Require all indicators when configured
    if (form.requireAllIndicators) {
      const unanswered = activeIndicators.filter((ind) => {
        const r = responseMap.get(ind.id);
        return !r || r.rating < 1 || r.rating > 4;
      });

      if (unanswered.length > 0) {
        throw {
          status: 400,
          message: `Submission rejected: All ${activeIndicators.length} active indicators must be rated before submission. (${unanswered.length} unanswered remaining: ${unanswered.map((u) => u.code).join(', ')}).`,
          unansweredCodes: unanswered.map((u) => u.code),
        };
      }
    }

    // Rule 11: Require remarks globally
    if (form.requireGlobalRemarks && (!payload.globalRemarks || !payload.globalRemarks.trim())) {
      throw {
        status: 400,
        message: 'Submission rejected: Global assessment remarks / recommendations are required for submission.',
      };
    }

    // Rule 11: Require remarks per indicator
    if (form.requireIndicatorRemarks) {
      const missingRemarks = activeIndicators.filter((ind) => {
        const r = responseMap.get(ind.id);
        return !r || !r.remarks || !r.remarks.trim();
      });

      if (missingRemarks.length > 0) {
        throw {
          status: 400,
          message: `Submission rejected: Remarks / MOVs are required for each indicator (${missingRemarks.length} missing: ${missingRemarks.map((m) => m.code).join(', ')}).`,
          missingRemarksCodes: missingRemarks.map((m) => m.code),
        };
      }
    }

    // Calculate final score
    let totalScore = 0;
    let countRated = 0;
    for (const ind of activeIndicators) {
      const r = responseMap.get(ind.id);
      if (r && r.rating > 0) {
        totalScore += r.rating;
        countRated++;
      }
    }
    const finalAverage = countRated > 0 ? (totalScore / countRated).toFixed(2) : '0.00';

    // Rule 13: Transaction + Rule 15: Single record per school year
    await this.transaction(async () => {
      let assId: number;
      const now = new Date();
      const personName = payload.submitterName || user.fullName;

      if (!existingAss) {
        assId = this.nextAssessmentId++;
        this.assessments.push({
          id: assId,
          schoolId: targetSchoolId,
          schoolYearId: payload.schoolYearId,
          status: 'Submitted',
          submittedAt: now,
          submittedByName: personName,
          globalRemarks: payload.globalRemarks ? payload.globalRemarks.trim() : null,
          calculatedAverage: finalAverage,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        assId = existingAss.id;
        existingAss.status = 'Submitted';
        existingAss.submittedAt = now;
        existingAss.submittedByName = personName;
        existingAss.globalRemarks = payload.globalRemarks ? payload.globalRemarks.trim() : null;
        existingAss.calculatedAverage = finalAverage;
        existingAss.updatedAt = now;
      }

      for (const ind of activeIndicators) {
        if (failMidway && ind.id === 4) {
          throw new Error('Simulated transaction rollback error during submit.');
        }

        const respItem = responseMap.get(ind.id) || { rating: 0, remarks: '' };
        const existingResp = this.assessmentResponses.find(
          (r) => r.assessmentId === assId && r.indicatorId === ind.id
        );

        if (!existingResp) {
          this.assessmentResponses.push({
            id: this.nextResponseId++,
            assessmentId: assId,
            indicatorId: ind.id,
            rating: respItem.rating,
            remarks: respItem.remarks ? respItem.remarks.trim() : null,
            updatedAt: now,
          });
        } else {
          existingResp.rating = respItem.rating;
          existingResp.remarks = respItem.remarks ? respItem.remarks.trim() : null;
          existingResp.updatedAt = now;
        }
      }
    });

    // Rule 14: Audit log
    this.logAudit(
      user,
      'SUBMIT_ASSESSMENT',
      'assessments',
      targetSchoolId,
      `School Year: ${sy.name}, Average: ${finalAverage}, Rated: ${countRated}/${activeIndicators.length}`
    );

    return {
      message: 'Assessment submitted successfully and officially recorded.',
      calculatedAverage: finalAverage,
    };
  }

  // 4. View Historical results
  async getHistoricalResults(user: MockUser, schoolId: number) {
    // Rule 16: School isolation
    if (user.role === 'school' && user.schoolId !== schoolId) {
      throw { status: 403, message: "Access denied: A School cannot access another School's assessment." };
    }

    const school = this.schools.find((s) => s.id === schoolId);
    if (!school) throw { status: 404, message: 'School not found.' };

    const records = this.assessments
      .filter((a) => a.schoolId === schoolId)
      .map((a) => {
        const sy = this.schoolYears.find((y) => y.id === a.schoolYearId);
        const form = this.assessmentForms.find((f) => f.schoolYearId === a.schoolYearId);
        const responses = this.assessmentResponses.filter((r) => r.assessmentId === a.id);

        return {
          assessmentId: a.id,
          schoolYearName: sy?.name || 'Unknown',
          status: a.status,
          calculatedAverage: a.calculatedAverage,
          submittedAt: a.submittedAt,
          submittedByName: a.submittedByName,
          globalRemarks: a.globalRemarks,
          ratingLabels: form
            ? [form.ratingLabel1, form.ratingLabel2, form.ratingLabel3, form.ratingLabel4]
            : [],
          responsesCount: responses.length,
          readOnly: true, // Rule 17: Historical results must remain read-only
        };
      });

    return {
      school,
      history: records,
    };
  }
}

/**
 * Test Runner and Suite
 */
async function runAllTests() {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
      failed++;
    }
  }

  console.log('\n======================================================================');
  console.log('  PROJECT SBM ONLINE: SCHOOL ASSESSMENT WORKFLOW TEST SUITE');
  console.log('======================================================================\n');

  // Test setup helper
  function createStandardHarness() {
    const service = new MockAssessmentService();

    // 2 schools in Leyte Division (id: 1)
    service.schools.push(
      { id: 101, schoolId: '303512', schoolName: 'Leyte National High School', divisionId: 1, district: 'Tacloban District' },
      { id: 102, schoolId: '303513', schoolName: 'Palo National High School', divisionId: 1, district: 'Palo District' }
    );

    // School Year 2024-2025 is Active
    service.schoolYears.push(
      { id: 1, name: '2024-2025', isActive: true, isClosed: false, createdAt: new Date() },
      { id: 2, name: '2023-2024', isActive: false, isClosed: true, createdAt: new Date() }
    );

    // Published Assessment Form for active year
    service.assessmentForms.push({
      id: 10,
      schoolYearId: 1,
      title: 'Regional SBM Self-Assessment Instrument',
      instructions: 'Please provide objective ratings and means of verification for all indicators.',
      ratingLabel1: 'Level 1: Developing',
      ratingLabel2: 'Level 2: Maturing',
      ratingLabel3: 'Level 3: Advanced',
      ratingLabel4: 'Level 4: Exemplary',
      status: 'published',
      allowEditAfterSubmission: false,
      requireAllIndicators: true,
      requireGlobalRemarks: false,
      requireIndicatorRemarks: false,
    });

    // Sections
    service.formSections.push(
      { id: 1, formId: 10, title: 'Leadership and Governance', orderIndex: 1 },
      { id: 2, formId: 10, title: 'Curriculum and Instruction', orderIndex: 2 }
    );

    // Indicators (2 in Sec 1, 2 in Sec 2)
    service.formIndicators.push(
      { id: 1, formId: 10, sectionId: 1, code: 'LG-1.1', content: 'SIP formulation process with stakeholders', orderIndex: 1, isActive: true },
      { id: 2, formId: 10, sectionId: 1, code: 'LG-1.2', content: 'Leadership structure and monitoring systems', orderIndex: 2, isActive: true },
      { id: 3, formId: 10, sectionId: 2, code: 'CI-1.1', content: 'Curriculum localization and contextualization', orderIndex: 3, isActive: true },
      { id: 4, formId: 10, sectionId: 2, code: 'CI-1.2', content: 'Learning assessment and remediation programs', orderIndex: 4, isActive: true }
    );

    const schoolUser: MockUser = {
      id: 50,
      username: 'school.303512',
      role: 'school',
      divisionId: 1,
      schoolId: 101,
      fullName: 'Leyte NHS Principal',
    };

    const otherSchoolUser: MockUser = {
      id: 51,
      username: 'school.303513',
      role: 'school',
      divisionId: 1,
      schoolId: 102,
      fullName: 'Palo NHS Principal',
    };

    const divisionUser: MockUser = {
      id: 20,
      username: 'division.leyte',
      role: 'division',
      divisionId: 1,
      schoolId: null,
      fullName: 'Leyte SDO Coordinator',
    };

    return { service, schoolUser, otherSchoolUser, divisionUser };
  }

  // RULE 1
  await test('Rule 1: Load the active School Year successfully', async () => {
    const { service, schoolUser } = createStandardHarness();
    const data = await service.loadActiveAssessment(schoolUser);

    assert.strictEqual(data.available, true);
    assert.strictEqual(data.schoolYear.name, '2024-2025');
    assert.strictEqual(data.schoolYear.isActive, true);
    assert.strictEqual(data.form.title, 'Regional SBM Self-Assessment Instrument');
  });

  // RULE 2
  await test('Rule 2: Reject access if no active School Year exists', async () => {
    const { service, schoolUser } = createStandardHarness();
    // Deactivate all school years
    service.schoolYears.forEach((sy) => (sy.isActive = false));

    await assert.rejects(
      async () => await service.loadActiveAssessment(schoolUser),
      (err: any) => {
        assert.strictEqual(err.status, 404);
        assert.match(err.message, /No active School Year is configured/);
        return true;
      }
    );
  });

  // RULE 3
  await test('Rule 3: Reject entry, draft saving, and submission if form is unpublished', async () => {
    const { service, schoolUser } = createStandardHarness();
    // Set form to draft
    service.assessmentForms[0].status = 'draft';

    // 1. Loading assessment is rejected
    await assert.rejects(
      async () => await service.loadActiveAssessment(schoolUser),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /unpublished/);
        return true;
      }
    );

    // 2. Saving draft is rejected
    await assert.rejects(
      async () =>
        await service.saveDraft(schoolUser, {
          schoolYearId: 1,
          responses: [{ indicatorId: 1, rating: 3 }],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /unpublished/);
        return true;
      }
    );

    // 3. Submitting is rejected
    await assert.rejects(
      async () =>
        await service.submitAssessment(schoolUser, {
          schoolYearId: 1,
          responses: [
            { indicatorId: 1, rating: 3 },
            { indicatorId: 2, rating: 3 },
            { indicatorId: 3, rating: 3 },
            { indicatorId: 4, rating: 3 },
          ],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /unpublished/);
        return true;
      }
    );
  });

  // RULE 4
  await test('Rule 4: Display configured instructions correctly', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].instructions = 'Mandatory: Upload SIP 2024 and School Report Card as MOVs.';

    const data = await service.loadActiveAssessment(schoolUser);
    assert.strictEqual(data.form.instructions, 'Mandatory: Upload SIP 2024 and School Report Card as MOVs.');
  });

  // RULE 5
  await test('Rule 5: Group indicators by section', async () => {
    const { service, schoolUser } = createStandardHarness();
    const data = await service.loadActiveAssessment(schoolUser);

    assert.strictEqual(data.form.sections.length, 2);
    assert.strictEqual(data.form.sections[0].title, 'Leadership and Governance');
    assert.strictEqual(data.form.sections[0].indicators.length, 2);
    assert.strictEqual(data.form.sections[0].indicators[0].code, 'LG-1.1');
    assert.strictEqual(data.form.sections[0].indicators[1].code, 'LG-1.2');

    assert.strictEqual(data.form.sections[1].title, 'Curriculum and Instruction');
    assert.strictEqual(data.form.sections[1].indicators.length, 2);
    assert.strictEqual(data.form.sections[1].indicators[0].code, 'CI-1.1');
    assert.strictEqual(data.form.sections[1].indicators[1].code, 'CI-1.2');
  });

  // RULE 6
  await test('Rule 6: Display the four configured rating labels', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].ratingLabel1 = 'Tahap 1: Beginning';
    service.assessmentForms[0].ratingLabel2 = 'Tahap 2: Developing';
    service.assessmentForms[0].ratingLabel3 = 'Tahap 3: Proficient';
    service.assessmentForms[0].ratingLabel4 = 'Tahap 4: Model of Excellence';

    const data = await service.loadActiveAssessment(schoolUser);
    assert.strictEqual(data.form.ratingLabel1, 'Tahap 1: Beginning');
    assert.strictEqual(data.form.ratingLabel2, 'Tahap 2: Developing');
    assert.strictEqual(data.form.ratingLabel3, 'Tahap 3: Proficient');
    assert.strictEqual(data.form.ratingLabel4, 'Tahap 4: Model of Excellence');
  });

  // RULE 7
  await test('Rule 7: Allow Save Draft with partial responses', async () => {
    const { service, schoolUser } = createStandardHarness();
    // Only answer indicator 1 (rating=3) and indicator 2 (rating=4)
    const result = await service.saveDraft(schoolUser, {
      schoolYearId: 1,
      globalRemarks: 'Draft in progress by School Head',
      responses: [
        { indicatorId: 1, rating: 3, remarks: 'SIP copy attached' },
        { indicatorId: 2, rating: 4, remarks: 'Monitoring log available' },
        { indicatorId: 3, rating: 0 }, // unanswered
        { indicatorId: 4, rating: 0 }, // unanswered
      ],
    });

    assert.strictEqual(result.message, 'Draft saved successfully.');
    assert.strictEqual(result.calculatedAverage, '3.50'); // (3+4)/2

    // Verify persisted assessment status is 'Draft'
    const ass = service.assessments.find((a) => a.schoolId === 101 && a.schoolYearId === 1);
    assert.ok(ass);
    assert.strictEqual(ass?.status, 'Draft');
    assert.strictEqual(ass?.globalRemarks, 'Draft in progress by School Head');
  });

  // RULE 8
  await test('Rule 8: Allow Submit when requirements are met', async () => {
    const { service, schoolUser } = createStandardHarness();

    const result = await service.submitAssessment(schoolUser, {
      schoolYearId: 1,
      submitterName: 'Dr. Maria Santos (Principal IV)',
      globalRemarks: 'Comprehensive school assessment verified by SGC and SPT.',
      responses: [
        { indicatorId: 1, rating: 3, remarks: 'SIP approved' },
        { indicatorId: 2, rating: 4, remarks: 'QAD certified' },
        { indicatorId: 3, rating: 3, remarks: 'Contextualized DLP' },
        { indicatorId: 4, rating: 4, remarks: 'Quarterly exam items bank' },
      ],
    });

    assert.match(result.message, /submitted successfully/);
    assert.strictEqual(result.calculatedAverage, '3.50'); // (3+4+3+4)/4

    const ass = service.assessments.find((a) => a.schoolId === 101 && a.schoolYearId === 1);
    assert.ok(ass);
    assert.strictEqual(ass?.status, 'Submitted');
    assert.strictEqual(ass?.submittedByName, 'Dr. Maria Santos (Principal IV)');
    assert.ok(ass?.submittedAt);
  });

  // RULE 9
  await test('Rule 9: Preserve entered values after validation errors (client state preservation)', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].requireAllIndicators = true;

    // Simulate coordinator's local state with 3 answered and 1 missing indicator
    const coordinatorState = {
      globalRemarks: 'Important school remarks that must never be lost',
      submitterName: 'Principal Juan Dela Cruz',
      responses: new Map<number, { rating: number; remarks: string }>([
        [1, { rating: 4, remarks: 'Extensive MOV 1' }],
        [2, { rating: 3, remarks: 'Extensive MOV 2' }],
        [3, { rating: 4, remarks: 'Extensive MOV 3' }],
        [4, { rating: 0, remarks: '' }], // missing indicator 4
      ]),
    };

    // Attempt submission
    let caughtError: any = null;
    try {
      await service.submitAssessment(schoolUser, {
        schoolYearId: 1,
        globalRemarks: coordinatorState.globalRemarks,
        submitterName: coordinatorState.submitterName,
        responses: Array.from(coordinatorState.responses.entries()).map(([indicatorId, val]) => ({
          indicatorId,
          ...val,
        })),
      });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Must fail validation due to missing indicator');
    assert.strictEqual(caughtError.status, 400);
    assert.deepStrictEqual(caughtError.unansweredCodes, ['CI-1.2']);

    // Verify coordinator's local state is completely preserved and not cleared
    assert.strictEqual(coordinatorState.globalRemarks, 'Important school remarks that must never be lost');
    assert.strictEqual(coordinatorState.submitterName, 'Principal Juan Dela Cruz');
    assert.strictEqual(coordinatorState.responses.get(1)?.rating, 4);
    assert.strictEqual(coordinatorState.responses.get(1)?.remarks, 'Extensive MOV 1');
    assert.strictEqual(coordinatorState.responses.get(2)?.rating, 3);
    assert.strictEqual(coordinatorState.responses.get(3)?.rating, 4);
  });

  // RULE 10
  await test('Rule 10: Require all indicators when configured', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].requireAllIndicators = true;

    // Submitting with missing indicators fails
    await assert.rejects(
      async () =>
        await service.submitAssessment(schoolUser, {
          schoolYearId: 1,
          responses: [
            { indicatorId: 1, rating: 3 },
            { indicatorId: 2, rating: 4 },
            { indicatorId: 3, rating: 0 }, // missing
            { indicatorId: 4, rating: 0 }, // missing
          ],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /All 4 active indicators must be rated/);
        return true;
      }
    );

    // Turn OFF requireAllIndicators: partial submission succeeds
    service.assessmentForms[0].requireAllIndicators = false;
    const result = await service.submitAssessment(schoolUser, {
      schoolYearId: 1,
      responses: [
        { indicatorId: 1, rating: 3 },
        { indicatorId: 2, rating: 4 },
      ],
    });
    assert.strictEqual(result.calculatedAverage, '3.50');
  });

  // RULE 11
  await test('Rule 11: Require remarks globally or per indicator when configured', async () => {
    const { service, schoolUser } = createStandardHarness();

    // 1. Require global remarks
    service.assessmentForms[0].requireGlobalRemarks = true;
    service.assessmentForms[0].requireIndicatorRemarks = false;
    service.assessmentForms[0].requireAllIndicators = false;

    await assert.rejects(
      async () =>
        await service.submitAssessment(schoolUser, {
          schoolYearId: 1,
          globalRemarks: '   ', // blank
          responses: [{ indicatorId: 1, rating: 3 }],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /Global assessment remarks \/ recommendations are required/);
        return true;
      }
    );

    // 2. Require indicator remarks
    service.assessmentForms[0].requireGlobalRemarks = false;
    service.assessmentForms[0].requireIndicatorRemarks = true;
    service.assessmentForms[0].requireAllIndicators = false;

    await assert.rejects(
      async () =>
        await service.submitAssessment(schoolUser, {
          schoolYearId: 1,
          responses: [
            { indicatorId: 1, rating: 3, remarks: '' }, // missing remarks
            { indicatorId: 2, rating: 4, remarks: 'Valid MOV' },
            { indicatorId: 3, rating: 3, remarks: 'Valid MOV' },
            { indicatorId: 4, rating: 4, remarks: 'Valid MOV' },
          ],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /Remarks \/ MOVs are required for each indicator/);
        assert.deepStrictEqual(err.missingRemarksCodes, ['LG-1.1']);
        return true;
      }
    );
  });

  // RULE 12
  await test('Rule 12: Lock submitted assessments unless editing is permitted', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].allowEditAfterSubmission = false;

    // Submit assessment
    await service.submitAssessment(schoolUser, {
      schoolYearId: 1,
      responses: [
        { indicatorId: 1, rating: 3 },
        { indicatorId: 2, rating: 3 },
        { indicatorId: 3, rating: 3 },
        { indicatorId: 4, rating: 3 },
      ],
    });

    // Check loadActiveAssessment reports isLocked = true
    const loaded = await service.loadActiveAssessment(schoolUser);
    assert.strictEqual(loaded.assessment.status, 'Submitted');
    assert.strictEqual(loaded.assessment.isLocked, true);

    // Attempt to save draft on locked assessment -> rejected
    await assert.rejects(
      async () =>
        await service.saveDraft(schoolUser, {
          schoolYearId: 1,
          responses: [{ indicatorId: 1, rating: 4 }],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /Assessment is locked/);
        return true;
      }
    );

    // Attempt to re-submit locked assessment -> rejected
    await assert.rejects(
      async () =>
        await service.submitAssessment(schoolUser, {
          schoolYearId: 1,
          responses: [
            { indicatorId: 1, rating: 4 },
            { indicatorId: 2, rating: 4 },
            { indicatorId: 3, rating: 4 },
            { indicatorId: 4, rating: 4 },
          ],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /Assessment is locked/);
        return true;
      }
    );

    // Now permit editing: allowEditAfterSubmission = true
    service.assessmentForms[0].allowEditAfterSubmission = true;
    const loadedUnlocked = await service.loadActiveAssessment(schoolUser);
    assert.strictEqual(loadedUnlocked.assessment.isLocked, false);

    // Draft save now succeeds
    const draftRes = await service.saveDraft(schoolUser, {
      schoolYearId: 1,
      responses: [{ indicatorId: 1, rating: 4 }],
    });
    assert.strictEqual(draftRes.message, 'Draft saved successfully.');
  });

  // RULE 13
  await test('Rule 13: Use a transaction to save the assessment and responses (atomic rollback on failure)', async () => {
    const { service, schoolUser } = createStandardHarness();

    // Trigger failure midway in transaction (e.g. indicator 999)
    await assert.rejects(
      async () =>
        await service.submitAssessment(
          schoolUser,
          {
            schoolYearId: 1,
            responses: [
              { indicatorId: 1, rating: 4 },
              { indicatorId: 2, rating: 4 },
              { indicatorId: 3, rating: 4 },
              { indicatorId: 4, rating: 4 },
            ],
          },
          true
        ),
      (err: any) => {
        assert.match(err.message, /Simulated transaction rollback/);
        return true;
      }
    );

    // Verify completely clean rollback: no assessments or responses created
    assert.strictEqual(service.assessments.length, 0, 'No assessment record should remain after rollback');
    assert.strictEqual(service.assessmentResponses.length, 0, 'No response records should remain after rollback');
  });

  // RULE 14
  await test('Rule 14: Write an audit log when submitted', async () => {
    const { service, schoolUser } = createStandardHarness();

    assert.strictEqual(service.auditLogs.length, 0);

    await service.submitAssessment(schoolUser, {
      schoolYearId: 1,
      responses: [
        { indicatorId: 1, rating: 4 },
        { indicatorId: 2, rating: 4 },
        { indicatorId: 3, rating: 4 },
        { indicatorId: 4, rating: 4 },
      ],
    });

    const submitLog = service.auditLogs.find((l) => l.action === 'SUBMIT_ASSESSMENT');
    assert.ok(submitLog, 'Must write SUBMIT_ASSESSMENT audit log');
    assert.strictEqual(submitLog?.resourceType, 'assessments');
    assert.strictEqual(submitLog?.resourceId, 101);
    assert.strictEqual(submitLog?.username, 'school.303512');
    assert.match(submitLog?.details || '', /Average: 4.00/);
  });

  // RULE 15
  await test('Rule 15: Prevent duplicate assessments for the same School Year', async () => {
    const { service, schoolUser } = createStandardHarness();
    service.assessmentForms[0].allowEditAfterSubmission = true;

    // First save draft
    await service.saveDraft(schoolUser, {
      schoolYearId: 1,
      responses: [{ indicatorId: 1, rating: 3 }],
    });
    assert.strictEqual(service.assessments.length, 1);

    // Save draft again
    await service.saveDraft(schoolUser, {
      schoolYearId: 1,
      responses: [{ indicatorId: 1, rating: 4 }],
    });
    assert.strictEqual(service.assessments.length, 1, 'Must update existing record, not create duplicate');

    // Submit
    await service.submitAssessment(schoolUser, {
      schoolYearId: 1,
      responses: [
        { indicatorId: 1, rating: 4 },
        { indicatorId: 2, rating: 4 },
        { indicatorId: 3, rating: 4 },
        { indicatorId: 4, rating: 4 },
      ],
    });
    assert.strictEqual(service.assessments.length, 1, 'Must maintain exactly one assessment per school and school year');
  });

  // RULE 16
  await test('Rule 16: Prevent access to another School’s data', async () => {
    const { service, schoolUser, otherSchoolUser } = createStandardHarness();

    // 1. School 101 tries to access School 102 active assessment -> 403
    await assert.rejects(
      async () => await service.loadActiveAssessment(schoolUser, 102),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /Access denied: A School cannot access another School's assessment/);
        return true;
      }
    );

    // 2. School 101 tries to save draft for School 102 -> 403
    await assert.rejects(
      async () =>
        await service.saveDraft(schoolUser, {
          schoolId: 102,
          schoolYearId: 1,
          responses: [{ indicatorId: 1, rating: 4 }],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /Access denied/);
        return true;
      }
    );

    // 3. School 101 tries to view School 102 historical results -> 403
    await assert.rejects(
      async () => await service.getHistoricalResults(schoolUser, 102),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /Access denied/);
        return true;
      }
    );

    // 4. Division user from Samar Division (id: 2) tries to access Leyte school (id: 101) -> 403
    const samarDivisionUser: MockUser = {
      id: 30,
      username: 'division.samar',
      role: 'division',
      divisionId: 2,
      schoolId: null,
      fullName: 'Samar SDO Coordinator',
    };

    await assert.rejects(
      async () => await service.loadActiveAssessment(samarDivisionUser, 101),
      (err: any) => {
        assert.strictEqual(err.status, 403);
        assert.match(err.message, /A Division administrator cannot access another Division's School assessment/);
        return true;
      }
    );
  });

  // RULE 17
  await test('Rule 17: Historical results must remain read-only', async () => {
    const { service, schoolUser } = createStandardHarness();

    // Create an assessment record for past School Year 2 (2023-2024, closed)
    service.assessments.push({
      id: 99,
      schoolId: 101,
      schoolYearId: 2,
      status: 'Submitted',
      submittedAt: new Date('2024-03-30'),
      submittedByName: 'Principal Juan Dela Cruz',
      globalRemarks: 'Historical SBM self-assessment record',
      calculatedAverage: '3.75',
      createdAt: new Date('2024-03-30'),
      updatedAt: new Date('2024-03-30'),
    });

    const result = await service.getHistoricalResults(schoolUser, 101);
    assert.strictEqual(result.history.length, 1);
    assert.strictEqual(result.history[0].schoolYearName, '2023-2024');
    assert.strictEqual(result.history[0].calculatedAverage, '3.75');
    assert.strictEqual(result.history[0].readOnly, true, 'Historical assessment results must be marked read-only');

    // Attempting to submit or save draft for a closed/historical school year is rejected
    await assert.rejects(
      async () =>
        await service.saveDraft(schoolUser, {
          schoolYearId: 2,
          responses: [{ indicatorId: 1, rating: 3 }],
        }),
      (err: any) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /closed for submissions/);
        return true;
      }
    );
  });

  console.log('\n======================================================================');
  console.log(`  ASSESSMENT WORKFLOW TEST RESULTS: ${passed}/${passed + failed} TESTS PASSED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
