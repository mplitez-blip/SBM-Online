import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import ExcelJS from 'exceljs';

export interface FormSectionData {
  id: number;
  title: string;
  orderIndex: number;
}

export interface FormIndicatorData {
  id: number;
  sectionId: number;
  code: string;
  content: string;
  orderIndex: number;
  isActive: boolean;
}

export interface AssessmentFormData {
  id: number;
  schoolYearId: number;
  title: string;
  instructions: string;
  ratingLabel1: string;
  ratingLabel2: string;
  ratingLabel3: string;
  ratingLabel4: string;
  status: string;
  allowEditAfterSubmission: boolean;
  requireAllIndicators: boolean;
  requireGlobalRemarks: boolean;
  requireIndicatorRemarks: boolean;
}

export interface SchoolExportData {
  schoolDbId: number;
  schoolId: string;
  schoolName: string;
  divisionId: number;
  divisionName: string;
  district: string;
  classification: string;
  schoolHead: string;
}

export interface AssessmentRecordData {
  id: number;
  schoolId: number;
  schoolYearId: number;
  status: string; // 'Not started' | 'Draft' | 'Submitted'
  calculatedAverage: string;
  submittedAt?: Date | string | null;
  submittedByName?: string | null;
  globalRemarks?: string | null;
}

export interface AssessmentResponseData {
  assessmentId: number;
  indicatorId: number;
  rating: number;
  remarks?: string | null;
}

export interface ConsolidatedExportInput {
  schoolYearName: string;
  form: AssessmentFormData;
  sections: FormSectionData[];
  indicators: FormIndicatorData[]; // active indicators, ordered by orderIndex
  allIndicatorsIncludingInactive?: FormIndicatorData[]; // for form snapshot
  schools: SchoolExportData[];
  assessments: AssessmentRecordData[];
  responses: AssessmentResponseData[];
  scope: {
    role: 'regional' | 'division';
    divisionId?: number | null;
    divisionName?: string | null;
  };
  exporter: {
    fullName: string;
    username: string;
    role: string;
  };
}

/**
 * Builds the complete 4-sheet ExcelJS Workbook dynamically from configured inputs.
 */
export async function buildConsolidatedExcelWorkbook(data: ConsolidatedExportInput): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project SBM Online - DepEd Regional Office VIII';
  workbook.lastModifiedBy = data.exporter.fullName;
  workbook.created = new Date();

  // Color Constants (DepEd Blue & Warm Accents)
  const DEPED_BLUE = 'FF0038A8';
  const LIGHT_BLUE_FILL = 'FFE8EFFC';
  const GROUP_HEADER_FILL = 'FFD8E5F8';
  const TOTAL_ROW_FILL = 'FFF1F5F9';
  const BORDER_COLOR = 'FFD0D7DE';

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: DEPED_BLUE },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Arial',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };

  // Maps for fast lookup
  const assMap = new Map(data.assessments.map((a) => [a.schoolId, a]));
  const respMap = new Map<string, number>();
  for (const r of data.responses) {
    respMap.set(`${r.assessmentId}_${r.indicatorId}`, r.rating);
  }

  // Active indicators strictly respecting display order
  const activeIndicators = [...data.indicators].filter((i) => i.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
  const sections = [...data.sections].sort((a, b) => a.orderIndex - b.orderIndex);

  // Helper to interpret score
  const interpretScore = (avg: number) => {
    if (avg <= 0) return 'Not Assessed';
    if (avg < 1.5) return data.form.ratingLabel1;
    if (avg < 2.5) return data.form.ratingLabel2;
    if (avg < 3.5) return data.form.ratingLabel3;
    return data.form.ratingLabel4;
  };

  // =========================================================================
  // WORKSHEET 1: Consolidated Results (Grouped by School Classification)
  // =========================================================================
  const wsConsolidated = workbook.addWorksheet('Consolidated Results', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }],
  });

  const scopeLabel =
    data.scope.role === 'division' || data.scope.divisionName
      ? `Division Scope: ${data.scope.divisionName || 'Assigned Division'}`
      : 'All 13 Schools Divisions (Full Regional Scope)';

  // Title Banner
  wsConsolidated.mergeCells('A1:J1');
  const titleCell = wsConsolidated.getCell('A1');
  titleCell.value = `${data.form.title} — Consolidated School Results`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: DEPED_BLUE } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsConsolidated.getRow(1).height = 28;

  wsConsolidated.mergeCells('A2:J2');
  const subtitleCell = wsConsolidated.getCell('A2');
  subtitleCell.value = `School Year: ${data.schoolYearName} | ${scopeLabel} | Total Schools: ${data.schools.length}`;
  subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsConsolidated.getRow(2).height = 20;

  wsConsolidated.addRow([]); // Blank row 3

  // Table Column Headers (Row 4)
  const colHeaders: string[] = [
    'School ID',
    'School Name',
    'Division',
    'District',
    'Classification',
    'School Head',
    'Assessment Status',
    'Answered',
    'Total Active Indicators',
    'Overall Rating',
    'SBM Level',
  ];

  // Dynamic Section Columns
  for (const sec of sections) {
    colHeaders.push(`${sec.title} (Avg)`);
  }

  colHeaders.push('Submitted At', 'Submitted By');

  wsConsolidated.addRow(colHeaders);
  const headerRow = wsConsolidated.getRow(4);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: DEPED_BLUE } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: DEPED_BLUE } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });

  // Group Schools by Classification
  const schoolsByClassification = new Map<string, SchoolExportData[]>();
  for (const s of data.schools) {
    const classification = s.classification || 'Unclassified';
    if (!schoolsByClassification.has(classification)) {
      schoolsByClassification.set(classification, []);
    }
    schoolsByClassification.get(classification)!.push(s);
  }

  // Sort classifications alphabetically or naturally
  const sortedClassifications = Array.from(schoolsByClassification.keys()).sort();

  for (const classification of sortedClassifications) {
    const classSchools = schoolsByClassification.get(classification)!;
    // Sort schools inside classification by Division then School Name
    classSchools.sort((a, b) => {
      const divCompare = a.divisionName.localeCompare(b.divisionName);
      if (divCompare !== 0) return divCompare;
      return a.schoolName.localeCompare(b.schoolName);
    });

    // Group Header Banner Row
    const groupHeaderRow = wsConsolidated.addRow([
      `Classification: ${classification.toUpperCase()} (${classSchools.length} Schools)`,
    ]);
    groupHeaderRow.height = 24;
    const groupRowIdx = groupHeaderRow.number;
    wsConsolidated.mergeCells(groupRowIdx, 1, groupRowIdx, colHeaders.length);
    const mergedGroupCell = wsConsolidated.getCell(groupRowIdx, 1);
    mergedGroupCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: GROUP_HEADER_FILL },
    };
    mergedGroupCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: DEPED_BLUE } };
    mergedGroupCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    groupHeaderRow.eachCell((c) => (c.border = thinBorder));

    // Data rows for each school in this classification
    let classAnsweredSum = 0;
    let classOverallRatingSum = 0;
    let classRatedSchoolsCount = 0;
    const classSectionSums = new Map<number, { sum: number; count: number }>();
    for (const sec of sections) {
      classSectionSums.set(sec.id, { sum: 0, count: 0 });
    }

    for (const s of classSchools) {
      const ass = assMap.get(s.schoolDbId);
      const st = ass ? ass.status : 'Not started';
      const overallAvg = ass ? parseFloat(ass.calculatedAverage) : 0;

      let answered = 0;
      if (ass) {
        for (const ind of activeIndicators) {
          const r = respMap.get(`${ass.id}_${ind.id}`);
          if (r && r > 0) answered++;
        }
      }

      if (overallAvg > 0) {
        classOverallRatingSum += overallAvg;
        classRatedSchoolsCount++;
      }
      classAnsweredSum += answered;

      const interpretation = interpretScore(overallAvg);

      const rowValues: any[] = [
        s.schoolId,
        s.schoolName,
        s.divisionName,
        s.district,
        s.classification,
        s.schoolHead,
        st,
        answered,
        activeIndicators.length,
        overallAvg > 0 ? overallAvg.toFixed(2) : '0.00',
        interpretation,
      ];

      // Section Averages
      for (const sec of sections) {
        const secInds = activeIndicators.filter((i) => i.sectionId === sec.id);
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
          const secAvg = secAns > 0 ? secSum / secAns : 0;
          rowValues.push(secAvg > 0 ? secAvg.toFixed(2) : '0.00');

          if (secAvg > 0) {
            const current = classSectionSums.get(sec.id)!;
            current.sum += secAvg;
            current.count += 1;
          }
        }
      }

      // Submission metadata
      rowValues.push(
        ass?.submittedAt
          ? (typeof ass.submittedAt === 'string' ? ass.submittedAt : ass.submittedAt.toISOString()).split('T')[0]
          : 'N/A',
        ass?.submittedByName || 'N/A'
      );

      const addedRow = wsConsolidated.addRow(rowValues);
      addedRow.height = 20;
      addedRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Arial', size: 9 };
        if (colNumber === 1 || colNumber === 5 || (colNumber >= 7 && colNumber <= 11)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    }

    // Classification Subtotal / Summary Row
    const classAvgOverall =
      classRatedSchoolsCount > 0 ? (classOverallRatingSum / classRatedSchoolsCount).toFixed(2) : '0.00';
    const subtotalValues: any[] = [
      '',
      `Subtotal / Average for ${classification}`,
      '',
      '',
      classification,
      '',
      `${classSchools.length} Schools`,
      (classAnsweredSum / (classSchools.length || 1)).toFixed(1),
      activeIndicators.length,
      classAvgOverall,
      interpretScore(parseFloat(classAvgOverall)),
    ];

    for (const sec of sections) {
      const stats = classSectionSums.get(sec.id);
      const secAvg = stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(2) : '0.00';
      subtotalValues.push(secAvg);
    }
    subtotalValues.push('', '');

    const subtotalRow = wsConsolidated.addRow(subtotalValues);
    subtotalRow.height = 22;
    subtotalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE_FILL } };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: DEPED_BLUE } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    subtotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
  }

  // Adjust Column Widths for Consolidated Results
  wsConsolidated.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len, 45);
    });
    col.width = maxLen + 3;
  });

  // =========================================================================
  // WORKSHEET 2: Detailed Consolidated Ratings (Ratings for Each Indicator)
  // =========================================================================
  const wsDetailed = workbook.addWorksheet('Detailed Consolidated Ratings', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }],
  });

  // Title Banner
  wsDetailed.mergeCells('A1:J1');
  const dTitleCell = wsDetailed.getCell('A1');
  dTitleCell.value = `${data.form.title} — Detailed Consolidated Indicator Ratings`;
  dTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: DEPED_BLUE } };
  dTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsDetailed.getRow(1).height = 28;

  wsDetailed.mergeCells('A2:J2');
  const dSubtitleCell = wsDetailed.getCell('A2');
  dSubtitleCell.value = `School Year: ${data.schoolYearName} | ${scopeLabel} | Total Schools: ${data.schools.length} | Ratings per Indicator (Scale 1–4)`;
  dSubtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  dSubtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsDetailed.getRow(2).height = 20;

  // Row 3: Section/Dimension Grouping Row
  const detailedRow3Values: any[] = ['', '', '', '', '', ''];
  const detailedColHeaders: string[] = [
    'School ID',
    'School Name',
    'Division',
    'District',
    'Classification',
    'Assessment Status',
  ];

  // Track start and end columns for each section
  const sectionColSpans: { sectionId: number; title: string; startCol: number; endCol: number }[] = [];
  let currentCol = 7;

  for (const sec of sections) {
    const secInds = activeIndicators.filter((i) => i.sectionId === sec.id);
    if (secInds.length > 0) {
      const startCol = currentCol;
      for (const ind of secInds) {
        detailedRow3Values.push(sec.title);
        detailedColHeaders.push(ind.code);
        currentCol++;
      }
      sectionColSpans.push({
        sectionId: sec.id,
        title: sec.title,
        startCol,
        endCol: currentCol - 1,
      });
    }
  }

  // Summary Metrics Columns
  const summaryStartCol = currentCol;
  detailedRow3Values.push('Summary Metrics', 'Summary Metrics', 'Summary Metrics');
  detailedColHeaders.push('Answered', 'Overall Rating', 'SBM Level');
  const summaryEndCol = currentCol + 2;

  // Add Row 3 (Section Groupings)
  const dRow3 = wsDetailed.addRow(detailedRow3Values);
  dRow3.height = 22;
  dRow3.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_HEADER_FILL } };
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: DEPED_BLUE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // Merge Section Headers in Row 3
  for (const span of sectionColSpans) {
    if (span.startCol < span.endCol) {
      wsDetailed.mergeCells(3, span.startCol, 3, span.endCol);
    }
  }
  if (summaryStartCol < summaryEndCol) {
    wsDetailed.mergeCells(3, summaryStartCol, 3, summaryEndCol);
  }

  // Add Row 4 (Column Headers)
  const dRow4 = wsDetailed.addRow(detailedColHeaders);
  dRow4.height = 30;
  dRow4.eachCell((cell, colNum) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: DEPED_BLUE } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: DEPED_BLUE } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };

    // Attach indicator description as note if it is an indicator column
    if (colNum >= 7 && colNum < summaryStartCol) {
      const indIndex = colNum - 7;
      const ind = activeIndicators[indIndex];
      if (ind) {
        cell.note = `${ind.code}: ${ind.content}`;
      }
    }
  });

  // Overall sums across all schools for grand total indicator averages
  const overallIndSums = new Map<number, { sum: number; count: number }>();
  for (const ind of activeIndicators) {
    overallIndSums.set(ind.id, { sum: 0, count: 0 });
  }

  // Populate Data Rows Grouped by School Classification
  for (const classification of sortedClassifications) {
    const classSchools = schoolsByClassification.get(classification)!;

    // Group Header Banner Row
    const dGroupHeader = wsDetailed.addRow([
      `Classification: ${classification.toUpperCase()} (${classSchools.length} Schools)`,
    ]);
    dGroupHeader.height = 24;
    const dGroupRowIdx = dGroupHeader.number;
    wsDetailed.mergeCells(dGroupRowIdx, 1, dGroupRowIdx, detailedColHeaders.length);
    const dMergedGroupCell = wsDetailed.getCell(dGroupRowIdx, 1);
    dMergedGroupCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: GROUP_HEADER_FILL },
    };
    dMergedGroupCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: DEPED_BLUE } };
    dMergedGroupCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    dGroupHeader.eachCell((c) => (c.border = thinBorder));

    // Stats for classification subtotal row
    let dClassOverallSum = 0;
    let dClassRatedCount = 0;
    let dClassAnsweredSum = 0;
    const classIndSums = new Map<number, { sum: number; count: number }>();
    for (const ind of activeIndicators) {
      classIndSums.set(ind.id, { sum: 0, count: 0 });
    }

    // School Rows
    for (const s of classSchools) {
      const ass = assMap.get(s.schoolDbId);
      const st = ass ? ass.status : 'Not started';
      const overallAvg = ass ? parseFloat(ass.calculatedAverage) : 0;

      if (overallAvg > 0) {
        dClassOverallSum += overallAvg;
        dClassRatedCount++;
      }

      let answered = 0;
      const schoolRowValues: any[] = [
        s.schoolId,
        s.schoolName,
        s.divisionName,
        s.district,
        s.classification,
        st,
      ];

      // Ratings for each indicator
      for (const ind of activeIndicators) {
        const rating = ass ? (respMap.get(`${ass.id}_${ind.id}`) || 0) : 0;
        if (rating > 0) {
          answered++;
          schoolRowValues.push(rating);

          // Tally stats
          const cStats = classIndSums.get(ind.id)!;
          cStats.sum += rating;
          cStats.count += 1;

          const oStats = overallIndSums.get(ind.id)!;
          oStats.sum += rating;
          oStats.count += 1;
        } else {
          schoolRowValues.push('-');
        }
      }

      dClassAnsweredSum += answered;

      // Summary columns
      schoolRowValues.push(
        answered,
        overallAvg > 0 ? overallAvg.toFixed(2) : '0.00',
        interpretScore(overallAvg)
      );

      const addedSchoolRow = wsDetailed.addRow(schoolRowValues);
      addedSchoolRow.height = 20;
      addedSchoolRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Arial', size: 9 };
        if (colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber >= 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    }

    // Classification Subtotal / Average Row
    const classAvgOverall =
      dClassRatedCount > 0 ? (dClassOverallSum / dClassRatedCount).toFixed(2) : '0.00';
    const dSubtotalValues: any[] = [
      '',
      `Average for ${classification}`,
      '',
      '',
      classification,
      `${classSchools.length} Schools`,
    ];

    for (const ind of activeIndicators) {
      const stats = classIndSums.get(ind.id);
      const indAvg = stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(2) : '-';
      dSubtotalValues.push(indAvg);
    }

    dSubtotalValues.push(
      (dClassAnsweredSum / (classSchools.length || 1)).toFixed(1),
      classAvgOverall,
      interpretScore(parseFloat(classAvgOverall))
    );

    const dSubtotalRow = wsDetailed.addRow(dSubtotalValues);
    dSubtotalRow.height = 22;
    dSubtotalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE_FILL } };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: DEPED_BLUE } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    dSubtotalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
  }

  // Grand Summary / Overall Average Row across all schools
  const grandIndRowValues: any[] = [
    '',
    'Overall Average per Indicator (All Schools)',
    '',
    '',
    'ALL',
    `${data.schools.length} Schools`,
  ];

  for (const ind of activeIndicators) {
    const stats = overallIndSums.get(ind.id);
    const indAvg = stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(2) : '-';
    grandIndRowValues.push(indAvg);
  }

  // Regional overall average
  let totalOverallSum = 0;
  let totalRatedSchools = 0;
  for (const s of data.schools) {
    const ass = assMap.get(s.schoolDbId);
    const avg = ass ? parseFloat(ass.calculatedAverage) : 0;
    if (avg > 0) {
      totalOverallSum += avg;
      totalRatedSchools++;
    }
  }
  const grandOverallAvg = totalRatedSchools > 0 ? (totalOverallSum / totalRatedSchools).toFixed(2) : '0.00';
  grandIndRowValues.push(
    activeIndicators.length,
    grandOverallAvg,
    interpretScore(parseFloat(grandOverallAvg))
  );

  const grandRow = wsDetailed.addRow(grandIndRowValues);
  grandRow.height = 24;
  grandRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: DEPED_BLUE } };
    cell.border = {
      top: { style: 'medium', color: { argb: DEPED_BLUE } },
      bottom: { style: 'double', color: { argb: DEPED_BLUE } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  grandRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

  // Adjust Column Widths for Detailed Consolidated Ratings
  wsDetailed.columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    if (colNumber === 1) col.width = 14; // School ID
    else if (colNumber === 2) col.width = 38; // School Name
    else if (colNumber === 3) col.width = 20; // Division
    else if (colNumber === 4) col.width = 20; // District
    else if (colNumber === 5) col.width = 18; // Classification
    else if (colNumber === 6) col.width = 16; // Status
    else if (colNumber >= 7 && colNumber < summaryStartCol) {
      col.width = 10; // Indicator Columns (compact and readable)
    } else if (colNumber === summaryStartCol) col.width = 12; // Answered
    else if (colNumber === summaryStartCol + 1) col.width = 14; // Overall Rating
    else if (colNumber === summaryStartCol + 2) col.width = 18; // SBM Level
    else col.width = 14;
  });

  // =========================================================================
  // WORKSHEET 3: Indicator Summary (Excludes Inactive Indicators)
  // =========================================================================
  const wsIndicators = workbook.addWorksheet('Indicator Summary', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 3 }],
  });

  // Title Banner
  wsIndicators.mergeCells('A1:I1');
  const indTitleCell = wsIndicators.getCell('A1');
  indTitleCell.value = `${data.form.title} — Indicator Summary & Item Analysis`;
  indTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: DEPED_BLUE } };
  indTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsIndicators.getRow(1).height = 28;

  wsIndicators.mergeCells('A2:I2');
  const indSubtitleCell = wsIndicators.getCell('A2');
  indSubtitleCell.value = `School Year: ${data.schoolYearName} | Active Indicators: ${activeIndicators.length} | Display Order Respected | Inactive Excluded`;
  indSubtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  indSubtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsIndicators.getRow(2).height = 20;

  wsIndicators.addRow([]); // Blank row 3

  const indHeaders = [
    'Section / Dimension',
    'Order',
    'Indicator Code',
    'Indicator Description (Configured Wording)',
    `${data.form.ratingLabel1} (Count)`,
    `${data.form.ratingLabel2} (Count)`,
    `${data.form.ratingLabel3} (Count)`,
    `${data.form.ratingLabel4} (Count)`,
    'Total Answered',
    'Mean Rating',
    'Performance Interpretation',
  ];

  wsIndicators.addRow(indHeaders);
  const indHeaderRow = wsIndicators.getRow(4);
  indHeaderRow.height = 32;
  indHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Iterate over active indicators strictly in display order
  for (const ind of activeIndicators) {
    const sec = sections.find((s) => s.id === ind.sectionId);
    let count1 = 0;
    let count2 = 0;
    let count3 = 0;
    let count4 = 0;
    let sumRating = 0;
    let ratedTotal = 0;

    for (const s of data.schools) {
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

    const mean = ratedTotal > 0 ? sumRating / ratedTotal : 0;
    const meanRatingStr = mean > 0 ? mean.toFixed(2) : '0.00';
    const interpretation = interpretScore(mean);

    const indRow = wsIndicators.addRow([
      sec?.title || 'General',
      ind.orderIndex,
      ind.code,
      ind.content, // Edited wording
      count1,
      count2,
      count3,
      count4,
      ratedTotal,
      meanRatingStr,
      interpretation,
    ]);
    indRow.height = 22;
    indRow.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9 };
      if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else if (colNumber >= 5 && colNumber <= 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  // Auto-fit indicators sheet columns
  wsIndicators.columns.forEach((col, idx) => {
    if (idx === 3) {
      col.width = 60; // Wide description column
    } else {
      let maxLen = 14;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 40);
      });
      col.width = maxLen + 3;
    }
  });

  // =========================================================================
  // WORKSHEET 3: Export Information (Full Audit Manifest)
  // =========================================================================
  const wsInfo = workbook.addWorksheet('Export Information');
  wsInfo.mergeCells('A1:B1');
  const infoTitle = wsInfo.getCell('A1');
  infoTitle.value = 'Project SBM Online — Consolidated Export Manifest';
  infoTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: DEPED_BLUE } };
  wsInfo.getRow(1).height = 28;

  wsInfo.addRow([]); // Row 2

  const submittedCount = data.schools.filter((s) => assMap.get(s.schoolDbId)?.status === 'Submitted').length;
  const draftCount = data.schools.filter((s) => assMap.get(s.schoolDbId)?.status === 'Draft').length;
  const notStartedCount = data.schools.filter(
    (s) => !assMap.get(s.schoolDbId) || assMap.get(s.schoolDbId)?.status === 'Not started'
  ).length;

  const inactiveCount = (data.allIndicatorsIncludingInactive || []).filter((i) => !i.isActive).length;

  // Breakdown by classification string
  const classBreakdown = sortedClassifications
    .map((c) => `${c}: ${schoolsByClassification.get(c)?.length || 0}`)
    .join(', ');

  const infoTable: [string, string | number][] = [
    ['Form Title', data.form.title],
    ['School Year', data.schoolYearName],
    ['Export Scope', scopeLabel],
    ['Exported By', `${data.exporter.fullName} (${data.exporter.username})`],
    ['User Role Authority', data.exporter.role.toUpperCase()],
    ['Generated Timestamp', new Date().toISOString()],
    ['Total Schools in Scope', data.schools.length],
    ['Schools by Classification', classBreakdown],
    ['Submitted Assessments', `${submittedCount} (${((submittedCount / (data.schools.length || 1)) * 100).toFixed(1)}%)`],
    ['Draft Assessments', `${draftCount} (${((draftCount / (data.schools.length || 1)) * 100).toFixed(1)}%)`],
    ['Not Started Assessments', `${notStartedCount} (${((notStartedCount / (data.schools.length || 1)) * 100).toFixed(1)}%)`],
    ['Total Configured Dimensions/Sections', sections.length],
    ['Total Active Indicators Included', activeIndicators.length],
    ['Inactive Indicators Excluded', inactiveCount],
    ['Rating Scale Level 1', data.form.ratingLabel1],
    ['Rating Scale Level 2', data.form.ratingLabel2],
    ['Rating Scale Level 3', data.form.ratingLabel3],
    ['Rating Scale Level 4', data.form.ratingLabel4],
    ['Form Instructions', data.form.instructions],
    ['Regional Authority', 'Department of Education — Regional Office VIII (Eastern Visayas)'],
  ];

  for (const [prop, val] of infoTable) {
    const row = wsInfo.addRow([prop, val]);
    row.height = 22;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    row.getCell(1).border = thinBorder;
    row.getCell(2).font = { name: 'Arial', size: 10 };
    row.getCell(2).border = thinBorder;
  }
  wsInfo.getColumn(1).width = 32;
  wsInfo.getColumn(2).width = 80;

  // =========================================================================
  // WORKSHEET 4: Form Snapshot (Snapshot of Form & Indicator Wording at Export Time)
  // =========================================================================
  const wsSnapshot = workbook.addWorksheet('Form Snapshot');
  wsSnapshot.mergeCells('A1:D1');
  const snapTitle = wsSnapshot.getCell('A1');
  snapTitle.value = `Assessment Form Snapshot for School Year: ${data.schoolYearName}`;
  snapTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: DEPED_BLUE } };
  wsSnapshot.getRow(1).height = 28;

  wsSnapshot.addRow([]);

  const snapMetadata: [string, string][] = [
    ['Form Title', data.form.title],
    ['Form Status', data.form.status.toUpperCase()],
    ['School Year Reference', data.schoolYearName],
    ['Allow Edit After Submission', data.form.allowEditAfterSubmission ? 'YES' : 'NO'],
    ['Require All Indicators', data.form.requireAllIndicators ? 'YES' : 'NO'],
    ['Require Global Remarks', data.form.requireGlobalRemarks ? 'YES' : 'NO'],
    ['Require Indicator Remarks', data.form.requireIndicatorRemarks ? 'YES' : 'NO'],
    ['Rating Level 1 Label', data.form.ratingLabel1],
    ['Rating Level 2 Label', data.form.ratingLabel2],
    ['Rating Level 3 Label', data.form.ratingLabel3],
    ['Rating Level 4 Label', data.form.ratingLabel4],
    ['Instructions', data.form.instructions],
  ];

  for (const [label, value] of snapMetadata) {
    const row = wsSnapshot.addRow([label, value]);
    row.height = 20;
    row.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_ROW_FILL } };
    row.getCell(1).border = thinBorder;
    row.getCell(2).font = { name: 'Arial', size: 9 };
    row.getCell(2).border = thinBorder;
  }

  wsSnapshot.addRow([]);
  wsSnapshot.addRow(['Form Section & Indicator Hierarchy (Active & Inactive Snapshot):']);
  const hierarchyHeaderIdx = wsSnapshot.rowCount;
  wsSnapshot.getRow(hierarchyHeaderIdx).font = { name: 'Arial', size: 11, bold: true, color: { argb: DEPED_BLUE } };

  // Hierarchy table
  const snapTableHeaders = ['Section / Dimension', 'Display Order', 'Indicator Code', 'Configured Indicator Wording', 'Status'];
  wsSnapshot.addRow(snapTableHeaders);
  const snapHeaderRow = wsSnapshot.getRow(wsSnapshot.rowCount);
  snapHeaderRow.height = 26;
  snapHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // Combine indicators (active first, then inactive with indicator status)
  const allIndicators = data.allIndicatorsIncludingInactive || data.indicators;

  for (const sec of sections) {
    // Section header banner in snapshot
    const secRow = wsSnapshot.addRow([`Dimension ${sec.orderIndex}: ${sec.title}`, sec.orderIndex, '', '', '']);
    secRow.height = 22;
    secRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE_FILL } };
      c.font = { name: 'Arial', size: 9, bold: true, color: { argb: DEPED_BLUE } };
      c.border = thinBorder;
    });

    const secInds = allIndicators
      .filter((i) => i.sectionId === sec.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    for (const ind of secInds) {
      const indRow = wsSnapshot.addRow([
        '',
        ind.orderIndex,
        ind.code,
        ind.content, // Edited wording
        ind.isActive ? 'ACTIVE' : 'INACTIVE (EXCLUDED FROM SCORING)',
      ]);
      indRow.height = 20;
      indRow.eachCell((cell, colNum) => {
        cell.border = thinBorder;
        cell.font = {
          name: 'Arial',
          size: 9,
          color: ind.isActive ? { argb: 'FF000000' } : { argb: 'FF94A3B8' },
        };
        if (colNum === 5 && !ind.isActive) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
      });
    }
  }

  wsSnapshot.getColumn(1).width = 30;
  wsSnapshot.getColumn(2).width = 14;
  wsSnapshot.getColumn(3).width = 16;
  wsSnapshot.getColumn(4).width = 75;
  wsSnapshot.getColumn(5).width = 25;

  return workbook;
}

/**
 * Builds the Excel report, writes it safely to a temporary file in os.tmpdir(),
 * and returns the path, filename, and cleanup handler.
 */
export async function exportConsolidatedExcelReport(
  data: ConsolidatedExportInput
): Promise<{ tempFilePath: string; filename: string; cleanup: () => Promise<void> }> {
  const workbook = await buildConsolidatedExcelWorkbook(data);

  // Generate unique temporary file outside public web directories
  const tempDir = os.tmpdir();
  const randomId = crypto.randomUUID();
  const tempFilename = `sbm_export_${randomId}.xlsx`;
  const tempFilePath = path.join(tempDir, tempFilename);

  // Ensure file is written safely
  await workbook.xlsx.writeFile(tempFilePath);

  // Friendly, descriptive filename including School Year and Scope
  const cleanSy = data.schoolYearName.replace(/[^a-zA-Z0-9_-]/g, '_');
  let scopeTag = 'All_Divisions';
  if (data.scope.role === 'division' || data.scope.divisionName) {
    scopeTag = `Division_${(data.scope.divisionName || 'Assigned').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const clientFilename = `SBM_Consolidated_Report_SY_${cleanSy}_${scopeTag}_${timestamp}.xlsx`;

  const cleanup = async () => {
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
      }
    } catch (err) {
      console.error('[ExportService] Failed to unlink temp file:', tempFilePath, err);
    }
  };

  return { tempFilePath, filename: clientFilename, cleanup };
}
