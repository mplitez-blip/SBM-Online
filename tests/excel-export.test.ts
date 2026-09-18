/**
 * Automated Test Suite: Dynamic Consolidated Excel Export using ExcelJS
 * 
 * Verifies all requirements:
 * 1. Edited next-year wording appears in next-year export.
 * 2. Previous-year wording remains unchanged.
 * 3. Inactive indicators are excluded from results and scoring.
 * 4. Division exports cannot include another Division (strict scoping).
 * 5. All 4 required worksheets exist:
 *    - Consolidated Results (Grouped by Classification)
 *    - Indicator Summary
 *    - Export Information
 *    - Form Snapshot
 * 6. Filename format includes School Year and scope.
 * 7. Temporary files are safely cleaned up and not exposed.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ExcelJS from 'exceljs';
import {
  buildConsolidatedExcelWorkbook,
  exportConsolidatedExcelReport,
  ConsolidatedExportInput,
} from '../src/server/services/exportService.ts';

let totalTests = 0;
let passedTests = 0;

async function test(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err: any) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// Sample Test Fixtures
const previousYearForm = {
  id: 1,
  schoolYearId: 101,
  title: 'DepEd SBM Assessment Tool (SY 2024-2025)',
  instructions: 'Assess schools based on standard SBM dimensions.',
  ratingLabel1: 'Level 1: Developing',
  ratingLabel2: 'Level 2: Maturing',
  ratingLabel3: 'Level 3: Advanced',
  ratingLabel4: 'Level 4: Exemplary',
  status: 'published',
  allowEditAfterSubmission: false,
  requireAllIndicators: true,
  requireGlobalRemarks: true,
  requireIndicatorRemarks: false,
};

const nextYearForm = {
  id: 2,
  schoolYearId: 102,
  title: 'DepEd SBM Assessment Tool (SY 2025-2026 Updated)',
  instructions: 'Updated SBM assessment instructions for the new school year.',
  ratingLabel1: 'Level 1: Developing',
  ratingLabel2: 'Level 2: Maturing',
  ratingLabel3: 'Level 3: Advanced',
  ratingLabel4: 'Level 4: Exemplary',
  status: 'published',
  allowEditAfterSubmission: false,
  requireAllIndicators: true,
  requireGlobalRemarks: true,
  requireIndicatorRemarks: false,
};

const sampleSections = [
  { id: 10, title: 'Leadership and Governance', orderIndex: 1 },
  { id: 11, title: 'Curriculum and Learning', orderIndex: 2 },
];

const prevYearIndicators = [
  {
    id: 1001,
    sectionId: 10,
    code: 'L.1',
    content: 'School leadership develops SIP with community involvement.',
    orderIndex: 1,
    isActive: true,
  },
  {
    id: 1002,
    sectionId: 11,
    code: 'C.1',
    content: 'Curriculum delivery is aligned with national DepEd standards.',
    orderIndex: 2,
    isActive: true,
  },
];

const nextYearIndicators = [
  {
    id: 2001,
    sectionId: 10,
    code: 'L.1',
    content: 'School leadership actively engages stakeholders in continuous SIP and AIP planning.', // EDITED WORDING
    orderIndex: 1,
    isActive: true,
  },
  {
    id: 2002,
    sectionId: 11,
    code: 'C.1',
    content: 'Curriculum delivery is aligned with national DepEd standards.',
    orderIndex: 2,
    isActive: true,
  },
  {
    id: 2003,
    sectionId: 10,
    code: 'L.OLD',
    content: 'Deprecated legacy indicator that has been deactivated.',
    orderIndex: 3,
    isActive: false, // INACTIVE INDICATOR
  },
];

const sampleSchools = [
  {
    schoolDbId: 1,
    schoolId: '123001',
    schoolName: 'Alangalang Central School',
    divisionId: 10,
    divisionName: 'Leyte',
    district: 'Alangalang I',
    classification: 'Elementary',
    schoolHead: 'Maria Santos',
  },
  {
    schoolDbId: 2,
    schoolId: '123002',
    schoolName: 'Alangalang National High School',
    divisionId: 10,
    divisionName: 'Leyte',
    district: 'Alangalang I',
    classification: 'Junior High School',
    schoolHead: 'Juan Dela Cruz',
  },
  {
    schoolDbId: 3,
    schoolId: '124001',
    schoolName: 'Maasin City National Comprehensive High School',
    divisionId: 20,
    divisionName: 'Southern Leyte',
    district: 'Maasin City District',
    classification: 'Senior High School',
    schoolHead: 'Roberto Lim',
  },
];

async function runExportTestSuite() {
  console.log('\n--- Running Dynamic Consolidated Excel Export Test Suite ---\n');

  // Test 1: Verify all 5 required worksheets are created
  await test('Rule: Export must contain all 5 required worksheets with correct titles including Detailed Consolidated Ratings', async () => {
    const input: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: nextYearIndicators,
      schools: sampleSchools,
      assessments: [],
      responses: [],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(input);
    const sheetNames = wb.worksheets.map((s) => s.name);

    assert.ok(sheetNames.includes('Consolidated Results'), 'Missing worksheet: Consolidated Results');
    assert.ok(sheetNames.includes('Detailed Consolidated Ratings'), 'Missing worksheet: Detailed Consolidated Ratings');
    assert.ok(sheetNames.includes('Indicator Summary'), 'Missing worksheet: Indicator Summary');
    assert.ok(sheetNames.includes('Export Information'), 'Missing worksheet: Export Information');
    assert.ok(sheetNames.includes('Form Snapshot'), 'Missing worksheet: Form Snapshot');
    assert.strictEqual(sheetNames.length, 5, 'Should contain exactly 5 worksheets');
  });

  // Test 2: Edited next-year wording appears in next-year export
  await test('Requirement: Edited next-year wording appears in next-year export', async () => {
    const nextYearInput: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: nextYearIndicators,
      schools: sampleSchools,
      assessments: [
        {
          id: 101,
          schoolId: 1,
          schoolYearId: 102,
          status: 'Submitted',
          calculatedAverage: '3.50',
          submittedAt: new Date(),
          submittedByName: 'Maria Santos',
        },
      ],
      responses: [
        { assessmentId: 101, indicatorId: 2001, rating: 4, remarks: 'Excellent stakeholder involvement' },
        { assessmentId: 101, indicatorId: 2002, rating: 3, remarks: 'Standard compliance' },
      ],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(nextYearInput);
    const indSheet = wb.getWorksheet('Indicator Summary');
    assert.ok(indSheet, 'Indicator Summary sheet not found');

    // Search for the edited indicator wording in Indicator Summary sheet
    let foundEditedWordingInSummary = false;
    indSheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && String(cell.value).includes('School leadership actively engages stakeholders in continuous SIP and AIP planning.')) {
          foundEditedWordingInSummary = true;
        }
      });
    });
    assert.ok(foundEditedWordingInSummary, 'Edited next-year wording was not found in Indicator Summary worksheet');

    // Also verify it appears in Form Snapshot
    const snapSheet = wb.getWorksheet('Form Snapshot');
    assert.ok(snapSheet, 'Form Snapshot sheet not found');
    let foundEditedWordingInSnapshot = false;
    snapSheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && String(cell.value).includes('School leadership actively engages stakeholders in continuous SIP and AIP planning.')) {
          foundEditedWordingInSnapshot = true;
        }
      });
    });
    assert.ok(foundEditedWordingInSnapshot, 'Edited next-year wording was not found in Form Snapshot worksheet');
  });

  // Test 3: Previous-year wording remains unchanged
  await test('Requirement: Previous-year wording remains unchanged in previous-year export', async () => {
    const prevYearInput: ConsolidatedExportInput = {
      schoolYearName: '2024-2025',
      form: previousYearForm,
      sections: sampleSections,
      indicators: prevYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: prevYearIndicators,
      schools: sampleSchools,
      assessments: [
        {
          id: 50,
          schoolId: 1,
          schoolYearId: 101,
          status: 'Submitted',
          calculatedAverage: '3.00',
        },
      ],
      responses: [
        { assessmentId: 50, indicatorId: 1001, rating: 3 },
      ],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(prevYearInput);
    const indSheet = wb.getWorksheet('Indicator Summary');
    assert.ok(indSheet, 'Indicator Summary sheet not found');

    let foundPrevYearWording = false;
    let foundNextYearWording = false;

    indSheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value || '');
        if (val.includes('School leadership develops SIP with community involvement.')) {
          foundPrevYearWording = true;
        }
        if (val.includes('continuous SIP and AIP planning')) {
          foundNextYearWording = true;
        }
      });
    });

    assert.ok(foundPrevYearWording, 'Previous-year wording must be present in previous-year export');
    assert.strictEqual(
      foundNextYearWording,
      false,
      'Next-year edited wording MUST NOT appear in previous-year export'
    );
  });

  // Test 4: Inactive indicators are excluded from results and summary
  await test('Requirement: Inactive indicators are excluded from Consolidated Results & Indicator Summary', async () => {
    const inputWithInactive: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive), // Only active: L.1 and C.1
      allIndicatorsIncludingInactive: nextYearIndicators, // Includes L.OLD (inactive)
      schools: sampleSchools,
      assessments: [],
      responses: [],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(inputWithInactive);

    // In Indicator Summary sheet:
    const indSheet = wb.getWorksheet('Indicator Summary')!;
    let foundInactiveInSummary = false;
    indSheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value || '');
        if (val.includes('L.OLD') || val.includes('Deprecated legacy indicator')) {
          foundInactiveInSummary = true;
        }
      });
    });
    assert.strictEqual(
      foundInactiveInSummary,
      false,
      'Inactive indicator L.OLD must be excluded from Indicator Summary'
    );

    // In Export Information sheet:
    const infoSheet = wb.getWorksheet('Export Information')!;
    let activeCountVal: any = null;
    let inactiveCountVal: any = null;
    infoSheet.eachRow((row) => {
      const prop = String(row.getCell(1).value || '');
      if (prop.includes('Total Active Indicators Included')) {
        activeCountVal = row.getCell(2).value;
      }
      if (prop.includes('Inactive Indicators Excluded')) {
        inactiveCountVal = row.getCell(2).value;
      }
    });
    assert.strictEqual(activeCountVal, 2, 'Should report exactly 2 active indicators');
    assert.strictEqual(inactiveCountVal, 1, 'Should report exactly 1 inactive indicator excluded');

    // In Form Snapshot sheet:
    const snapSheet = wb.getWorksheet('Form Snapshot')!;
    let inactiveStatusFlagged = false;
    snapSheet.eachRow((row) => {
      const code = String(row.getCell(3).value || '');
      const status = String(row.getCell(5).value || '');
      if (code === 'L.OLD' && status.includes('INACTIVE')) {
        inactiveStatusFlagged = true;
      }
    });
    assert.ok(inactiveStatusFlagged, 'Form Snapshot must show inactive indicator with INACTIVE flag');
  });

  // Test 5: Division exports cannot include another Division
  await test('Requirement: Division exports cannot include another Division (Strict Division Scoping)', async () => {
    // Only schools belonging to Division 10 (Leyte)
    const division10Schools = sampleSchools.filter((s) => s.divisionId === 10);

    const divisionExportInput: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: nextYearIndicators,
      schools: division10Schools, // Scoped to Division 10
      assessments: [],
      responses: [],
      scope: {
        role: 'division',
        divisionId: 10,
        divisionName: 'Leyte',
      },
      exporter: { fullName: 'Division Planning Officer', username: 'div_leyte', role: 'division' },
    };

    const wb = await buildConsolidatedExcelWorkbook(divisionExportInput);
    const consSheet = wb.getWorksheet('Consolidated Results')!;

    let foundDivision10School = false;
    let foundOtherDivisionSchool = false;

    consSheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value || '');
        if (val.includes('Alangalang Central School') || val.includes('Alangalang National High School')) {
          foundDivision10School = true;
        }
        if (val.includes('Maasin City') || val.includes('Southern Leyte')) {
          foundOtherDivisionSchool = true;
        }
      });
    });

    assert.ok(foundDivision10School, 'Division 10 schools must be present in Division 10 export');
    assert.strictEqual(
      foundOtherDivisionSchool,
      false,
      'Schools from Southern Leyte (Division 20) MUST NOT be present in Division 10 export'
    );

    // Verify scope banner in Consolidated Results
    const subtitle = String(consSheet.getCell('A2').value || '');
    assert.ok(subtitle.includes('Division Scope: Leyte'), 'Scope header must state Division Scope: Leyte');
    assert.strictEqual(
      subtitle.includes('Full Regional Scope'),
      false,
      'Division export must not show Full Regional Scope'
    );
  });

  // Test 6: Schools are grouped by classification in Consolidated Results
  await test('Requirement: Group Schools by Classification with classification banners', async () => {
    const input: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: nextYearIndicators,
      schools: sampleSchools, // Has Elementary, Junior High School, Senior High School
      assessments: [],
      responses: [],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(input);
    const consSheet = wb.getWorksheet('Consolidated Results')!;

    let foundElemHeader = false;
    let foundJhsHeader = false;
    let foundShsHeader = false;

    consSheet.eachRow((row) => {
      const val = String(row.getCell(1).value || '');
      if (val.includes('Classification: ELEMENTARY')) foundElemHeader = true;
      if (val.includes('Classification: JUNIOR HIGH SCHOOL')) foundJhsHeader = true;
      if (val.includes('Classification: SENIOR HIGH SCHOOL')) foundShsHeader = true;
    });

    assert.ok(foundElemHeader, 'Classification: ELEMENTARY header must exist');
    assert.ok(foundJhsHeader, 'Classification: JUNIOR HIGH SCHOOL header must exist');
    assert.ok(foundShsHeader, 'Classification: SENIOR HIGH SCHOOL header must exist');
  });

  // Test 7: Temporary file generation, secure storage, and cleanup
  await test('Requirement: Clean up generated temporary files and do not expose them', async () => {
    const input: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive),
      allIndicatorsIncludingInactive: nextYearIndicators,
      schools: sampleSchools,
      assessments: [],
      responses: [],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const { tempFilePath, filename, cleanup } = await exportConsolidatedExcelReport(input);

    // 1. Verify file was created in os.tmpdir() (not public web directory)
    assert.ok(tempFilePath.startsWith(os.tmpdir()), 'Temp file must be stored in os.tmpdir()');
    assert.ok(fs.existsSync(tempFilePath), 'Temporary file must exist on disk after generation');

    // 2. Verify filename contains School Year and scope
    assert.ok(filename.includes('SY_2025-2026'), 'Filename must include School Year');
    assert.ok(filename.includes('All_Divisions'), 'Filename must include scope');
    assert.ok(filename.endsWith('.xlsx'), 'Filename must have .xlsx extension');

    // 3. Verify file is a valid readable Excel workbook
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.readFile(tempFilePath);
    assert.strictEqual(readWb.worksheets.length, 5, 'Saved temp file must be a valid 5-sheet Excel workbook');

    // 4. Verify cleanup deletes the file
    await cleanup();
    assert.strictEqual(fs.existsSync(tempFilePath), false, 'Temporary file must be deleted after cleanup()');
  });

  // Test 8: Detailed Consolidated Ratings sheet includes rating for each active indicator
  await test('Requirement: Detailed Consolidated Ratings sheet includes per-indicator rating columns and values for each school, excluding inactive indicators', async () => {
    const input: ConsolidatedExportInput = {
      schoolYearName: '2025-2026',
      form: nextYearForm,
      sections: sampleSections,
      indicators: nextYearIndicators.filter((i) => i.isActive), // Active: L.1 (id: 2001), C.1 (id: 2002)
      allIndicatorsIncludingInactive: nextYearIndicators, // Includes L.OLD (id: 2003)
      schools: sampleSchools,
      assessments: [
        {
          id: 301,
          schoolId: 1, // Alangalang Central School
          schoolYearId: 102,
          status: 'Submitted',
          calculatedAverage: '3.50',
          submittedAt: new Date(),
          submittedByName: 'Maria Santos',
        },
        {
          id: 302,
          schoolId: 2, // Alangalang National High School
          schoolYearId: 102,
          status: 'Draft',
          calculatedAverage: '2.00',
        },
      ],
      responses: [
        { assessmentId: 301, indicatorId: 2001, rating: 4 },
        { assessmentId: 301, indicatorId: 2002, rating: 3 },
        { assessmentId: 302, indicatorId: 2001, rating: 2 },
      ],
      scope: { role: 'regional' },
      exporter: { fullName: 'Regional Administrator', username: 'admin_ro8', role: 'regional' },
    };

    const wb = await buildConsolidatedExcelWorkbook(input);
    const detailedSheet = wb.getWorksheet('Detailed Consolidated Ratings');
    assert.ok(detailedSheet, 'Detailed Consolidated Ratings worksheet must exist');

    // Verify row 4 headers contain L.1 and C.1, but NOT L.OLD
    const row4Headers: string[] = [];
    const headerRow = detailedSheet.getRow(4);
    headerRow.eachCell((cell) => {
      row4Headers.push(String(cell.value || ''));
    });

    assert.ok(row4Headers.includes('L.1'), 'Column header for indicator L.1 must exist');
    assert.ok(row4Headers.includes('C.1'), 'Column header for indicator C.1 must exist');
    assert.strictEqual(
      row4Headers.includes('L.OLD'),
      false,
      'Inactive indicator L.OLD must NOT appear as a column in Detailed Consolidated Ratings'
    );

    // Verify cell notes/comments were added on indicator columns
    const l1Cell = headerRow.getCell(row4Headers.indexOf('L.1') + 1);
    assert.ok(l1Cell.note, 'Header for L.1 should contain a note with the indicator wording');

    // Find row for Alangalang Central School (schoolId: 123001)
    let centralSchoolRow: ExcelJS.Row | null = null;
    let highSchoolRow: ExcelJS.Row | null = null;
    let unassessedSchoolRow: ExcelJS.Row | null = null;

    detailedSheet.eachRow((row) => {
      const sId = String(row.getCell(1).value || '');
      if (sId === '123001') centralSchoolRow = row;
      if (sId === '123002') highSchoolRow = row;
      if (sId === '124001') unassessedSchoolRow = row;
    });

    assert.ok(centralSchoolRow, 'Row for Alangalang Central School must exist');
    assert.ok(highSchoolRow, 'Row for Alangalang National High School must exist');
    assert.ok(unassessedSchoolRow, 'Row for Maasin City Comprehensive High School must exist');

    const cRow = centralSchoolRow as unknown as ExcelJS.Row;
    const hRow = highSchoolRow as unknown as ExcelJS.Row;
    const uRow = unassessedSchoolRow as unknown as ExcelJS.Row;

    // Verify ratings in Central School Row
    // Col 1: ID, Col 2: Name, Col 3: Div, Col 4: Dist, Col 5: Class, Col 6: Status
    // Col 7: L.1 (rating: 4), Col 8: C.1 (rating: 3)
    const l1ColIdx = row4Headers.indexOf('L.1') + 1;
    const c1ColIdx = row4Headers.indexOf('C.1') + 1;

    assert.strictEqual(cRow.getCell(l1ColIdx).value, 4, 'Central School L.1 rating must be 4');
    assert.strictEqual(cRow.getCell(c1ColIdx).value, 3, 'Central School C.1 rating must be 3');

    // Verify High School Row (L.1 rating: 2, C.1 unanswered -> '-')
    assert.strictEqual(hRow.getCell(l1ColIdx).value, 2, 'High School L.1 rating must be 2');
    assert.strictEqual(hRow.getCell(c1ColIdx).value, '-', 'High School C.1 unrated should be "-"');

    // Verify Unassessed School (both '-')
    assert.strictEqual(uRow.getCell(l1ColIdx).value, '-', 'Unassessed school L.1 should be "-"');
    assert.strictEqual(uRow.getCell(c1ColIdx).value, '-', 'Unassessed school C.1 should be "-"');

    // Verify grand average row at bottom
    let foundGrandAvg = false;
    detailedSheet.eachRow((row) => {
      const label = String(row.getCell(2).value || '');
      if (label.includes('Overall Average per Indicator')) {
        foundGrandAvg = true;
      }
    });
    assert.ok(foundGrandAvg, 'Grand indicator average row must be present');
  });

  console.log(`\nExcel Export Test Results: ${passedTests}/${totalTests} tests passed.\n`);
}

runExportTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
