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

// Helper to fetch form details for a school year with existing assessment counts
async function fetchFormForSchoolYear(schoolYearId: number) {
  const sy = await db.select().from(schoolYears).where(eq(schoolYears.id, schoolYearId));
  if (sy.length === 0) {
    return { error: 'School Year not found', status: 404 };
  }

  // Check if assessments already exist for this school year (Warning requirement)
  const assCountRes = await db
    .select({ count: count() })
    .from(assessments)
    .where(eq(assessments.schoolYearId, schoolYearId));
  const assessmentCount = Number(assCountRes[0]?.count || 0);

  // Number of answered indicator ratings (strictly rating > 0, excluding stored blank rows)
  const ansRes = await db
    .select({ count: count() })
    .from(assessmentResponses)
    .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
    .where(sql`${assessments.schoolYearId} = ${schoolYearId} AND ${assessmentResponses.rating} > 0`);
  const answeredResponsesCount = Number(ansRes[0]?.count || 0);

  const formList = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, schoolYearId));
  if (formList.length === 0) {
    return {
      form: null,
      schoolYear: sy[0],
      assessmentCount,
      answeredResponsesCount,
      hasAssessments: assessmentCount > 0,
    };
  }

  const form = formList[0];
  const sections = await db
    .select()
    .from(formSections)
    .where(eq(formSections.formId, form.id))
    .orderBy(formSections.orderIndex);

  const indicators = await db
    .select()
    .from(formIndicators)
    .where(eq(formIndicators.formId, form.id))
    .orderBy(formIndicators.orderIndex);

  // Group indicators by section
  const sectionsWithIndicators = sections.map((sec) => ({
    ...sec,
    indicators: indicators.filter((ind) => ind.sectionId === sec.id),
  }));

  return {
    form: {
      ...form,
      schoolYearName: sy[0].name,
      sections: sectionsWithIndicators,
    },
    schoolYear: sy[0],
    assessmentCount,
    answeredResponsesCount,
    hasAssessments: assessmentCount > 0,
  };
}

// GET /api/forms/year/:schoolYearId - Load form configuration and assessment presence warnings
router.get('/year/:schoolYearId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schoolYearId = parseInt(req.params.schoolYearId, 10);
    const data = await fetchFormForSchoolYear(schoolYearId);
    if ('error' in data) {
      return res.status(data.status || 404).json({ error: data.error });
    }
    return res.json(data);
  } catch (err: any) {
    console.error('Fetch form error:', err);
    return res.status(500).json({ error: 'Failed to fetch assessment form.' });
  }
});

// GET /api/forms/:schoolYearId - Direct ID shorthand
router.get('/:schoolYearId(\\d+)', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schoolYearId = parseInt(req.params.schoolYearId, 10);
    const data = await fetchFormForSchoolYear(schoolYearId);
    if ('error' in data) {
      return res.status(data.status || 404).json({ error: data.error });
    }
    return res.json(data);
  } catch (err: any) {
    console.error('Fetch form error:', err);
    return res.status(500).json({ error: 'Failed to fetch assessment form.' });
  }
});

// POST /api/forms/create - Create form for a School Year
router.post('/create', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolYearId, title, instructions, ratingLabel1, ratingLabel2, ratingLabel3, ratingLabel4 } = req.body;
    if (!schoolYearId || !title) {
      return res.status(400).json({ error: 'School Year ID and form title are required.' });
    }

    const existing = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(schoolYearId)));
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An assessment form already exists for this School Year.' });
    }

    const [newForm] = await db
      .insert(assessmentForms)
      .values({
        schoolYearId: Number(schoolYearId),
        title: title.trim(),
        instructions: instructions ? instructions.trim() : 'Rate each indicator objectively.',
        ratingLabel1: ratingLabel1?.trim() || 'Level 1: Developing',
        ratingLabel2: ratingLabel2?.trim() || 'Level 2: Maturing',
        ratingLabel3: ratingLabel3?.trim() || 'Level 3: Advanced',
        ratingLabel4: ratingLabel4?.trim() || 'Level 4: Exemplary',
        status: 'draft',
      })
      .returning();

    await logAudit(req, 'CREATE_ASSESSMENT_FORM', 'assessment_forms', newForm.id);
    return res.status(201).json({ message: 'Form created successfully.', form: newForm });
  } catch (err: any) {
    console.error('Create form error:', err);
    return res.status(500).json({ error: 'Failed to create assessment form.' });
  }
});

// PUT /api/forms/:id/publish - Toggle or set publish status (Regional only)
router.put('/:id/publish', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.select().from(assessmentForms).where(eq(assessmentForms.id, id));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assessment form not found.' });
    }

    const newStatus = existing[0].status === 'published' ? 'draft' : 'published';
    const [updated] = await db
      .update(assessmentForms)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(assessmentForms.id, id))
      .returning();

    await logAudit(req, 'TOGGLE_FORM_STATUS', 'assessment_forms', id, `Status set to ${newStatus}`);
    return res.json({ message: `Form status updated to ${newStatus}.`, form: updated, status: newStatus });
  } catch (err: any) {
    console.error('Toggle form status error:', err);
    return res.status(500).json({ error: 'Failed to toggle form status.' });
  }
});

// PUT /api/forms/:id AND PUT /api/forms/settings/:id - Update form metadata and settings (Regional only)
const updateFormSettingsHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      title,
      instructions,
      ratingLabel1,
      ratingLabel2,
      ratingLabel3,
      ratingLabel4,
      status,
      allowEditAfterSubmission,
      requireAllIndicators,
      requireGlobalRemarks,
      requireIndicatorRemarks,
    } = req.body;

    const existing = await db.select().from(assessmentForms).where(eq(assessmentForms.id, id));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assessment form not found.' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title.trim();
    if (instructions !== undefined) updateData.instructions = instructions.trim();
    if (ratingLabel1 !== undefined) updateData.ratingLabel1 = ratingLabel1.trim();
    if (ratingLabel2 !== undefined) updateData.ratingLabel2 = ratingLabel2.trim();
    if (ratingLabel3 !== undefined) updateData.ratingLabel3 = ratingLabel3.trim();
    if (ratingLabel4 !== undefined) updateData.ratingLabel4 = ratingLabel4.trim();
    if (status !== undefined) updateData.status = status;
    if (allowEditAfterSubmission !== undefined) updateData.allowEditAfterSubmission = Boolean(allowEditAfterSubmission);
    if (requireAllIndicators !== undefined) updateData.requireAllIndicators = Boolean(requireAllIndicators);
    if (requireGlobalRemarks !== undefined) updateData.requireGlobalRemarks = Boolean(requireGlobalRemarks);
    if (requireIndicatorRemarks !== undefined) updateData.requireIndicatorRemarks = Boolean(requireIndicatorRemarks);

    const [updated] = await db.update(assessmentForms).set(updateData).where(eq(assessmentForms.id, id)).returning();
    await logAudit(req, 'UPDATE_FORM_SETTINGS', 'assessment_forms', id, `Status: ${updated.status}`);

    return res.json({ message: 'Assessment form settings updated successfully.', form: updated });
  } catch (err: any) {
    console.error('Update form error:', err);
    return res.status(500).json({ error: 'Failed to update form settings.' });
  }
};

router.put('/settings/:id', requireAuth, requireRole('regional'), updateFormSettingsHandler);
router.put('/:id(\\d+)', requireAuth, requireRole('regional'), updateFormSettingsHandler);

// POST /api/forms/:id/clone-from/:sourceYearId - Form cloning transaction (Regional only)
router.post('/:id/clone-from/:sourceYearId', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetFormId = parseInt(req.params.id, 10);
    const sourceYearId = parseInt(req.params.sourceYearId, 10);

    const targetForm = await db.select().from(assessmentForms).where(eq(assessmentForms.id, targetFormId));
    if (targetForm.length === 0) {
      return res.status(404).json({ error: 'Target assessment form not found.' });
    }

    const sourceForms = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, sourceYearId));
    if (sourceForms.length === 0) {
      return res.status(404).json({ error: 'Source School Year does not have an assessment form to clone.' });
    }

    const sForm = sourceForms[0];

    // Database transaction for form cloning: atomic copy of sections and indicators
    await db.transaction(async (tx) => {
      // 1. Clear existing sections & indicators of target form
      await tx.delete(formIndicators).where(eq(formIndicators.formId, targetFormId));
      await tx.delete(formSections).where(eq(formSections.formId, targetFormId));

      // 2. Update target form metadata from source form
      await tx.update(assessmentForms).set({
        instructions: sForm.instructions,
        ratingLabel1: sForm.ratingLabel1,
        ratingLabel2: sForm.ratingLabel2,
        ratingLabel3: sForm.ratingLabel3,
        ratingLabel4: sForm.ratingLabel4,
        allowEditAfterSubmission: sForm.allowEditAfterSubmission,
        requireAllIndicators: sForm.requireAllIndicators,
        requireGlobalRemarks: sForm.requireGlobalRemarks,
        requireIndicatorRemarks: sForm.requireIndicatorRemarks,
        status: 'draft',
        updatedAt: new Date(),
      }).where(eq(assessmentForms.id, targetFormId));

      // 3. Clone sections and indicators
      const sSections = await tx
        .select()
        .from(formSections)
        .where(eq(formSections.formId, sForm.id))
        .orderBy(formSections.orderIndex);

      for (const sSec of sSections) {
        const [clonedSec] = await tx
          .insert(formSections)
          .values({
            formId: targetFormId,
            title: sSec.title,
            orderIndex: sSec.orderIndex,
          })
          .returning();

        const sInds = await tx
          .select()
          .from(formIndicators)
          .where(eq(formIndicators.sectionId, sSec.id))
          .orderBy(formIndicators.orderIndex);

        for (const sInd of sInds) {
          await tx.insert(formIndicators).values({
            formId: targetFormId,
            sectionId: clonedSec.id,
            code: sInd.code,
            content: sInd.content,
            orderIndex: sInd.orderIndex,
            isActive: sInd.isActive,
          });
        }
      }
    });

    await logAudit(req, 'CLONE_FORM_FRAMEWORK', 'assessment_forms', targetFormId, `Cloned from SY ${sourceYearId}`);
    return res.json({ message: 'Assessment form cloned successfully within transaction.' });
  } catch (err: any) {
    console.error('Clone form error:', err);
    return res.status(500).json({ error: 'Failed to clone form. Transaction rolled back.' });
  }
});

// POST /api/forms/clone - Shorthand clone by targetSchoolYearId and sourceSchoolYearId
router.post('/clone', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetSchoolYearId, sourceSchoolYearId } = req.body;
    if (!targetSchoolYearId || !sourceSchoolYearId) {
      return res.status(400).json({ error: 'targetSchoolYearId and sourceSchoolYearId are required.' });
    }

    const targetForms = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(targetSchoolYearId)));
    if (targetForms.length === 0) {
      return res.status(404).json({ error: 'Target School Year does not have a form yet.' });
    }

    const sourceForms = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, Number(sourceSchoolYearId)));
    if (sourceForms.length === 0) {
      return res.status(404).json({ error: 'Source School Year does not have an assessment form to clone.' });
    }

    const targetFormId = targetForms[0].id;
    const sForm = sourceForms[0];

    await db.transaction(async (tx) => {
      await tx.delete(formIndicators).where(eq(formIndicators.formId, targetFormId));
      await tx.delete(formSections).where(eq(formSections.formId, targetFormId));

      await tx.update(assessmentForms).set({
        instructions: sForm.instructions,
        ratingLabel1: sForm.ratingLabel1,
        ratingLabel2: sForm.ratingLabel2,
        ratingLabel3: sForm.ratingLabel3,
        ratingLabel4: sForm.ratingLabel4,
        allowEditAfterSubmission: sForm.allowEditAfterSubmission,
        requireAllIndicators: sForm.requireAllIndicators,
        requireGlobalRemarks: sForm.requireGlobalRemarks,
        requireIndicatorRemarks: sForm.requireIndicatorRemarks,
        status: 'draft',
        updatedAt: new Date(),
      }).where(eq(assessmentForms.id, targetFormId));

      const sSections = await tx.select().from(formSections).where(eq(formSections.formId, sForm.id)).orderBy(formSections.orderIndex);
      for (const sSec of sSections) {
        const [clonedSec] = await tx.insert(formSections).values({
          formId: targetFormId,
          title: sSec.title,
          orderIndex: sSec.orderIndex,
        }).returning();

        const sInds = await tx.select().from(formIndicators).where(eq(formIndicators.sectionId, sSec.id)).orderBy(formIndicators.orderIndex);
        for (const sInd of sInds) {
          await tx.insert(formIndicators).values({
            formId: targetFormId,
            sectionId: clonedSec.id,
            code: sInd.code,
            content: sInd.content,
            orderIndex: sInd.orderIndex,
            isActive: sInd.isActive,
          });
        }
      }
    });

    await logAudit(req, 'CLONE_FORM_FRAMEWORK', 'assessment_forms', targetFormId, `Cloned from SY ${sourceSchoolYearId}`);
    return res.json({ message: 'Assessment form cloned successfully.' });
  } catch (err: any) {
    console.error('Clone form error:', err);
    return res.status(500).json({ error: 'Failed to clone form. Transaction rolled back.' });
  }
});

// POST /api/forms/sections AND POST /api/forms/:id/sections - Add section/dimension
const addSectionHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const formId = parseInt(req.params.id || req.body.formId, 10);
    const { title, orderIndex } = req.body;
    if (!formId || !title) {
      return res.status(400).json({ error: 'Form ID and section title are required.' });
    }

    let order = Number(orderIndex);
    if (isNaN(order)) {
      const maxOrder = await db
        .select({ max: sql<number>`COALESCE(MAX(${formSections.orderIndex}), 0)` })
        .from(formSections)
        .where(eq(formSections.formId, formId));
      order = (maxOrder[0]?.max || 0) + 1;
    }

    const [newSec] = await db
      .insert(formSections)
      .values({
        formId,
        title: title.trim(),
        orderIndex: order,
      })
      .returning();

    await logAudit(req, 'ADD_FORM_SECTION', 'form_sections', newSec.id, `Title: ${title}`);
    return res.status(201).json({ message: 'Section added successfully.', section: newSec });
  } catch (err: any) {
    console.error('Add section error:', err);
    return res.status(500).json({ error: 'Failed to add section.' });
  }
};

router.post('/sections', requireAuth, requireRole('regional'), addSectionHandler);
router.post('/:id/sections', requireAuth, requireRole('regional'), addSectionHandler);

// PUT /api/forms/sections/reorder - Reorder sections inside transaction (Regional only)
router.put('/sections/reorder', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderedSectionIds } = req.body;
    if (!Array.isArray(orderedSectionIds)) {
      return res.status(400).json({ error: 'orderedSectionIds array is required.' });
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedSectionIds.length; i++) {
        await tx
          .update(formSections)
          .set({ orderIndex: i + 1 })
          .where(eq(formSections.id, Number(orderedSectionIds[i])));
      }
    });

    await logAudit(req, 'REORDER_FORM_SECTIONS', 'form_sections', 0, `Count: ${orderedSectionIds.length}`);
    return res.json({ message: 'Sections reordered successfully.' });
  } catch (err: any) {
    console.error('Reorder sections error:', err);
    return res.status(500).json({ error: 'Failed to reorder sections.' });
  }
});

// PUT /api/forms/sections/:sectionId - Update section
router.put('/sections/:sectionId', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sectionId = parseInt(req.params.sectionId, 10);
    const { title, orderIndex } = req.body;

    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (orderIndex !== undefined) updateData.orderIndex = Number(orderIndex);

    const [updated] = await db.update(formSections).set(updateData).where(eq(formSections.id, sectionId)).returning();
    await logAudit(req, 'UPDATE_FORM_SECTION', 'form_sections', sectionId);

    return res.json({ message: 'Section updated successfully.', section: updated });
  } catch (err: any) {
    console.error('Update section error:', err);
    return res.status(500).json({ error: 'Failed to update section.' });
  }
});

// DELETE /api/forms/sections/:sectionId - Delete section and its indicators (Regional only)
router.delete('/sections/:sectionId', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sectionId = parseInt(req.params.sectionId, 10);
    await db.transaction(async (tx) => {
      await tx.delete(formIndicators).where(eq(formIndicators.sectionId, sectionId));
      await tx.delete(formSections).where(eq(formSections.id, sectionId));
    });
    await logAudit(req, 'DELETE_FORM_SECTION', 'form_sections', sectionId);
    return res.json({ message: 'Section and contained indicators removed.' });
  } catch (err: any) {
    console.error('Delete section error:', err);
    return res.status(500).json({ error: 'Failed to delete section.' });
  }
});

// POST /api/forms/indicators AND POST /api/forms/sections/:sectionId/indicators - Add indicator
const addIndicatorHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sectionId = parseInt(req.params.sectionId || req.body.sectionId, 10);
    const { formId, code, content, orderIndex, isActive, isRequired } = req.body;
    if (!sectionId || !code || !content) {
      return res.status(400).json({ error: 'Section ID, indicator code, and indicator content are required.' });
    }

    let actualFormId = Number(formId);
    if (!actualFormId) {
      const sec = await db.select({ formId: formSections.formId }).from(formSections).where(eq(formSections.id, sectionId));
      if (sec.length > 0) actualFormId = sec[0].formId;
    }

    if (!actualFormId) {
      return res.status(400).json({ error: 'Valid Form ID could not be determined.' });
    }

    let order = Number(orderIndex);
    if (isNaN(order)) {
      const maxOrder = await db
        .select({ max: sql<number>`COALESCE(MAX(${formIndicators.orderIndex}), 0)` })
        .from(formIndicators)
        .where(eq(formIndicators.sectionId, sectionId));
      order = (maxOrder[0]?.max || 0) + 1;
    }

    const [newInd] = await db
      .insert(formIndicators)
      .values({
        formId: actualFormId,
        sectionId,
        code: code.trim(),
        content: content.trim(),
        orderIndex: order,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning();

    await logAudit(req, 'ADD_FORM_INDICATOR', 'form_indicators', newInd.id, `Code: ${code}`);
    return res.status(201).json({ message: 'Indicator added successfully.', indicator: newInd });
  } catch (err: any) {
    console.error('Add indicator error:', err);
    return res.status(500).json({ error: 'Failed to add indicator.' });
  }
};

router.post('/indicators', requireAuth, requireRole('regional'), addIndicatorHandler);
router.post('/sections/:sectionId/indicators', requireAuth, requireRole('regional'), addIndicatorHandler);

// PUT /api/forms/indicators/:indicatorId - Update indicator
router.put('/indicators/:indicatorId', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const indicatorId = parseInt(req.params.indicatorId, 10);
    const { code, content, orderIndex, isActive, sectionId } = req.body;

    const updateData: any = {};
    if (code !== undefined) updateData.code = code.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (orderIndex !== undefined) updateData.orderIndex = Number(orderIndex);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (sectionId !== undefined) updateData.sectionId = Number(sectionId);

    const [updated] = await db.update(formIndicators).set(updateData).where(eq(formIndicators.id, indicatorId)).returning();
    await logAudit(req, 'UPDATE_FORM_INDICATOR', 'form_indicators', indicatorId);

    return res.json({ message: 'Indicator updated successfully.', indicator: updated });
  } catch (err: any) {
    console.error('Update indicator error:', err);
    return res.status(500).json({ error: 'Failed to update indicator.' });
  }
});

// DELETE /api/forms/indicators/:indicatorId - Delete indicator
router.delete('/indicators/:indicatorId', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const indicatorId = parseInt(req.params.indicatorId, 10);
    await db.delete(formIndicators).where(eq(formIndicators.id, indicatorId));
    await logAudit(req, 'DELETE_FORM_INDICATOR', 'form_indicators', indicatorId);
    return res.json({ message: 'Indicator removed.' });
  } catch (err: any) {
    console.error('Delete indicator error:', err);
    return res.status(500).json({ error: 'Failed to delete indicator.' });
  }
});

// PUT /api/forms/indicators/:indicatorId/toggle-active - Deactivate instead of delete
router.put('/indicators/:indicatorId/toggle-active', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const indicatorId = parseInt(req.params.indicatorId, 10);
    const existing = await db.select().from(formIndicators).where(eq(formIndicators.id, indicatorId));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Indicator not found.' });
    }

    const newStatus = !existing[0].isActive;
    const [updated] = await db
      .update(formIndicators)
      .set({ isActive: newStatus })
      .where(eq(formIndicators.id, indicatorId))
      .returning();

    await logAudit(req, newStatus ? 'ACTIVATE_INDICATOR' : 'DEACTIVATE_INDICATOR', 'form_indicators', indicatorId);
    return res.json({
      message: `Indicator ${updated.code} is now ${newStatus ? 'active' : 'inactive'}.`,
      indicator: updated,
    });
  } catch (err: any) {
    console.error('Toggle indicator active error:', err);
    return res.status(500).json({ error: 'Failed to toggle indicator status.' });
  }
});

// PUT /api/forms/:id/indicators/bulk AND PUT /api/forms/bulk-indicators - BULK INDICATOR UPDATES TRANSACTION
// Updates or creates a batch of indicators atomically within a single database transaction.
// If any indicator update fails, the entire transaction rolls back.
const bulkIndicatorUpdateHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const formId = parseInt(req.params.id || req.body.formId, 10);
    const { indicators } = req.body;

    if (!indicators || !Array.isArray(indicators)) {
      return res.status(400).json({ error: 'indicators array is required.' });
    }

    const updatedIndicators: any[] = [];

    // Single database transaction with automatic rollback if any statement fails
    await db.transaction(async (tx) => {
      for (const item of indicators) {
        if (!item.code || !item.content || !item.sectionId) {
          throw new Error(`Indicator requires code, content, and sectionId.`);
        }

        if (item.id) {
          // Update existing indicator
          const [updated] = await tx
            .update(formIndicators)
            .set({
              code: String(item.code).trim(),
              content: String(item.content).trim(),
              sectionId: Number(item.sectionId),
              orderIndex: item.orderIndex !== undefined ? Number(item.orderIndex) : 0,
              isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
            })
            .where(eq(formIndicators.id, Number(item.id)))
            .returning();
          updatedIndicators.push(updated);
        } else {
          // Insert new indicator
          const targetFormId = formId || item.formId;
          if (!targetFormId) {
            const sec = await tx.select({ formId: formSections.formId }).from(formSections).where(eq(formSections.id, Number(item.sectionId)));
            if (!sec.length) throw new Error(`Invalid section ID: ${item.sectionId}`);
          }
          const [inserted] = await tx
            .insert(formIndicators)
            .values({
              formId: targetFormId || (await tx.select({ formId: formSections.formId }).from(formSections).where(eq(formSections.id, Number(item.sectionId))))[0].formId,
              sectionId: Number(item.sectionId),
              code: String(item.code).trim(),
              content: String(item.content).trim(),
              orderIndex: item.orderIndex !== undefined ? Number(item.orderIndex) : 0,
              isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
            })
            .returning();
          updatedIndicators.push(inserted);
        }
      }
    });

    await logAudit(req, 'BULK_UPDATE_INDICATORS', 'form_indicators', formId || 0, `Count: ${indicators.length}`);
    return res.json({
      message: `Successfully processed bulk update of ${indicators.length} indicators in database transaction.`,
      indicators: updatedIndicators,
      count: updatedIndicators.length,
    });
  } catch (err: any) {
    console.error('Bulk indicator update error:', err);
    return res.status(500).json({ error: `Bulk indicator update failed: ${err.message}. Transaction rolled back.` });
  }
};

router.put('/:id/indicators/bulk', requireAuth, requireRole('regional'), bulkIndicatorUpdateHandler);
router.put('/bulk-indicators', requireAuth, requireRole('regional'), bulkIndicatorUpdateHandler);

export default router;
