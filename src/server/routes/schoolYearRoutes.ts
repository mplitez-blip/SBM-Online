import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  schoolYears,
  assessmentForms,
  formSections,
  formIndicators,
  assessments,
  assessmentResponses,
} from '../../db/schema.ts';
import { eq, sql, count } from 'drizzle-orm';
import { AuthenticatedRequest, requireAuth, requireRole, logAudit } from '../auth.ts';

const router = Router();

// Validate YYYY-YYYY format and second year is one year after first
function validateSchoolYearFormat(name: string): { valid: boolean; error?: string } {
  const match = name.trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    return { valid: false, error: 'School Year must be in YYYY-YYYY format (e.g. 2024-2025).' };
  }
  const y1 = parseInt(match[1], 10);
  const y2 = parseInt(match[2], 10);
  if (y2 !== y1 + 1) {
    return { valid: false, error: `Invalid School Year. The second year (${y2}) must be exactly one year after the first year (${y1}).` };
  }
  return { valid: true };
}

// GET /api/school-years
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.select().from(schoolYears).orderBy(sql`${schoolYears.name} DESC`);

    // Fetch counts for each year
    const result = await Promise.all(
      list.map(async (sy) => {
        // Assessment count
        const assCountRes = await db
          .select({ count: count() })
          .from(assessments)
          .where(eq(assessments.schoolYearId, sy.id));
        const assessmentCount = Number(assCountRes[0]?.count || 0);

        // Answered indicator responses count
        const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, sy.id));
        let indicatorCount = 0;
        let answeredResponsesCount = 0;
        let totalResponsesCount = 0;
        let formStatus: 'published' | 'draft' | 'no_form' = 'no_form';

        if (formRes.length > 0) {
          const form = formRes[0];
          formStatus = form.status === 'published' ? 'published' : 'draft';

          const indRes = await db
            .select({ count: count() })
            .from(formIndicators)
            .where(sql`${formIndicators.formId} = ${form.id} AND ${formIndicators.isActive} = true`);
          indicatorCount = Number(indRes[0]?.count || 0);

          // Number of answered indicator ratings (strictly rating > 0).
          // Stored blank rows (rating == 0 or null) are strictly excluded.
          const ansRes = await db
            .select({ count: count() })
            .from(assessmentResponses)
            .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
            .where(sql`${assessments.schoolYearId} = ${sy.id} AND ${assessmentResponses.rating} > 0`);
          answeredResponsesCount = Number(ansRes[0]?.count || 0);

          const totRes = await db
            .select({ count: count() })
            .from(assessmentResponses)
            .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
            .where(eq(assessments.schoolYearId, sy.id));
          totalResponsesCount = Number(totRes[0]?.count || 0);
        }

        return {
          id: sy.id,
          name: sy.name,
          isActive: sy.isActive,
          isClosed: sy.isClosed,
          createdAt: sy.createdAt,
          formStatus, // 'published' | 'draft' | 'no_form'
          assessmentCount,
          activeIndicatorCount: indicatorCount,
          answeredResponsesCount,
          totalResponsesCount,
          hasForm: formRes.length > 0,
        };
      })
    );

    return res.json(result);
  } catch (err: any) {
    console.error('Fetch school years error:', err);
    return res.status(500).json({ error: 'Failed to fetch school years.' });
  }
});

// POST /api/school-years - Regional Only
router.post('/', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, createEmptyForm, cloneFromYearId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'School Year name is required.' });
    }

    const validation = validateSchoolYearFormat(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const cleanName = name.trim();
    const existing = await db.select().from(schoolYears).where(eq(schoolYears.name, cleanName));
    if (existing.length > 0) {
      return res.status(400).json({ error: `School Year '${cleanName}' already exists.` });
    }

    // Insert new School Year inside transaction
    const newSy = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(schoolYears)
        .values({
          name: cleanName,
          isActive: false,
          isClosed: false,
        })
        .returning();

      // Form creation logic
      if (cloneFromYearId) {
        // Clone from existing year
        const sourceForms = await tx
          .select()
          .from(assessmentForms)
          .where(eq(assessmentForms.schoolYearId, Number(cloneFromYearId)));

        if (sourceForms.length > 0) {
          const sForm = sourceForms[0];
          const [clonedForm] = await tx
            .insert(assessmentForms)
            .values({
              schoolYearId: inserted.id,
              title: sForm.title,
              instructions: sForm.instructions,
              ratingLabel1: sForm.ratingLabel1,
              ratingLabel2: sForm.ratingLabel2,
              ratingLabel3: sForm.ratingLabel3,
              ratingLabel4: sForm.ratingLabel4,
              status: 'draft',
              allowEditAfterSubmission: sForm.allowEditAfterSubmission,
              requireAllIndicators: sForm.requireAllIndicators,
              requireGlobalRemarks: sForm.requireGlobalRemarks,
              requireIndicatorRemarks: sForm.requireIndicatorRemarks,
            })
            .returning();

          // Clone sections and indicators
          const sourceSections = await tx
            .select()
            .from(formSections)
            .where(eq(formSections.formId, sForm.id))
            .orderBy(formSections.orderIndex);

          for (const sSec of sourceSections) {
            const [clonedSec] = await tx
              .insert(formSections)
              .values({
                formId: clonedForm.id,
                title: sSec.title,
                orderIndex: sSec.orderIndex,
              })
              .returning();

            const sourceIndicators = await tx
              .select()
              .from(formIndicators)
              .where(eq(formIndicators.sectionId, sSec.id))
              .orderBy(formIndicators.orderIndex);

            for (const sInd of sourceIndicators) {
              await tx.insert(formIndicators).values({
                formId: clonedForm.id,
                sectionId: clonedSec.id,
                code: sInd.code,
                content: sInd.content,
                orderIndex: sInd.orderIndex,
                isActive: sInd.isActive,
              });
            }
          }
        }
      } else if (createEmptyForm) {
        // Create blank template
        await tx.insert(assessmentForms).values({
          schoolYearId: inserted.id,
          title: `SBM Assessment Form (${cleanName})`,
          instructions: 'Please assess all school indicators objectively with corresponding MOVs.',
          ratingLabel1: 'Level 1: Developing',
          ratingLabel2: 'Level 2: Maturing',
          ratingLabel3: 'Level 3: Advanced',
          ratingLabel4: 'Level 4: Exemplary',
          status: 'draft',
          allowEditAfterSubmission: false,
          requireAllIndicators: true,
          requireGlobalRemarks: false,
          requireIndicatorRemarks: false,
        });
      }

      return inserted;
    });

    await logAudit(req, 'CREATE_SCHOOL_YEAR', 'school_years', newSy.id, `Name: ${cleanName}`);
    return res.status(201).json({ message: 'School Year created successfully.', schoolYear: newSy });
  } catch (err: any) {
    console.error('Create school year error:', err);
    return res.status(500).json({ error: 'Failed to create school year.' });
  }
});

// PUT /api/school-years/:id/active - Regional Only (Set exactly one active)
router.put('/:id/active', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetSy = await db.select().from(schoolYears).where(eq(schoolYears.id, id));
    if (targetSy.length === 0) {
      return res.status(404).json({ error: 'School Year not found.' });
    }

    await db.transaction(async (tx) => {
      // Deactivate all
      await tx.update(schoolYears).set({ isActive: false, updatedAt: new Date() });
      // Activate target
      await tx.update(schoolYears).set({ isActive: true, isClosed: false, updatedAt: new Date() }).where(eq(schoolYears.id, id));
    });

    await logAudit(req, 'SET_ACTIVE_SCHOOL_YEAR', 'school_years', id, `Name: ${targetSy[0].name}`);
    return res.json({ message: `School Year ${targetSy[0].name} is now the active School Year.` });
  } catch (err: any) {
    console.error('Set active school year error:', err);
    return res.status(500).json({ error: 'Failed to update active school year.' });
  }
});

// PUT /api/school-years/:id/toggle-closed - Regional Only
router.put('/:id/toggle-closed', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetSy = await db.select().from(schoolYears).where(eq(schoolYears.id, id));
    if (targetSy.length === 0) {
      return res.status(404).json({ error: 'School Year not found.' });
    }

    const newClosed = !targetSy[0].isClosed;
    await db.update(schoolYears).set({ isClosed: newClosed, updatedAt: new Date() }).where(eq(schoolYears.id, id));

    await logAudit(req, newClosed ? 'CLOSE_SCHOOL_YEAR' : 'REOPEN_SCHOOL_YEAR', 'school_years', id);
    return res.json({
      message: `School Year ${targetSy[0].name} has been ${newClosed ? 'closed' : 'reopened'}.`,
      isClosed: newClosed,
    });
  } catch (err: any) {
    console.error('Toggle closed school year error:', err);
    return res.status(500).json({ error: 'Failed to update school year status.' });
  }
});

// GET /api/school-years/:id/affected-records - Regional Only (Preview before deletion)
router.get('/:id/affected-records', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetSy = await db.select().from(schoolYears).where(eq(schoolYears.id, id));
    if (targetSy.length === 0) {
      return res.status(404).json({ error: 'School Year not found.' });
    }

    const sy = targetSy[0];

    const assList = await db.select({ id: assessments.id }).from(assessments).where(eq(assessments.schoolYearId, id));
    const assessmentIds = assList.map((a) => a.id);

    let totalResponses = 0;
    let answeredResponses = 0;
    if (assessmentIds.length > 0) {
      for (const aId of assessmentIds) {
        const respRows = await db.select().from(assessmentResponses).where(eq(assessmentResponses.assessmentId, aId));
        totalResponses += respRows.length;
        answeredResponses += respRows.filter((r) => r.rating > 0).length;
      }
    }

    const formList = await db.select({ id: assessmentForms.id }).from(assessmentForms).where(eq(assessmentForms.schoolYearId, id));
    let totalSections = 0;
    let totalIndicators = 0;
    for (const f of formList) {
      const secs = await db.select({ id: formSections.id }).from(formSections).where(eq(formSections.formId, f.id));
      totalSections += secs.length;
      const inds = await db.select({ id: formIndicators.id }).from(formIndicators).where(eq(formIndicators.formId, f.id));
      totalIndicators += inds.length;
    }

    return res.json({
      schoolYearId: id,
      name: sy.name,
      isActive: sy.isActive,
      affected: {
        assessments: assessmentIds.length,
        answeredResponses,
        totalResponses,
        forms: formList.length,
        sections: totalSections,
        indicators: totalIndicators,
      },
    });
  } catch (err: any) {
    console.error('Fetch affected records error:', err);
    return res.status(500).json({ error: 'Failed to inspect affected records.' });
  }
});

// POST /api/school-years/:id/clone-form - Regional Only (Form cloning transaction)
router.post('/:id/clone-form', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetSyId = parseInt(req.params.id, 10);
    const { sourceSchoolYearId } = req.body;
    if (!sourceSchoolYearId) {
      return res.status(400).json({ error: 'Source School Year ID is required.' });
    }

    const targetSy = await db.select().from(schoolYears).where(eq(schoolYears.id, targetSyId));
    if (targetSy.length === 0) return res.status(404).json({ error: 'Target School Year not found.' });

    const sourceForms = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(sourceSchoolYearId)));
    if (sourceForms.length === 0) {
      return res.status(404).json({ error: 'Source School Year does not have an assessment form to clone.' });
    }

    const sForm = sourceForms[0];

    await db.transaction(async (tx) => {
      // Check if target already has a form
      let [tForm] = await tx.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, targetSyId));
      if (!tForm) {
        [tForm] = await tx.insert(assessmentForms).values({
          schoolYearId: targetSyId,
          title: `SBM Assessment Form (${targetSy[0].name})`,
          instructions: sForm.instructions,
          ratingLabel1: sForm.ratingLabel1,
          ratingLabel2: sForm.ratingLabel2,
          ratingLabel3: sForm.ratingLabel3,
          ratingLabel4: sForm.ratingLabel4,
          status: 'draft',
          allowEditAfterSubmission: sForm.allowEditAfterSubmission,
          requireAllIndicators: sForm.requireAllIndicators,
          requireGlobalRemarks: sForm.requireGlobalRemarks,
          requireIndicatorRemarks: sForm.requireIndicatorRemarks,
        }).returning();
      } else {
        // Clear existing sections & indicators of target form in transaction
        await tx.delete(formIndicators).where(eq(formIndicators.formId, tForm.id));
        await tx.delete(formSections).where(eq(formSections.formId, tForm.id));
        await tx.update(assessmentForms).set({
          instructions: sForm.instructions,
          ratingLabel1: sForm.ratingLabel1,
          ratingLabel2: sForm.ratingLabel2,
          ratingLabel3: sForm.ratingLabel3,
          ratingLabel4: sForm.ratingLabel4,
          status: 'draft',
          updatedAt: new Date(),
        }).where(eq(assessmentForms.id, tForm.id));
      }

      // Clone sections and indicators atomically
      const sSections = await tx.select().from(formSections).where(eq(formSections.formId, sForm.id)).orderBy(formSections.orderIndex);
      for (const sSec of sSections) {
        const [clonedSec] = await tx.insert(formSections).values({
          formId: tForm.id,
          title: sSec.title,
          orderIndex: sSec.orderIndex,
        }).returning();

        const sInds = await tx.select().from(formIndicators).where(eq(formIndicators.sectionId, sSec.id)).orderBy(formIndicators.orderIndex);
        for (const sInd of sInds) {
          await tx.insert(formIndicators).values({
            formId: tForm.id,
            sectionId: clonedSec.id,
            code: sInd.code,
            content: sInd.content,
            orderIndex: sInd.orderIndex,
            isActive: sInd.isActive,
          });
        }
      }
    });

    await logAudit(req, 'CLONE_FORM', 'assessment_forms', targetSyId, `Cloned from SY ${sourceSchoolYearId} into SY ${targetSy[0].name}`);
    return res.json({ message: `Successfully cloned form framework from SY ${sourceSchoolYearId} into SY ${targetSy[0].name}.` });
  } catch (err: any) {
    console.error('Clone form error:', err);
    return res.status(500).json({ error: 'Failed to clone form. Database transaction rolled back.' });
  }
});

// DELETE /api/school-years/:id - Regional Only
// Must prevent deletion of active year (server-side check)
// Must require typing exact school year before deletion
// Must calculate and report affected record counts
// Must write an audit log
// Must roll back if any deletion step fails
router.delete('/:id', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { confirmName } = req.body;

    const targetSy = await db.select().from(schoolYears).where(eq(schoolYears.id, id));
    if (targetSy.length === 0) {
      return res.status(404).json({ error: 'School Year not found.' });
    }

    const sy = targetSy[0];

    // Prevent deletion of active School Year (Strict Server Rejection)
    if (sy.isActive) {
      return res.status(400).json({
        error: `Cannot delete '${sy.name}' because it is currently set as the active School Year. Please activate a different School Year first.`,
      });
    }

    // Require typing exact school year name
    if (!confirmName || confirmName.trim() !== sy.name.trim()) {
      return res.status(400).json({
        error: `Confirmation mismatch. You must type the exact School Year name '${sy.name}' to proceed with deletion.`,
      });
    }

    // Pre-calculate affected record counts
    const assList = await db.select({ id: assessments.id }).from(assessments).where(eq(assessments.schoolYearId, id));
    const assessmentIds = assList.map((a) => a.id);

    let totalResponses = 0;
    let answeredResponses = 0;
    if (assessmentIds.length > 0) {
      for (const aId of assessmentIds) {
        const respRows = await db.select().from(assessmentResponses).where(eq(assessmentResponses.assessmentId, aId));
        totalResponses += respRows.length;
        answeredResponses += respRows.filter((r) => r.rating > 0).length;
      }
    }

    const formList = await db.select({ id: assessmentForms.id }).from(assessmentForms).where(eq(assessmentForms.schoolYearId, id));
    let totalSections = 0;
    let totalIndicators = 0;
    for (const f of formList) {
      const secs = await db.select({ id: formSections.id }).from(formSections).where(eq(formSections.formId, f.id));
      totalSections += secs.length;
      const inds = await db.select({ id: formIndicators.id }).from(formIndicators).where(eq(formIndicators.formId, f.id));
      totalIndicators += inds.length;
    }

    const affectedCounts = {
      assessments: assessmentIds.length,
      answeredResponses,
      totalResponses,
      forms: formList.length,
      sections: totalSections,
      indicators: totalIndicators,
    };

    // Single database transaction with automatic rollback on error
    await db.transaction(async (tx) => {
      // 1. Delete assessment responses
      for (const assId of assessmentIds) {
        await tx.delete(assessmentResponses).where(eq(assessmentResponses.assessmentId, assId));
      }

      // 2. Delete assessments
      await tx.delete(assessments).where(eq(assessments.schoolYearId, id));

      // 3. Delete form indicators and sections
      for (const f of formList) {
        await tx.delete(formIndicators).where(eq(formIndicators.formId, f.id));
        await tx.delete(formSections).where(eq(formSections.formId, f.id));
      }

      // 4. Delete assessment forms
      await tx.delete(assessmentForms).where(eq(assessmentForms.schoolYearId, id));

      // 5. Delete school year record
      await tx.delete(schoolYears).where(eq(schoolYears.id, id));
    });

    // Write audit log
    await logAudit(
      req,
      'DELETE_SCHOOL_YEAR',
      'school_years',
      id,
      `Deleted SY ${sy.name} | Affected Records: ${affectedCounts.assessments} assessments, ${affectedCounts.answeredResponses} answered ratings (${affectedCounts.totalResponses} rows), ${affectedCounts.indicators} indicators, ${affectedCounts.sections} sections, ${affectedCounts.forms} forms.`
    );

    return res.json({
      message: `School Year '${sy.name}' and all associated forms, indicators, and assessments were permanently deleted.`,
      affected: affectedCounts,
    });
  } catch (err: any) {
    console.error('Delete school year error:', err);
    return res.status(500).json({ error: 'Failed to delete school year. Transaction rolled back.' });
  }
});

export default router;
