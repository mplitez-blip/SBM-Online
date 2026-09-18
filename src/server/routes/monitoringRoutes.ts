import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  divisions,
  schools,
  schoolYears,
  assessmentForms,
  formIndicators,
  assessments,
  assessmentResponses,
} from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
} from '../auth.ts';

const router = Router();

// GET /api/monitoring - Monitoring Table with server-side filters, sorting & pagination
router.get('/', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      schoolYearId,
      divisionId,
      district,
      classification,
      status,
      search,
      sortBy = 'schoolName',
      sortDir = 'asc',
      page = '1',
      pageSize = '15',
    } = req.query;

    // 1. Determine target School Year
    let targetSyId: number;
    if (schoolYearId) {
      targetSyId = parseInt(String(schoolYearId), 10);
    } else {
      const activeSy = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
      if (activeSy.length === 0) {
        return res.json({ data: [], total: 0, page: 1, pageSize: 15, activeIndicatorCount: 0 });
      }
      targetSyId = activeSy[0].id;
    }

    // 2. Determine active indicator count denominator for this School Year
    const formRes = await db.select().from(assessmentForms).where(eq(assessmentForms.schoolYearId, targetSyId));
    let activeIndicatorCount = 0;
    if (formRes.length > 0) {
      const indRes = await db
        .select()
        .from(formIndicators)
        .where(sql`${formIndicators.formId} = ${formRes[0].id} AND ${formIndicators.isActive} = true`);
      activeIndicatorCount = indRes.length;
    }

    // 3. Enforce Division scoping
    let targetDivisionId: number | null = null;
    if (req.user!.role === 'division') {
      targetDivisionId = req.user!.divisionId;
    } else if (divisionId) {
      targetDivisionId = parseInt(String(divisionId), 10);
    }

    // 4. Build query joining schools, divisions, and assessments for targetSyId
    // Base schools query
    let allSchools = await db
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
      allSchools = allSchools.filter((s) => s.divisionId === targetDivisionId);
    }
    if (district && String(district).trim()) {
      allSchools = allSchools.filter((s) => s.district.toLowerCase() === String(district).trim().toLowerCase());
    }
    if (classification && String(classification).trim()) {
      allSchools = allSchools.filter((s) => s.classification.toLowerCase() === String(classification).trim().toLowerCase());
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      allSchools = allSchools.filter(
        (s) => s.schoolId.toLowerCase().includes(q) || s.schoolName.toLowerCase().includes(q)
      );
    }

    // Fetch assessments for target school year
    const assList = await db
      .select()
      .from(assessments)
      .where(eq(assessments.schoolYearId, targetSyId));

    const assMap = new Map(assList.map((a) => [a.schoolId, a]));

    // Fetch answered counts
    let answeredMap = new Map<number, number>();
    if (assList.length > 0) {
      const respCounts = await db
        .select({
          assessmentId: assessmentResponses.assessmentId,
          answered: sql<number>`COUNT(CASE WHEN ${assessmentResponses.rating} > 0 THEN 1 END)`,
        })
        .from(assessmentResponses)
        .innerJoin(assessments, eq(assessmentResponses.assessmentId, assessments.id))
        .where(eq(assessments.schoolYearId, targetSyId))
        .groupBy(assessmentResponses.assessmentId);

      for (const rc of respCounts) {
        answeredMap.set(rc.assessmentId, Number(rc.answered));
      }
    }

    // Combine school data with assessment info
    let combined = allSchools.map((s) => {
      const ass = assMap.get(s.schoolDbId);
      const st = (ass ? ass.status : 'Not started') as 'Not started' | 'Draft' | 'Submitted';
      const ansCount = ass ? answeredMap.get(ass.id) || 0 : 0;
      return {
        schoolDbId: s.schoolDbId,
        schoolId: s.schoolId,
        schoolName: s.schoolName,
        divisionId: s.divisionId,
        divisionName: s.divisionName,
        district: s.district,
        classification: s.classification,
        schoolHead: s.schoolHead,
        status: st,
        answeredCount: ansCount,
        totalIndicators: activeIndicatorCount,
        averageRating: ass ? ass.calculatedAverage : '0.00',
        lastUpdated: ass?.updatedAt ? ass.updatedAt.toISOString() : null,
        submittedAt: ass?.submittedAt ? ass.submittedAt.toISOString() : null,
        submittedByName: ass?.submittedByName || null,
      };
    });

    // Filter by status if provided
    if (status && String(status).trim()) {
      combined = combined.filter((item) => item.status.toLowerCase() === String(status).trim().toLowerCase());
    }

    // Sorting
    const sField = String(sortBy);
    const sDir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;

    combined.sort((a: any, b: any) => {
      let valA = a[sField] ?? '';
      let valB = b[sField] ?? '';

      if (sField === 'averageRating' || sField === 'answeredCount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return (valA - valB) * sDir;
      }

      if (typeof valA === 'string') {
        return valA.localeCompare(String(valB)) * sDir;
      }
      return (valA > valB ? 1 : -1) * sDir;
    });

    // Pagination
    const pageNum = Math.max(1, parseInt(String(page), 10));
    const size = Math.max(1, parseInt(String(pageSize), 10));
    const total = combined.length;
    const paginated = combined.slice((pageNum - 1) * size, pageNum * size);

    return res.json({
      data: paginated,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
      activeIndicatorCount,
      schoolYearId: targetSyId,
    });
  } catch (err: any) {
    console.error('Monitoring error:', err);
    return res.status(500).json({ error: 'Failed to fetch monitoring data.' });
  }
});

// GET /api/monitoring/division-summary - Summary by Division for Regional users
router.get('/division-summary', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolYearId } = req.query;

    let targetSyId: number;
    if (schoolYearId) {
      targetSyId = parseInt(String(schoolYearId), 10);
    } else {
      const activeSy = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
      if (activeSy.length === 0) return res.json({ divisions: [], overall: {} });
      targetSyId = activeSy[0].id;
    }

    const allDivisions = await db.select().from(divisions).orderBy(divisions.divisionName);
    const allSchools = await db.select().from(schools);
    const allAssessments = await db.select().from(assessments).where(eq(assessments.schoolYearId, targetSyId));
    const assMap = new Map(allAssessments.map((a) => [a.schoolId, a]));

    const summary = allDivisions.map((div) => {
      const divSchools = allSchools.filter((s) => s.divisionId === div.id);
      const totalSchools = divSchools.length;

      let notStarted = 0;
      let draft = 0;
      let submitted = 0;
      let totalRatingSum = 0;
      let ratedCount = 0;

      for (const s of divSchools) {
        const ass = assMap.get(s.id);
        if (!ass || ass.status === 'Not started') {
          notStarted++;
        } else if (ass.status === 'Draft') {
          draft++;
        } else if (ass.status === 'Submitted') {
          submitted++;
          const avg = parseFloat(ass.calculatedAverage);
          if (avg > 0) {
            totalRatingSum += avg;
            ratedCount++;
          }
        }
      }

      const completionPercentage = totalSchools > 0 ? Math.round((submitted / totalSchools) * 100) : 0;
      const averageRating = ratedCount > 0 ? (totalRatingSum / ratedCount).toFixed(2) : '0.00';

      return {
        id: div.id,
        divisionCode: div.divisionCode,
        divisionName: div.divisionName,
        totalSchools,
        notStarted,
        draft,
        submitted,
        completionPercentage,
        averageRating,
      };
    });

    // Calculate Regional totals
    const regionalTotalSchools = summary.reduce((acc, d) => acc + d.totalSchools, 0);
    const regionalNotStarted = summary.reduce((acc, d) => acc + d.notStarted, 0);
    const regionalDraft = summary.reduce((acc, d) => acc + d.draft, 0);
    const regionalSubmitted = summary.reduce((acc, d) => acc + d.submitted, 0);
    const regionalCompletion = regionalTotalSchools > 0 ? Math.round((regionalSubmitted / regionalTotalSchools) * 100) : 0;

    const allSubmittedAvg = allAssessments
      .filter((a) => a.status === 'Submitted' && parseFloat(a.calculatedAverage) > 0)
      .map((a) => parseFloat(a.calculatedAverage));

    const regionalAverageRating =
      allSubmittedAvg.length > 0 ? (allSubmittedAvg.reduce((a, b) => a + b, 0) / allSubmittedAvg.length).toFixed(2) : '0.00';

    return res.json({
      divisions: summary,
      regionalTotals: {
        totalDivisions: allDivisions.length,
        totalSchools: regionalTotalSchools,
        notStarted: regionalNotStarted,
        draft: regionalDraft,
        submitted: regionalSubmitted,
        completionPercentage: regionalCompletion,
        averageRating: regionalAverageRating,
      },
    });
  } catch (err: any) {
    console.error('Division summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch division summary.' });
  }
});

// GET /api/monitoring/dashboard-stats - KPI stats for Regional and Division dashboards
router.get('/dashboard-stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeSyList = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
    const activeSy = activeSyList[0] || null;

    if (!activeSy) {
      return res.json({
        activeSchoolYear: null,
        divisionsInScope: 0,
        schoolsInScope: 0,
        draftCount: 0,
        submittedCount: 0,
        notStartedCount: 0,
        averageRating: '0.00',
        completionPercentage: 0,
      });
    }

    let scopedSchools = await db.select().from(schools);
    let divisionsCount = 13;

    if (req.user!.role === 'division') {
      scopedSchools = scopedSchools.filter((s) => s.divisionId === req.user!.divisionId);
      divisionsCount = 1;
    }

    const schoolIds = new Set(scopedSchools.map((s) => s.id));
    const allAss = await db.select().from(assessments).where(eq(assessments.schoolYearId, activeSy.id));
    const scopedAss = allAss.filter((a) => schoolIds.has(a.schoolId));

    let draftCount = 0;
    let submittedCount = 0;
    let sumRating = 0;
    let ratingCount = 0;

    for (const a of scopedAss) {
      if (a.status === 'Draft') draftCount++;
      if (a.status === 'Submitted') {
        submittedCount++;
        const val = parseFloat(a.calculatedAverage);
        if (val > 0) {
          sumRating += val;
          ratingCount++;
        }
      }
    }

    const notStartedCount = Math.max(0, scopedSchools.length - (draftCount + submittedCount));
    const averageRating = ratingCount > 0 ? (sumRating / ratingCount).toFixed(2) : '0.00';
    const completionPercentage = scopedSchools.length > 0 ? Math.round((submittedCount / scopedSchools.length) * 100) : 0;

    return res.json({
      activeSchoolYear: activeSy,
      divisionsInScope: divisionsCount,
      schoolsInScope: scopedSchools.length,
      draftCount,
      submittedCount,
      notStartedCount,
      averageRating,
      completionPercentage,
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
});

export default router;
