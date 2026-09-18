import { Router, Response } from 'express';
import ExcelJS from 'exceljs';
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

const router = Router();

// GET /api/export/excel - Multi-sheet ExcelJS export
router.get('/excel', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolYearId, divisionId } = req.query;

    // 1. Resolve target school year
    let targetSyId: number;
    if (schoolYearId) {
      targetSyId = parseInt(String(schoolYearId), 10);
    } else {
      const activeSy = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
      if (activeSy.length === 0) return res.status(400).json({ error: 'No active School Year found.' });
      targetSyId = activeSy[0].id;
    }

    const syRecord = await db.select().from(schoolYears).where(eq(schoolYears.id, targetSyId));
    const syName = syRecord[0]?.name || 'Unknown SY';

    // 2. Resolve Form & Sections & Indicators (Dynamic, never hardcoded)
    const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, targetSyId));
    if (formRes.length === 0) {
      return res.status(400).json({ error: 'No assessment form exists for the selected School Year.' });
    }
    const form = formRes[0];

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

    // 3. Resolve Scoped Schools
    let targetDivisionId: number | null = null;
    if (req.user!.role === 'division') {
      targetDivisionId = req.user!.divisionId;
    } else if (divisionId) {
      targetDivisionId = parseInt(String(divisionId), 10);
    }

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

    // 4. Fetch assessments & responses
    const allAss = await db.select().from(assessments).where(eq(assessments.schoolYearId, targetSyId));
    const assMap = new Map(allAss.map((a) => [a.schoolId, a]));

    const allResponses = await db
      .select()
      .from(assessmentResponses)
      .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
      .where(eq(assessments.schoolYearId, targetSyId));

    // Map responses: [assessmentId_indicatorId] -> rating
    const respMap = new Map<string, number>();
    for (const r of allResponses) {
      respMap.set(`${r.assessment_responses.assessmentId}_${r.assessment_responses.indicatorId}`, r.assessment_responses.rating);
    }

    // 5. Create ExcelJS Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Project SBM Online - DepEd Regional Office VIII';
    workbook.lastModifiedBy = req.user!.fullName;
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0038A8' }, // DepEd Blue
    };
    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    // ==========================================
    // SHEET 1: Consolidated Results
    // ==========================================
    const wsConsolidated = workbook.addWorksheet('Consolidated Results');

    // Headers
    const colHeaders = [
      'School ID',
      'School Name',
      'Division',
      'District',
      'Classification',
      'School Head',
      'Status',
      'Answered Count',
      'Total Indicators',
      'Overall Average',
      'Interpretation',
      'Submitted At',
      'Submitted By',
    ];

    // Add dynamic section columns
    for (const sec of sections) {
      colHeaders.push(`${sec.title} (Avg)`);
    }

    wsConsolidated.addRow(colHeaders);
    const headerRow1 = wsConsolidated.getRow(1);
    headerRow1.height = 28;
    headerRow1.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Populate school rows
    for (const s of scopedSchools) {
      const ass = assMap.get(s.schoolDbId);
      const st = ass ? ass.status : 'Not started';
      const overallAvg = ass ? parseFloat(ass.calculatedAverage) : 0;

      let answered = 0;
      if (ass) {
        for (const ind of indicators) {
          const r = respMap.get(`${ass.id}_${ind.id}`);
          if (r && r > 0) answered++;
        }
      }

      let interpretation = 'Not assessed';
      if (overallAvg > 0) {
        if (overallAvg < 1.5) interpretation = form.ratingLabel1;
        else if (overallAvg < 2.5) interpretation = form.ratingLabel2;
        else if (overallAvg < 3.5) interpretation = form.ratingLabel3;
        else interpretation = form.ratingLabel4;
      }

      const rowValues: any[] = [
        s.schoolId,
        s.schoolName,
        s.divisionName,
        s.district,
        s.classification,
        s.schoolHead,
        st,
        answered,
        indicators.length,
        overallAvg > 0 ? overallAvg.toFixed(2) : '0.00',
        interpretation,
        ass?.submittedAt ? ass.submittedAt.toISOString().split('T')[0] : 'N/A',
        ass?.submittedByName || 'N/A',
      ];

      // Add section averages
      for (const sec of sections) {
        const secInds = indicators.filter((i) => i.sectionId === sec.id);
        if (!ass || secInds.length === 0) {
          rowValues.push('0.00');
        } else {
          let secSum = 0;
          let secAns = 0;
          for (const si of secInds) {
            const r = respMap.get(`${ass.id}_${si.id}`);
            if (r && r > 0) {
              secSum += r;
              secAns++;
            }
          }
          rowValues.push(secAns > 0 ? (secSum / secAns).toFixed(2) : '0.00');
        }
      }

      const addedRow = wsConsolidated.addRow(rowValues);
      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    }

    // Auto-fit columns
    wsConsolidated.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 40);
      });
      col.width = maxLen + 3;
    });

    // ==========================================
    // SHEET 2: Indicator Summary
    // ==========================================
    const wsIndicators = workbook.addWorksheet('Indicator Summary');
    const indHeaders = [
      'Section / Dimension',
      'Indicator Code',
      'Indicator Description',
      `${form.ratingLabel1} (Count)`,
      `${form.ratingLabel2} (Count)`,
      `${form.ratingLabel3} (Count)`,
      `${form.ratingLabel4} (Count)`,
      'Total Answered',
      'Mean Rating',
    ];
    wsIndicators.addRow(indHeaders);
    const headerRow2 = wsIndicators.getRow(1);
    headerRow2.height = 28;
    headerRow2.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    for (const ind of indicators) {
      const sec = sections.find((s) => s.id === ind.sectionId);
      let count1 = 0;
      let count2 = 0;
      let count3 = 0;
      let count4 = 0;
      let sumRating = 0;
      let ratedTotal = 0;

      for (const s of scopedSchools) {
        const ass = assMap.get(s.schoolDbId);
        if (ass) {
          const r = respMap.get(`${ass.id}_${ind.id}`);
          if (r === 1) count1++;
          else if (r === 2) count2++;
          else if (r === 3) count3++;
          else if (r === 4) count4++;

          if (r && r > 0) {
            sumRating += r;
            ratedTotal++;
          }
        }
      }

      const meanRating = ratedTotal > 0 ? (sumRating / ratedTotal).toFixed(2) : '0.00';

      const row = wsIndicators.addRow([
        sec?.title || 'Section',
        ind.code,
        ind.content,
        count1,
        count2,
        count3,
        count4,
        ratedTotal,
        meanRating,
      ]);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    }

    wsIndicators.columns.forEach((col) => {
      let maxLen = 14;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 45);
      });
      col.width = maxLen + 3;
    });

    // ==========================================
    // SHEET 3: Export Information
    // ==========================================
    const wsInfo = workbook.addWorksheet('Export Information');
    wsInfo.addRow(['Project SBM Online - Consolidated Data Export Manifest']);
    wsInfo.getRow(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0038A8' } };
    wsInfo.addRow([]);

    const infoData = [
      ['Generated On', new Date().toLocaleString()],
      ['Generated By', req.user!.fullName],
      ['User Role', req.user!.role.toUpperCase()],
      ['User Account', req.user!.username],
      ['School Year', syName],
      ['Division Scope', targetDivisionId ? `Division ID #${targetDivisionId}` : 'ALL REGIONAL DIVISIONS (Full Regional Scope)'],
      ['Total Schools in Scope', scopedSchools.length],
      ['Submitted Assessments', scopedSchools.filter((s) => assMap.get(s.schoolDbId)?.status === 'Submitted').length],
      ['Draft Assessments', scopedSchools.filter((s) => assMap.get(s.schoolDbId)?.status === 'Draft').length],
      ['Not Started Assessments', scopedSchools.filter((s) => !assMap.get(s.schoolDbId) || assMap.get(s.schoolDbId)?.status === 'Not started').length],
      ['Regional Authority', 'Department of Education - Regional Office VIII (Eastern Visayas)'],
    ];

    for (const [k, v] of infoData) {
      const row = wsInfo.addRow([k, v]);
      row.getCell(1).font = { bold: true };
    }
    wsInfo.getColumn(1).width = 28;
    wsInfo.getColumn(2).width = 60;

    // ==========================================
    // SHEET 4: Form Snapshot
    // ==========================================
    const wsSnapshot = workbook.addWorksheet('Form Snapshot');
    wsSnapshot.addRow(['Assessment Form Snapshot for School Year: ' + syName]);
    wsSnapshot.getRow(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0038A8' } };
    wsSnapshot.addRow([]);

    wsSnapshot.addRow(['Form Title', form.title]);
    wsSnapshot.addRow(['Form Instructions', form.instructions]);
    wsSnapshot.addRow(['Form Status', form.status.toUpperCase()]);
    wsSnapshot.addRow(['Rating Level 1', form.ratingLabel1]);
    wsSnapshot.addRow(['Rating Level 2', form.ratingLabel2]);
    wsSnapshot.addRow(['Rating Level 3', form.ratingLabel3]);
    wsSnapshot.addRow(['Rating Level 4', form.ratingLabel4]);
    wsSnapshot.addRow(['Allow Edit After Submit', form.allowEditAfterSubmission ? 'YES' : 'NO']);
    wsSnapshot.addRow(['Require All Indicators', form.requireAllIndicators ? 'YES' : 'NO']);
    wsSnapshot.addRow(['Require Global Remarks', form.requireGlobalRemarks ? 'YES' : 'NO']);
    wsSnapshot.addRow(['Require Indicator Remarks', form.requireIndicatorRemarks ? 'YES' : 'NO']);
    wsSnapshot.addRow(['Total Sections/Dimensions', sections.length]);
    wsSnapshot.addRow(['Total Active Indicators', indicators.length]);
    wsSnapshot.addRow([]);

    wsSnapshot.addRow(['Indicator Item Hierarchy:']);
    wsSnapshot.getRow(wsSnapshot.rowCount).font = { bold: true, size: 12 };

    for (const sec of sections) {
      wsSnapshot.addRow([`[Dimension ${sec.orderIndex}] ${sec.title}`]);
      wsSnapshot.getRow(wsSnapshot.rowCount).font = { bold: true, color: { argb: 'FF0038A8' } };
      const secInds = indicators.filter((i) => i.sectionId === sec.id);
      for (const ind of secInds) {
        wsSnapshot.addRow(['', ind.code, ind.content]);
      }
    }

    wsSnapshot.getColumn(1).width = 24;
    wsSnapshot.getColumn(2).width = 16;
    wsSnapshot.getColumn(3).width = 75;

    // 6. Write Buffer & Send
    const buffer = await workbook.xlsx.writeBuffer();

    await logAudit(
      req,
      'EXCEL_EXPORT',
      'export',
      null,
      `SY: ${syName}, Schools: ${scopedSchools.length}`
    );

    const filename = `SBM_Online_Report_${syName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Excel export error:', err);
    return res.status(500).json({ error: 'Failed to generate Excel report.' });
  }
});

export default router;
