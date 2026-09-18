import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.ts';
import {
  divisions,
  schools,
  schoolClassifications,
  users,
  assessments,
  assessmentResponses,
} from '../../db/schema.ts';
import { eq, sql, inArray } from 'drizzle-orm';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
  enforceDivisionScope,
  logAudit,
} from '../auth.ts';

const router = Router();

// GET /api/divisions - List all divisions (Regional & Division)
router.get('/divisions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'school') {
      return res.status(403).json({ error: 'Access denied: School accounts cannot access Division administration.' });
    }

    const list = await db.select().from(divisions).orderBy(divisions.divisionName);

    // If Division user, strictly scope to their assigned division
    let filtered = list;
    if (req.user!.role === 'division' && req.user!.divisionId) {
      filtered = list.filter((d) => d.id === req.user!.divisionId);
    }

    return res.json(filtered);
  } catch (err: any) {
    console.error('Fetch divisions error:', err);
    return res.status(500).json({ error: 'Failed to fetch divisions.' });
  }
});

// GET /api/divisions/:id - Get specific division
router.get('/divisions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid division ID' });
    }

    if (req.user!.role === 'school') {
      return res.status(403).json({ error: 'Access denied: School accounts cannot access Division administration.' });
    }

    if (req.user!.role === 'division' && req.user!.divisionId !== id) {
      return res.status(403).json({ error: 'Access denied: A Division administrator cannot access another Division.' });
    }

    const list = await db.select().from(divisions).where(eq(divisions.id, id));
    if (list.length === 0) {
      return res.status(404).json({ error: 'Division not found.' });
    }

    return res.json(list[0]);
  } catch (err: any) {
    console.error('Fetch division by ID error:', err);
    return res.status(500).json({ error: 'Failed to fetch division.' });
  }
});

// GET /api/classifications - List all classifications
router.get('/classifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.select().from(schoolClassifications).orderBy(schoolClassifications.name);
    return res.json(list);
  } catch (err: any) {
    console.error('Fetch classifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch classifications.' });
  }
});

// POST /api/classifications - Add classification (Regional only)
router.post('/classifications', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Classification name is required.' });
    }

    const cleanName = name.trim();
    const existing = await db
      .select()
      .from(schoolClassifications)
      .where(sql`LOWER(${schoolClassifications.name}) = LOWER(${cleanName})`);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Classification already exists.' });
    }

    const [created] = await db.insert(schoolClassifications).values({ name: cleanName, isActive: true }).returning();
    await logAudit(req, 'ADD_CLASSIFICATION', 'school_classifications', created.id, `Name: ${cleanName}`);

    return res.status(201).json({ message: 'Classification added successfully.', classification: created });
  } catch (err: any) {
    console.error('Add classification error:', err);
    return res.status(500).json({ error: 'Failed to add classification.' });
  }
});

// GET /api/schools - List schools scoped by role
router.get('/schools', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // School accounts can only access their own school
    if (req.user!.role === 'school') {
      const result = await db
        .select({
          id: schools.id,
          schoolId: schools.schoolId,
          schoolName: schools.schoolName,
          divisionId: schools.divisionId,
          divisionName: divisions.divisionName,
          district: schools.district,
          classification: schools.classification,
          schoolHead: schools.schoolHead,
          createdAt: schools.createdAt,
        })
        .from(schools)
        .innerJoin(divisions, eq(schools.divisionId, divisions.id))
        .where(eq(schools.id, req.user!.schoolId!));
      return res.json(result);
    }

    const divisionIdQuery = req.query.divisionId ? parseInt(String(req.query.divisionId), 10) : null;

    let targetDivisionId: number | null = divisionIdQuery;
    if (req.user!.role === 'division') {
      // Never trust divisionId supplied by the browser
      if (divisionIdQuery && divisionIdQuery !== req.user!.divisionId) {
        return res.status(403).json({ error: 'Access denied: A Division administrator cannot access another Division.' });
      }
      targetDivisionId = req.user!.divisionId;
    }

    let query = db
      .select({
        id: schools.id,
        schoolId: schools.schoolId,
        schoolName: schools.schoolName,
        divisionId: schools.divisionId,
        divisionName: divisions.divisionName,
        district: schools.district,
        classification: schools.classification,
        schoolHead: schools.schoolHead,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .innerJoin(divisions, eq(schools.divisionId, divisions.id));

    if (targetDivisionId) {
      query = query.where(eq(schools.divisionId, targetDivisionId)) as any;
    }

    const result = await query.orderBy(schools.schoolName);
    return res.json(result);
  } catch (err: any) {
    console.error('Fetch schools error:', err);
    return res.status(500).json({ error: 'Failed to fetch schools.' });
  }
});

// GET /api/schools/:id - Get specific school by ID with scope enforcement
router.get('/schools/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid school ID.' });
    }

    const targetSchool = await db
      .select({
        id: schools.id,
        schoolId: schools.schoolId,
        schoolName: schools.schoolName,
        divisionId: schools.divisionId,
        divisionName: divisions.divisionName,
        district: schools.district,
        classification: schools.classification,
        schoolHead: schools.schoolHead,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .innerJoin(divisions, eq(schools.divisionId, divisions.id))
      .where(eq(schools.id, id));

    if (targetSchool.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const sch = targetSchool[0];

    // School role check: cannot access another school
    if (req.user!.role === 'school' && req.user!.schoolId !== sch.id) {
      return res.status(403).json({ error: 'Access denied: A School cannot access another School.' });
    }

    // Division role check: cannot access school outside division
    if (req.user!.role === 'division' && req.user!.divisionId !== sch.divisionId) {
      return res.status(403).json({ error: 'Access denied: A Division administrator cannot access another Division.' });
    }

    return res.json(sch);
  } catch (err: any) {
    console.error('Fetch school by ID error:', err);
    return res.status(500).json({ error: 'Failed to fetch school.' });
  }
});

// POST /api/schools - Create school & user account (Division or Regional)
router.post('/schools', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolId, schoolName, divisionId, district, classification, schoolHead, password } = req.body;

    if (!schoolId || !schoolName || !district || !classification || !schoolHead) {
      return res.status(400).json({ error: 'All fields (School ID, Name, District, Classification, School Head) are required.' });
    }

    const cleanSchoolId = String(schoolId).trim();
    if (!/^\d{6}$/.test(cleanSchoolId)) {
      return res.status(400).json({ error: 'DepEd School ID must be a 6-digit numeric identifier.' });
    }

    // Never trust divisionId supplied by the browser for division users
    if (req.user!.role === 'division') {
      if (divisionId && parseInt(String(divisionId), 10) !== req.user!.divisionId) {
        return res.status(403).json({ error: 'Access denied: A Division administrator cannot create schools in another Division.' });
      }
    }

    const targetDivisionId = req.user!.role === 'division' ? req.user!.divisionId! : Number(divisionId);
    if (!targetDivisionId) {
      return res.status(400).json({ error: 'Division is required.' });
    }

    // Verify scope
    if (!enforceDivisionScope(req, res, targetDivisionId)) {
      return res.status(403).json({ error: 'Access denied: You are only authorized to manage schools in your assigned division.' });
    }

    // Check duplicate schoolId
    const existing = await db.select().from(schools).where(eq(schools.schoolId, cleanSchoolId));
    if (existing.length > 0) {
      return res.status(400).json({ error: `School ID '${cleanSchoolId}' already exists.` });
    }

    // Transaction to create school and its user account
    const initialPassword = password && password.length >= 8 ? password : `School@${cleanSchoolId}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(initialPassword, salt);

    const createdSchool = await db.transaction(async (tx) => {
      const [sch] = await tx
        .insert(schools)
        .values({
          schoolId: cleanSchoolId,
          schoolName: schoolName.trim(),
          divisionId: targetDivisionId,
          district: district.trim(),
          classification: classification.trim(),
          schoolHead: schoolHead.trim(),
        })
        .returning();

      // Create school user account
      await tx.insert(users).values({
        username: `school.${cleanSchoolId}`,
        email: `${cleanSchoolId}@deped.gov.ph`,
        passwordHash,
        role: 'school',
        divisionId: targetDivisionId,
        schoolId: sch.id,
        fullName: `${schoolHead.trim()} (${cleanSchoolId})`,
        isActive: true,
      });

      return sch;
    });

    await logAudit(req, 'CREATE_SCHOOL', 'schools', createdSchool.id, `ID: ${cleanSchoolId}`);
    return res.status(201).json({
      message: 'School and portal user account created successfully.',
      school: createdSchool,
      accountUsername: `school.${cleanSchoolId}`,
      initialPassword,
    });
  } catch (err: any) {
    console.error('Create school error:', err);
    return res.status(500).json({ error: 'Failed to create school.' });
  }
});

// POST /api/schools/import-csv - Batch import schools from CSV (Division or Regional)
router.post('/schools/import-csv', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvContent, divisionId } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'CSV content string is required.' });
    }

    // Never trust divisionId supplied by the browser for division users
    if (req.user!.role === 'division') {
      if (divisionId && parseInt(String(divisionId), 10) !== req.user!.divisionId) {
        return res.status(403).json({ error: 'Access denied: A Division administrator cannot import schools into another Division.' });
      }
    }

    const targetDivisionId = req.user!.role === 'division' ? req.user!.divisionId! : Number(divisionId);
    if (!targetDivisionId) {
      return res.status(400).json({ error: 'Target Division is required.' });
    }

    if (!enforceDivisionScope(req, res, targetDivisionId)) {
      return res.status(403).json({ error: 'Access denied: You are only authorized to import schools into your assigned division.' });
    }

    // Parse CSV lines: School ID, School Name, District, Classification, School Head
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must contain a header row and at least one data row.' });
    }

    // Skip header
    const dataRows = lines.slice(1);
    const results: { imported: number; skipped: number; errors: string[] } = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const salt = await bcrypt.genSalt(10);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      // Support standard comma separation with quotes
      const parts = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((p) => p.replace(/^"|"$/g, '').trim()) || row.split(',').map((p) => p.trim());

      if (parts.length < 5) {
        results.errors.push(`Row ${i + 2}: insufficient columns (Expected: SchoolID, SchoolName, District, Classification, SchoolHead).`);
        results.skipped++;
        continue;
      }

      const [sId, sName, sDistrict, sClass, sHead] = parts;

      if (!/^\d{6}$/.test(sId)) {
        results.errors.push(`Row ${i + 2}: School ID '${sId}' must be 6 digits.`);
        results.skipped++;
        continue;
      }

      // Check existing
      const existing = await db.select().from(schools).where(eq(schools.schoolId, sId));
      if (existing.length > 0) {
        results.errors.push(`Row ${i + 2}: School ID '${sId}' already exists.`);
        results.skipped++;
        continue;
      }

      const defaultPass = `School@${sId}`;
      const passHash = await bcrypt.hash(defaultPass, salt);

      await db.transaction(async (tx) => {
        const [newSch] = await tx
          .insert(schools)
          .values({
            schoolId: sId,
            schoolName: sName,
            divisionId: targetDivisionId,
            district: sDistrict,
            classification: sClass,
            schoolHead: sHead,
          })
          .returning();

        await tx.insert(users).values({
          username: `school.${sId}`,
          email: `${sId}@deped.gov.ph`,
          passwordHash: passHash,
          role: 'school',
          divisionId: targetDivisionId,
          schoolId: newSch.id,
          fullName: `${sHead} (${sId})`,
          isActive: true,
        });
      });

      results.imported++;
    }

    await logAudit(
      req,
      'CSV_IMPORT_SCHOOLS',
      'schools',
      null,
      `Imported: ${results.imported}, Skipped: ${results.skipped}`
    );

    return res.json({
      message: `Successfully imported ${results.imported} school(s). ${results.skipped} skipped.`,
      ...results,
    });
  } catch (err: any) {
    console.error('CSV import error:', err);
    return res.status(500).json({ error: 'Failed to process CSV import.' });
  }
});

// PUT /api/schools/:id - Edit School Name, District, Classification, School Head (Division or Regional)
router.put('/schools/:id', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetSchool = await db.select().from(schools).where(eq(schools.id, id));
    if (targetSchool.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const sch = targetSchool[0];
    if (req.user!.role === 'division' && sch.divisionId !== req.user!.divisionId) {
      return res.status(403).json({ error: "Access denied: A Division administrator cannot edit another Division's School." });
    }
    if (!enforceDivisionScope(req, res, sch.divisionId)) {
      return res.status(403).json({ error: "Access denied: You are only authorized to edit schools in your assigned division." });
    }

    const { schoolName, district, classification, schoolHead } = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (schoolName) updateData.schoolName = schoolName.trim();
    if (district) updateData.district = district.trim();
    if (classification) updateData.classification = classification.trim();
    if (schoolHead) updateData.schoolHead = schoolHead.trim();

    const [updated] = await db.update(schools).set(updateData).where(eq(schools.id, id)).returning();
    await logAudit(req, 'UPDATE_SCHOOL_DETAILS', 'schools', id, `Updated: ${updated.schoolName}`);

    return res.json({ message: 'School updated successfully.', school: updated });
  } catch (err: any) {
    console.error('Update school error:', err);
    return res.status(500).json({ error: 'Failed to update school.' });
  }
});

// POST /api/schools/:id/reset-password - Reset school account password (Division or Regional)
router.post('/schools/:id/reset-password', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const targetSchool = await db.select().from(schools).where(eq(schools.id, id));
    if (targetSchool.length === 0) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const sch = targetSchool[0];
    if (req.user!.role === 'division' && sch.divisionId !== req.user!.divisionId) {
      return res.status(403).json({ error: "Access denied: A Division administrator cannot edit another Division's School." });
    }
    if (!enforceDivisionScope(req, res, sch.divisionId)) {
      return res.status(403).json({ error: "Access denied: Unauthorized to reset password for schools outside your division." });
    }

    const newPassword = req.body.newPassword || `School@${sch.schoolId}`;
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.schoolId, sch.id));
    await logAudit(req, 'RESET_SCHOOL_PASSWORD', 'users', sch.id, `School: ${sch.schoolId}`);

    return res.json({
      message: `Password for school ${sch.schoolName} (${sch.schoolId}) was reset successfully.`,
      newPassword,
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// POST /api/schools/batch-delete - Batch-delete selected schools with confirmation (Division or Regional)
router.post('/schools/batch-delete', requireAuth, requireRole('regional', 'division'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { schoolIds, confirmText } = req.body;
    if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
      return res.status(400).json({ error: 'Array of school IDs to delete is required.' });
    }

    if (confirmText !== 'DELETE') {
      return res.status(400).json({ error: "Confirmation mismatch. You must type 'DELETE' to confirm batch deletion." });
    }

    // Verify all schools belong to allowed division if division role
    const schList = await db.select().from(schools).where(inArray(schools.id, schoolIds));
    if (req.user!.role === 'division') {
      const invalid = schList.some((s) => s.divisionId !== req.user!.divisionId);
      if (invalid) {
        return res.status(403).json({ error: 'Cannot delete schools outside your assigned division.' });
      }
    }

    // Transactionally delete
    await db.transaction(async (tx) => {
      // Find assessments
      const assList = await tx.select({ id: assessments.id }).from(assessments).where(inArray(assessments.schoolId, schoolIds));
      if (assList.length > 0) {
        const assIds = assList.map((a) => a.id);
        await tx.delete(assessmentResponses).where(inArray(assessmentResponses.assessmentId, assIds));
        await tx.delete(assessments).where(inArray(assessments.id, assIds));
      }
      await tx.delete(users).where(inArray(users.schoolId, schoolIds));
      await tx.delete(schools).where(inArray(schools.id, schoolIds));
    });

    await logAudit(req, 'BATCH_DELETE_SCHOOLS', 'schools', null, `Count: ${schoolIds.length}`);
    return res.json({ message: `Successfully deleted ${schoolIds.length} school(s) and their associated records.` });
  } catch (err: any) {
    console.error('Batch delete error:', err);
    return res.status(500).json({ error: 'Failed to batch delete schools.' });
  }
});

// GET /api/division-users - Regional only: Manage Division Office accounts
router.get('/division-users', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const divUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        divisionId: users.divisionId,
        divisionName: divisions.divisionName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(divisions, eq(users.divisionId, divisions.id))
      .where(eq(users.role, 'division'))
      .orderBy(divisions.divisionName);

    return res.json(divUsers);
  } catch (err: any) {
    console.error('Fetch division users error:', err);
    return res.status(500).json({ error: 'Failed to fetch division office accounts.' });
  }
});

// POST /api/division-users - Regional only: Create Division Office account
router.post('/division-users', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, fullName, email, divisionId, password } = req.body;
    if (!username || !fullName || !divisionId || !password) {
      return res.status(400).json({ error: 'Username, Full Name, Division, and Password are required.' });
    }

    const cleanUsername = username.trim();
    const existing = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${cleanUsername})`);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [created] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        fullName: fullName.trim(),
        email: email ? email.trim() : null,
        passwordHash,
        role: 'division',
        divisionId: Number(divisionId),
        isActive: true,
      })
      .returning();

    await logAudit(req, 'CREATE_DIVISION_USER', 'users', created.id, `Username: ${cleanUsername}`);
    return res.status(201).json({ message: 'Division account created successfully.', user: created });
  } catch (err: any) {
    console.error('Create division user error:', err);
    return res.status(500).json({ error: 'Failed to create division office account.' });
  }
});

// PUT /api/division-users/:id - Regional only: Update Division Office account
router.put('/division-users/:id', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { fullName, email, divisionId, isActive, resetPassword } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (fullName) updateData.fullName = fullName.trim();
    if (email !== undefined) updateData.email = email ? email.trim() : null;
    if (divisionId) updateData.divisionId = Number(divisionId);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (resetPassword && resetPassword.length >= 8) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(resetPassword, salt);
    }

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    await logAudit(req, 'UPDATE_DIVISION_USER', 'users', id);

    return res.json({ message: 'Division account updated successfully.', user: updated });
  } catch (err: any) {
    console.error('Update division user error:', err);
    return res.status(500).json({ error: 'Failed to update division user.' });
  }
});

export default router;
