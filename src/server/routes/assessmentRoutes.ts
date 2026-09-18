import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  schoolYears,
  schools,
  assessmentForms,
  formSections,
  formIndicators,
  assessments,
  assessmentResponses,
} from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import {
  AuthenticatedRequest,
  requireAuth,
  enforceSchoolScope,
  logAudit,
} from '../auth.ts';

const router = Router();

// Helper to calculate interpretation from average rating
export function getSBMInterpretation(avg: number): string {
  if (avg <= 0) return 'Not assessed';
  if (avg < 1.5) return 'Level 1: Developing (Beginning)';
  if (avg < 2.5) return 'Level 2: Maturing (Intermediate)';
  if (avg < 3.5) return 'Level 3: Advanced (Advanced)';
  return 'Level 4: Exemplary (Best Practice)';
}

// GET /api/assessments/active - Load active school year assessment for the current school
router.get('/active', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let targetSchoolId: number | null = null;
    if (req.user!.role === 'school') {
      if (req.query.schoolId && parseInt(String(req.query.schoolId), 10) !== req.user!.schoolId) {
        return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
      }
      targetSchoolId = req.user!.schoolId;
    } else if (req.query.schoolId) {
      targetSchoolId = parseInt(String(req.query.schoolId), 10);
    }

    if (!targetSchoolId) {
      return res.status(400).json({ error: 'School ID is required.' });
    }

    if (req.user!.role === 'school' && req.user!.schoolId !== targetSchoolId) {
      return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
    }

    if (req.user!.role === 'division') {
      const sch = await db.select().from(schools).where(eq(schools.id, targetSchoolId));
      if (sch.length === 0 || sch[0].divisionId !== req.user!.divisionId) {
        return res.status(403).json({ error: "Access denied: A Division administrator cannot access another Division's School assessment." });
      }
    }

    // 1. Get active school year
    const activeSyList = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
    if (activeSyList.length === 0) {
      return res.status(404).json({ error: 'No active School Year is configured by Regional Office.' });
    }
    const activeSy = activeSyList[0];

    // 2. Get published form
    const formList = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, activeSy.id));
    if (formList.length === 0 || formList[0].status !== 'published') {
      return res.json({
        available: false,
        message: 'The assessment form for the active School Year is not yet published.',
        schoolYear: activeSy,
      });
    }

    const form = formList[0];

    // 3. Get sections & active indicators
    const sections = await db
      .select()
      .from(formSections)
      .where(eq(formSections.formId, form.id))
      .orderBy(formSections.orderIndex);

    const indicators = await db
      .select()
      .from(formIndicators)
      .where(sql`${formIndicators.formId} = ${form.id} AND ${formIndicators.isActive} = true`)
      .orderBy(formIndicators.orderIndex);

    // 4. Get or initialize school assessment
    const existingAss = await db
      .select()
      .from(assessments)
      .where(sql`${assessments.schoolId} = ${targetSchoolId} AND ${assessments.schoolYearId} = ${activeSy.id}`);

    let userAssessment = existingAss[0] || null;
    let userResponses: any[] = [];

    if (userAssessment) {
      userResponses = await db
        .select()
        .from(assessmentResponses)
        .where(eq(assessmentResponses.assessmentId, userAssessment.id));
    }

    // Map existing response by indicatorId
    const responseMap = new Map(userResponses.map((r) => [r.indicatorId, r]));

    const sectionsWithIndicators = sections.map((sec) => ({
      ...sec,
      indicators: indicators
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

    const isLocked =
      userAssessment?.status === 'Submitted' && !form.allowEditAfterSubmission;

    return res.json({
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
        status: form.status,
        allowEditAfterSubmission: form.allowEditAfterSubmission,
        requireAllIndicators: form.requireAllIndicators,
        requireGlobalRemarks: form.requireGlobalRemarks,
        requireIndicatorRemarks: form.requireIndicatorRemarks,
        sections: sectionsWithIndicators,
      },
      assessment: userAssessment
        ? {
            id: userAssessment.id,
            status: userAssessment.status,
            globalRemarks: userAssessment.globalRemarks || '',
            calculatedAverage: userAssessment.calculatedAverage,
            submittedAt: userAssessment.submittedAt,
            submittedByName: userAssessment.submittedByName,
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
    });
  } catch (err: any) {
    console.error('Active assessment load error:', err);
    return res.status(500).json({ error: 'Failed to load active assessment.' });
  }
});

// POST /api/assessments/save-draft - Save draft
router.post('/save-draft', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId, schoolYearId, globalRemarks, responses } = req.body;

    if (req.user!.role === 'school') {
      if (schoolId && Number(schoolId) !== req.user!.schoolId) {
        return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
      }
    }

    const targetSchoolId = req.user!.role === 'school' ? req.user!.schoolId! : Number(schoolId);
    if (!targetSchoolId) {
      return res.status(400).json({ error: 'School ID is required.' });
    }

    if (req.user!.role === 'school' && req.user!.schoolId !== targetSchoolId) {
      return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
    }

    if (req.user!.role === 'division') {
      const sch = await db.select().from(schools).where(eq(schools.id, targetSchoolId));
      if (sch.length === 0 || sch[0].divisionId !== req.user!.divisionId) {
        return res.status(403).json({ error: "Access denied: A Division administrator cannot access another Division's School assessment." });
      }
    }

    // Check school year and form
    const sy = await db.select().from(schoolYears).where(eq(schoolYears.id, Number(schoolYearId)));
    if (sy.length === 0) return res.status(404).json({ error: 'School Year not found' });
    if (sy[0].isClosed) return res.status(400).json({ error: 'This School Year is closed for submissions.' });

    const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(schoolYearId)));
    if (formRes.length === 0) return res.status(400).json({ error: 'Assessment form not found' });
    const form = formRes[0];

    // Check existing assessment
    const existingAss = await db
      .select()
      .from(assessments)
      .where(sql`${assessments.schoolId} = ${targetSchoolId} AND ${assessments.schoolYearId} = ${Number(schoolYearId)}`);

    if (existingAss.length > 0 && existingAss[0].status === 'Submitted' && !form.allowEditAfterSubmission) {
      return res.status(400).json({ error: 'Assessment is already submitted and locked against modifications.' });
    }

    // Calculate current running average of answered items
    const validRatings = Array.isArray(responses) ? responses.filter((r: any) => r.rating > 0).map((r: any) => Number(r.rating)) : [];
    const avg = validRatings.length > 0 ? (validRatings.reduce((a: number, b: number) => a + b, 0) / validRatings.length).toFixed(2) : '0.00';

    await db.transaction(async (tx) => {
      let assId: number;
      if (existingAss.length === 0) {
        const [inserted] = await tx
          .insert(assessments)
          .values({
            schoolId: targetSchoolId,
            schoolYearId: Number(schoolYearId),
            status: 'Draft',
            globalRemarks: globalRemarks || null,
            calculatedAverage: avg,
          })
          .returning();
        assId = inserted.id;
      } else {
        assId = existingAss[0].id;
        await tx
          .update(assessments)
          .set({
            status: existingAss[0].status === 'Submitted' ? 'Submitted' : 'Draft',
            globalRemarks: globalRemarks || null,
            calculatedAverage: avg,
            updatedAt: new Date(),
          })
          .where(eq(assessments.id, assId));
      }

      // Upsert responses
      if (Array.isArray(responses)) {
        for (const item of responses) {
          if (!item.indicatorId) continue;
          const existingResp = await tx
            .select()
            .from(assessmentResponses)
            .where(sql`${assessmentResponses.assessmentId} = ${assId} AND ${assessmentResponses.indicatorId} = ${Number(item.indicatorId)}`);

          if (existingResp.length === 0) {
            await tx.insert(assessmentResponses).values({
              assessmentId: assId,
              indicatorId: Number(item.indicatorId),
              rating: Number(item.rating) || 0,
              remarks: item.remarks ? String(item.remarks).trim() : null,
            });
          } else {
            await tx
              .update(assessmentResponses)
              .set({
                rating: Number(item.rating) || 0,
                remarks: item.remarks ? String(item.remarks).trim() : null,
                updatedAt: new Date(),
              })
              .where(eq(assessmentResponses.id, existingResp[0].id));
          }
        }
      }
    });

    await logAudit(req, 'SAVE_ASSESSMENT_DRAFT', 'assessments', targetSchoolId);
    return res.json({ message: 'Draft saved successfully.', calculatedAverage: avg });
  } catch (err: any) {
    console.error('Save draft error:', err);
    return res.status(500).json({ error: 'Failed to save assessment draft.' });
  }
});

// POST /api/assessments/submit - Submit final assessment
router.post('/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId, schoolYearId, globalRemarks, responses, submitterName } = req.body;

    if (req.user!.role === 'school') {
      if (schoolId && Number(schoolId) !== req.user!.schoolId) {
        return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
      }
    }

    const targetSchoolId = req.user!.role === 'school' ? req.user!.schoolId! : Number(schoolId);
    if (!targetSchoolId) {
      return res.status(400).json({ error: 'School ID is required.' });
    }

    if (req.user!.role === 'school' && req.user!.schoolId !== targetSchoolId) {
      return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
    }

    if (req.user!.role === 'division') {
      const sch = await db.select().from(schools).where(eq(schools.id, targetSchoolId));
      if (sch.length === 0 || sch[0].divisionId !== req.user!.divisionId) {
        return res.status(403).json({ error: "Access denied: A Division administrator cannot access another Division's School assessment." });
      }
    }

    // 1. Verify school year and form
    const sy = await db.select().from(schoolYears).where(eq(schoolYears.id, Number(schoolYearId)));
    if (sy.length === 0) return res.status(404).json({ error: 'School Year not found' });
    if (sy[0].isClosed) return res.status(400).json({ error: 'This School Year is closed for submissions.' });

    const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(schoolYearId)));
    if (formRes.length === 0 || formRes[0].status !== 'published') {
      return res.status(400).json({ error: 'Assessment form is not published.' });
    }
    const form = formRes[0];

    // 2. Fetch all active indicators for this form
    const activeIndicators = await db
      .select()
      .from(formIndicators)
      .where(sql`${formIndicators.formId} = ${form.id} AND ${formIndicators.isActive} = true`);

    const responseMap = new Map<number, { rating: number; remarks?: string }>();
    if (Array.isArray(responses)) {
      for (const r of responses) {
        responseMap.set(Number(r.indicatorId), {
          rating: Number(r.rating) || 0,
          remarks: r.remarks ? String(r.remarks).trim() : '',
        });
      }
    }

    // 3. Validation
    // Validate required indicators
    if (form.requireAllIndicators) {
      const unanswered = activeIndicators.filter((ind) => {
        const r = responseMap.get(ind.id);
        return !r || r.rating < 1 || r.rating > 4;
      });

      if (unanswered.length > 0) {
        return res.status(400).json({
          error: `Submission rejected: All ${activeIndicators.length} active indicators must be rated before submission. (${unanswered.length} unanswered remaining: e.g. ${unanswered.map((u) => u.code).slice(0, 5).join(', ')}).`,
        });
      }
    }

    // Validate global remarks requirement
    if (form.requireGlobalRemarks && (!globalRemarks || !globalRemarks.trim())) {
      return res.status(400).json({ error: 'Global assessment remarks / recommendations are required for submission.' });
    }

    // Validate per-indicator remarks requirement
    if (form.requireIndicatorRemarks) {
      const missingRemarks = activeIndicators.filter((ind) => {
        const r = responseMap.get(ind.id);
        return !r || !r.remarks || r.remarks.length === 0;
      });
      if (missingRemarks.length > 0) {
        return res.status(400).json({
          error: `Submission rejected: Remarks are required for each indicator (Missing on: ${missingRemarks.map((m) => m.code).slice(0, 5).join(', ')}).`,
        });
      }
    }

    // Calculate final overall average
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

    // 4. Save assessment and responses transactionally
    await db.transaction(async (tx) => {
      const existingAss = await tx
        .select()
        .from(assessments)
        .where(sql`${assessments.schoolId} = ${targetSchoolId} AND ${assessments.schoolYearId} = ${Number(schoolYearId)}`);

      let assId: number;
      const now = new Date();
      const personName = submitterName || req.user!.fullName;

      if (existingAss.length === 0) {
        const [inserted] = await tx
          .insert(assessments)
          .values({
            schoolId: targetSchoolId,
            schoolYearId: Number(schoolYearId),
            status: 'Submitted',
            submittedAt: now,
            submittedByName: personName,
            globalRemarks: globalRemarks ? globalRemarks.trim() : null,
            calculatedAverage: finalAverage,
          })
          .returning();
        assId = inserted.id;
      } else {
        assId = existingAss[0].id;
        await tx
          .update(assessments)
          .set({
            status: 'Submitted',
            submittedAt: now,
            submittedByName: personName,
            globalRemarks: globalRemarks ? globalRemarks.trim() : null,
            calculatedAverage: finalAverage,
            updatedAt: now,
          })
          .where(eq(assessments.id, assId));
      }

      // Upsert all responses
      for (const ind of activeIndicators) {
        const respItem = responseMap.get(ind.id) || { rating: 0, remarks: '' };
        const existingResp = await tx
          .select()
          .from(assessmentResponses)
          .where(sql`${assessmentResponses.assessmentId} = ${assId} AND ${assessmentResponses.indicatorId} = ${ind.id}`);

        if (existingResp.length === 0) {
          await tx.insert(assessmentResponses).values({
            assessmentId: assId,
            indicatorId: ind.id,
            rating: respItem.rating,
            remarks: respItem.remarks || null,
          });
        } else {
          await tx
            .update(assessmentResponses)
            .set({
              rating: respItem.rating,
              remarks: respItem.remarks || null,
              updatedAt: now,
            })
            .where(eq(assessmentResponses.id, existingResp[0].id));
        }
      }
    });

    await logAudit(req, 'SUBMIT_ASSESSMENT', 'assessments', targetSchoolId, `Average: ${finalAverage}`);
    return res.json({
      message: 'Assessment submitted successfully and officially recorded.',
      calculatedAverage: finalAverage,
      interpretation: getSBMInterpretation(parseFloat(finalAverage)),
    });
  } catch (err: any) {
    console.error('Submit assessment error:', err);
    return res.status(500).json({ error: 'Failed to submit assessment.' });
  }
});

// GET /api/assessments/history/:schoolId - View historical results (Read-only)
router.get('/history/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    if (isNaN(schoolId)) {
      return res.status(400).json({ error: 'Invalid school ID.' });
    }

    if (req.user!.role === 'school' && req.user!.schoolId !== schoolId) {
      return res.status(403).json({ error: "Access denied: A School cannot access another School's assessment." });
    }

    if (req.user!.role === 'division') {
      const sch = await db.select().from(schools).where(eq(schools.id, schoolId));
      if (sch.length === 0 || sch[0].divisionId !== req.user!.divisionId) {
        return res.status(403).json({ error: "Access denied: A Division administrator cannot access another Division's School assessment." });
      }
    }

    const schoolRec = await db.select().from(schools).where(eq(schools.id, schoolId));
    if (schoolRec.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const allYears = await db.select().from(schoolYears).orderBy(sql`${schoolYears.name} DESC`);

    // Build history items
    const history = await Promise.all(
      allYears.map(async (sy) => {
        const assRes = await db
          .select()
          .from(assessments)
          .where(sql`${assessments.schoolId} = ${schoolId} AND ${assessments.schoolYearId} = ${sy.id}`);

        if (assRes.length === 0) {
          return {
            schoolYearId: sy.id,
            schoolYearName: sy.name,
            isActive: sy.isActive,
            isClosed: sy.isClosed,
            status: 'Not started',
            indicatorsAnswered: 0,
            totalActiveIndicators: 0,
            calculatedAverage: '0.00',
            interpretation: 'Not started',
            submittedAt: null,
            submittedByName: null,
            globalRemarks: null,
            sections: [],
          };
        }

        const userAss = assRes[0];

        // Load form for this year
        const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, sy.id));
        if (formRes.length === 0) {
          return {
            schoolYearId: sy.id,
            schoolYearName: sy.name,
            isActive: sy.isActive,
            isClosed: sy.isClosed,
            status: userAss.status,
            indicatorsAnswered: 0,
            totalActiveIndicators: 0,
            calculatedAverage: userAss.calculatedAverage,
            interpretation: getSBMInterpretation(parseFloat(userAss.calculatedAverage)),
            submittedAt: userAss.submittedAt,
            submittedByName: userAss.submittedByName,
            globalRemarks: userAss.globalRemarks,
            sections: [],
          };
        }

        const form = formRes[0];
        const sections = await db.select().from(formSections).where(eq(formSections.formId, form.id)).orderBy(formSections.orderIndex);
        const indicators = await db
          .select()
          .from(formIndicators)
          .where(sql`${formIndicators.formId} = ${form.id} AND ${formIndicators.isActive} = true`)
          .orderBy(formIndicators.orderIndex);

        const responses = await db.select().from(assessmentResponses).where(eq(assessmentResponses.assessmentId, userAss.id));
        const respMap = new Map(responses.map((r) => [r.indicatorId, r]));

        let answeredCount = 0;
        const sectionBreakdown = sections.map((sec) => {
          const secIndicators = indicators.filter((i) => i.sectionId === sec.id);
          let secTotal = 0;
          let secAnswered = 0;

          const detailedIndicators = secIndicators.map((ind) => {
            const resp = respMap.get(ind.id);
            const rating = resp ? resp.rating : 0;
            if (rating > 0) {
              answeredCount++;
              secTotal += rating;
              secAnswered++;
            }
            return {
              id: ind.id,
              code: ind.code,
              content: ind.content,
              rating,
              remarks: resp?.remarks || '',
            };
          });

          const secAverage = secAnswered > 0 ? (secTotal / secAnswered).toFixed(2) : '0.00';
          return {
            id: sec.id,
            title: sec.title,
            average: secAverage,
            answeredCount: secAnswered,
            totalIndicators: secIndicators.length,
            indicators: detailedIndicators,
          };
        });

        const overallAvg = parseFloat(userAss.calculatedAverage);

        return {
          schoolYearId: sy.id,
          schoolYearName: sy.name,
          isActive: sy.isActive,
          isClosed: sy.isClosed,
          status: userAss.status,
          indicatorsAnswered: answeredCount,
          totalActiveIndicators: indicators.length,
          calculatedAverage: userAss.calculatedAverage,
          interpretation: getSBMInterpretation(overallAvg),
          submittedAt: userAss.submittedAt,
          submittedByName: userAss.submittedByName,
          globalRemarks: userAss.globalRemarks,
          sections: sectionBreakdown,
          formMetadata: {
            title: form.title,
            ratingLabel1: form.ratingLabel1,
            ratingLabel2: form.ratingLabel2,
            ratingLabel3: form.ratingLabel3,
            ratingLabel4: form.ratingLabel4,
          },
        };
      })
    );

    return res.json({
      school: schoolRec[0],
      history,
    });
  } catch (err: any) {
    console.error('Fetch assessment history error:', err);
    return res.status(500).json({ error: 'Failed to fetch assessment history.' });
  }
});

export default router;
