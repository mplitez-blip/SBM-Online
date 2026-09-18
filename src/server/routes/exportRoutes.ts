import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  divisions,
  schools,
  schoolYears,
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
  requireRole,
  logAudit,
} from '../auth.ts';
import {
  exportConsolidatedExcelReport,
  ConsolidatedExportInput,
} from '../services/exportService.ts';

const router = Router();

// GET /api/export/excel - Multi-sheet ExcelJS export
router.get(
  '/excel',
  requireAuth,
  requireRole('regional', 'division'),
  async (req: AuthenticatedRequest, res: Response) => {
    let cleanupHandler: (() => Promise<void>) | null = null;

    try {
      // 1. Validate user role
      if (req.user!.role === 'school') {
        return res.status(403).json({
          error: 'Schools cannot access consolidated exports. Please use your school assessment dashboard.',
        });
      }

      const { schoolYearId, divisionId } = req.query;

      // 2. Resolve target school year (user MUST select a configured School Year)
      if (!schoolYearId) {
        return res.status(400).json({
          error: 'Please select a configured School Year for export.',
        });
      }

      const targetSyId = parseInt(String(schoolYearId), 10);
      if (isNaN(targetSyId) || targetSyId <= 0) {
        return res.status(400).json({
          error: 'Invalid School Year identifier specified.',
        });
      }

      const syRecord = await db.select().from(schoolYears).where(eq(schoolYears.id, targetSyId));
      if (syRecord.length === 0) {
        return res.status(404).json({
          error: 'Selected School Year was not found in the system.',
        });
      }
      const syName = syRecord[0].name;

      // 3. Resolve Form & Sections & Indicators at export time
      const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, targetSyId));
      if (formRes.length === 0) {
        return res.status(400).json({
          error: `No assessment form exists for School Year ${syName}. Please configure the form first.`,
        });
      }
      const form = formRes[0];

      const sections = await db
        .select()
        .from(formSections)
        .where(eq(formSections.formId, form.id))
        .orderBy(formSections.orderIndex);

      const allIndicators = await db
        .select()
        .from(formIndicators)
        .where(eq(formIndicators.formId, form.id))
        .orderBy(formIndicators.orderIndex);

      // Filter active indicators for scoring and summary
      const activeIndicators = allIndicators.filter((i) => i.isActive);

      // 4. Resolve Scoped Division
      let targetDivisionId: number | null = null;
      let targetDivisionName: string | null = null;

      if (req.user!.role === 'division') {
        // Division user is strictly scoped to their assigned division
        targetDivisionId = req.user!.divisionId;
      } else if (divisionId && divisionId !== 'all') {
        // Regional user filtering by specific division
        targetDivisionId = parseInt(String(divisionId), 10);
      }

      if (targetDivisionId) {
        const divRes = await db.select().from(divisions).where(eq(divisions.id, targetDivisionId));
        if (divRes.length > 0) {
          targetDivisionName = divRes[0].divisionName;
        }
      }

      // 5. Query Scoped Schools
      let scopedSchools = await db
        .select({
          schoolDbId: schools.id,
          schoolId: schools.schoolId,
          schoolName: schools.schoolName,
          divisionId: schools.divisionId,
          divisionName: divisions.divisionName,
          district: schools.district,
          classification: schools.classification,
          schoolHead: schools.schoolHead,
        })
        .from(schools)
        .innerJoin(divisions, eq(schools.divisionId, divisions.id));

      if (targetDivisionId) {
        scopedSchools = scopedSchools.filter((s) => s.divisionId === targetDivisionId);
      }

      // 6. Fetch assessments & responses
      const allAss = await db.select().from(assessments).where(eq(assessments.schoolYearId, targetSyId));

      const allResponses = await db
        .select({
          assessmentId: assessmentResponses.assessmentId,
          indicatorId: assessmentResponses.indicatorId,
          rating: assessmentResponses.rating,
          remarks: assessmentResponses.remarks,
        })
        .from(assessmentResponses)
        .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
        .where(eq(assessments.schoolYearId, targetSyId));

      // 7. Assemble Export Input Data
      const exportData: ConsolidatedExportInput = {
        schoolYearName: syName,
        form: {
          id: form.id,
          schoolYearId: form.schoolYearId,
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
        },
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          orderIndex: s.orderIndex,
        })),
        indicators: activeIndicators.map((i) => ({
          id: i.id,
          sectionId: i.sectionId,
          code: i.code,
          content: i.content,
          orderIndex: i.orderIndex,
          isActive: i.isActive,
        })),
        allIndicatorsIncludingInactive: allIndicators.map((i) => ({
          id: i.id,
          sectionId: i.sectionId,
          code: i.code,
          content: i.content,
          orderIndex: i.orderIndex,
          isActive: i.isActive,
        })),
        schools: scopedSchools,
        assessments: allAss.map((a) => ({
          id: a.id,
          schoolId: a.schoolId,
          schoolYearId: a.schoolYearId,
          status: a.status,
          calculatedAverage: a.calculatedAverage,
          submittedAt: a.submittedAt,
          submittedByName: a.submittedByName,
          globalRemarks: a.globalRemarks,
        })),
        responses: allResponses,
        scope: {
          role: req.user!.role as 'regional' | 'division',
          divisionId: targetDivisionId,
          divisionName: targetDivisionName,
        },
        exporter: {
          fullName: req.user!.fullName,
          username: req.user!.username,
          role: req.user!.role,
        },
      };

      // 8. Generate Excel Report safely to a temporary file
      const { tempFilePath, filename, cleanup } = await exportConsolidatedExcelReport(exportData);
      cleanupHandler = cleanup;

      // 9. Send file to client and clean up
      res.download(tempFilePath, filename, async (downloadErr) => {
        if (downloadErr) {
          console.error('[ExcelExportDownloadError]', downloadErr);
          await logAudit(
            req,
            'EXCEL_EXPORT_FAIL',
            'export',
            null,
            `SY: ${syName}, Download failed: ${downloadErr.message}`
          );
        } else {
          await logAudit(
            req,
            'EXCEL_EXPORT_SUCCESS',
            'export',
            null,
            `SY: ${syName}, Scope: ${targetDivisionName || 'Regional'}, Schools: ${scopedSchools.length}`
          );
        }

        // Clean up temporary file immediately after transfer
        if (cleanupHandler) {
          await cleanupHandler();
          cleanupHandler = null;
        }
      });
    } catch (err: any) {
      console.error('[ExcelExportInternalError]', err);

      // Clean up temp file if error occurred before download completed
      if (cleanupHandler) {
        try {
          await cleanupHandler();
        } catch {}
      }

      await logAudit(
        req,
        'EXCEL_EXPORT_ERROR',
        'export',
        null,
        `Internal error: ${err?.message || 'Unknown'}`
      );

      return res.status(500).json({
        error: 'Failed to generate Excel report due to an internal server error. Please try again later.',
      });
    }
  }
);

export default router;
