import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { db } from '../../db/index.ts';
import {
  divisions,
  schools,
  users,
  assessments,
  assessmentResponses,
} from '../../db/schema.ts';
import { eq, sql, inArray } from 'drizzle-orm';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
  logAudit,
  invalidateUserSessions,
} from '../auth.ts';
import {
  validateUploadedAsset,
  generateUniqueAssetFilename,
  saveAssetToDisk,
  deleteReplacedAsset,
} from '../assetService.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /api/divisions/accounts - Regional Only: List all Division accounts with admin info & counts
router.get('/accounts', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allDivisions = await db.select().from(divisions).orderBy(divisions.divisionName);

    const result = await Promise.all(
      allDivisions.map(async (div) => {
        // Find corresponding division admin user
        const userList = await db
          .select()
          .from(users)
          .where(sql`${users.divisionId} = ${div.id} AND ${users.role} = 'division'`);
        const adminUser = userList[0] || null;

        // Count schools under this division
        const divSchools = await db.select().from(schools).where(eq(schools.divisionId, div.id));
        const schoolCount = divSchools.length;
        const schoolIds = divSchools.map((s) => s.id);

        let submittedCount = 0;
        let draftCount = 0;
        let notStartedCount = 0;
        let avgRating = '0.00';

        if (schoolIds.length > 0) {
          const assList = await db
            .select()
            .from(assessments)
            .where(inArray(assessments.schoolId, schoolIds));

          const assessedSchoolIds = new Set(assList.map((a) => a.schoolId));
          notStartedCount = schoolCount - assessedSchoolIds.size;

          let ratingSum = 0;
          let ratedAssessments = 0;

          for (const a of assList) {
            if (a.status === 'Submitted') {
              submittedCount++;
              const avg = parseFloat(a.calculatedAverage || '0');
              if (avg > 0) {
                ratingSum += avg;
                ratedAssessments++;
              }
            } else if (a.status === 'Draft') {
              draftCount++;
            }
          }

          if (ratedAssessments > 0) {
            avgRating = (ratingSum / ratedAssessments).toFixed(2);
          }
        }

        return {
          id: div.id,
          divisionCode: div.divisionCode,
          divisionName: div.divisionName,
          logo: div.logo || adminUser?.logo || null,
          createdAt: div.createdAt,
          updatedAt: div.updatedAt,
          userId: adminUser?.id || null,
          username: adminUser?.username || null,
          adminName: adminUser?.fullName || 'Unassigned',
          isActive: adminUser ? adminUser.isActive : true,
          schoolCount,
          submittedCount,
          draftCount,
          notStartedCount,
          averageRating: avgRating,
        };
      })
    );

    return res.json(result);
  } catch (err: any) {
    console.error('Fetch division accounts error:', err);
    return res.status(500).json({ error: 'Failed to fetch division accounts.' });
  }
});

// POST /api/divisions/accounts - Regional Only: Create a new Division and its administrator account
router.post('/accounts', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { divisionName, divisionCode, adminName, username, password, isActive = true, logo } = req.body;

    if (!divisionName || !divisionName.trim()) {
      return res.status(400).json({ error: 'Division name is required.' });
    }
    if (!adminName || !adminName.trim()) {
      return res.status(400).json({ error: 'Administrator name is required.' });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password is required and must be at least 8 characters long.' });
    }

    const cleanDivName = divisionName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanAdminName = adminName.trim();

    // 1. Uniqueness check for divisionName
    const existingDiv = await db
      .select()
      .from(divisions)
      .where(sql`LOWER(${divisions.divisionName}) = LOWER(${cleanDivName})`);
    if (existingDiv.length > 0) {
      return res.status(400).json({ error: `A division with the name "${cleanDivName}" already exists.` });
    }

    // 2. Uniqueness check for username
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${cleanUsername})`);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
    }

    // Generate or validate division code
    let code = divisionCode ? divisionCode.trim().toUpperCase() : null;
    if (!code) {
      code = cleanDivName
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 8)
        .toUpperCase();
      // Ensure code is unique
      const existingCode = await db.select().from(divisions).where(eq(divisions.divisionCode, code));
      if (existingCode.length > 0) {
        code = `${code}_${Math.floor(100 + Math.random() * 900)}`;
      }
    } else {
      const existingCode = await db.select().from(divisions).where(eq(divisions.divisionCode, code));
      if (existingCode.length > 0) {
        return res.status(400).json({ error: `Division code "${code}" is already in use.` });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Database transaction to atomically create division & administrator account
    const result = await db.transaction(async (tx) => {
      const [newDivision] = await tx
        .insert(divisions)
        .values({
          divisionName: cleanDivName,
          divisionCode: code,
          logo: logo || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [newUser] = await tx
        .insert(users)
        .values({
          username: cleanUsername,
          passwordHash,
          role: 'division',
          fullName: cleanAdminName,
          divisionId: newDivision.id,
          logo: logo || null,
          isActive: Boolean(isActive),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { division: newDivision, user: newUser };
    });

    await logAudit(
      req,
      'CREATE_DIVISION_ACCOUNT',
      'divisions',
      result.division.id,
      `Division: ${cleanDivName}, Admin: ${cleanAdminName}, Username: ${cleanUsername}`
    );

    return res.status(201).json({
      message: `Division "${cleanDivName}" and administrator account created successfully.`,
      division: result.division,
      adminUser: {
        id: result.user.id,
        username: result.user.username,
        fullName: result.user.fullName,
        isActive: result.user.isActive,
      },
    });
  } catch (err: any) {
    console.error('Create division error:', err);
    return res.status(500).json({ error: 'Failed to create division account. All changes were rolled back.' });
  }
});

// PUT /api/divisions/accounts/:id - Regional Only: Edit Division account & administrator details
router.put('/accounts/:id', requireAuth, requireRole('regional'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const divId = parseInt(req.params.id, 10);
    if (isNaN(divId)) {
      return res.status(400).json({ error: 'Invalid division ID.' });
    }

    const { divisionName, adminName, username, isActive, logo, removeLogo } = req.body;

    const divList = await db.select().from(divisions).where(eq(divisions.id, divId));
    if (divList.length === 0) {
      return res.status(404).json({ error: 'Division not found.' });
    }
    const currentDiv = divList[0];

    const userList = await db
      .select()
      .from(users)
      .where(sql`${users.divisionId} = ${divId} AND ${users.role} = 'division'`);
    const currentUser = userList[0] || null;

    const cleanDivName = divisionName ? divisionName.trim() : currentDiv.divisionName;
    const cleanAdminName = adminName ? adminName.trim() : currentUser?.fullName || 'Administrator';
    const cleanUsername = username ? username.trim().toLowerCase() : currentUser?.username || '';

    // Uniqueness check for division name (excluding current division)
    if (cleanDivName.toLowerCase() !== currentDiv.divisionName.toLowerCase()) {
      const dupDiv = await db
        .select()
        .from(divisions)
        .where(sql`LOWER(${divisions.divisionName}) = LOWER(${cleanDivName}) AND ${divisions.id} != ${divId}`);
      if (dupDiv.length > 0) {
        return res.status(400).json({ error: `A division with the name "${cleanDivName}" already exists.` });
      }
    }

    // Uniqueness check for username (excluding current user)
    if (currentUser && cleanUsername && cleanUsername !== currentUser.username.toLowerCase()) {
      const dupUser = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${cleanUsername}) AND ${users.id} != ${currentUser.id}`);
      if (dupUser.length > 0) {
        return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
      }
    }

    let finalLogo = currentDiv.logo;
    if (removeLogo) {
      if (currentDiv.logo) {
        await deleteReplacedAsset(currentDiv.logo);
      }
      finalLogo = null;
    } else if (logo !== undefined) {
      if (currentDiv.logo && currentDiv.logo !== logo) {
        await deleteReplacedAsset(currentDiv.logo);
      }
      finalLogo = logo;
    }

    const newActiveState = isActive !== undefined ? Boolean(isActive) : currentUser ? currentUser.isActive : true;

    // Database transaction
    await db.transaction(async (tx) => {
      await tx
        .update(divisions)
        .set({
          divisionName: cleanDivName,
          logo: finalLogo,
          updatedAt: new Date(),
        })
        .where(eq(divisions.id, divId));

      if (currentUser) {
        await tx
          .update(users)
          .set({
            fullName: cleanAdminName,
            username: cleanUsername,
            isActive: newActiveState,
            logo: finalLogo,
            updatedAt: new Date(),
          })
          .where(eq(users.id, currentUser.id));
      } else {
        // Create user if not existing
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('DepEd1234!', salt);
        await tx.insert(users).values({
          username: cleanUsername,
          passwordHash,
          role: 'division',
          fullName: cleanAdminName,
          divisionId: divId,
          logo: finalLogo,
          isActive: newActiveState,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    // If deactivated, invalidate active sessions
    if (!newActiveState && currentUser) {
      invalidateUserSessions(currentUser.id);
    }

    await logAudit(
      req,
      'UPDATE_DIVISION_ACCOUNT',
      'divisions',
      divId,
      `Updated division "${cleanDivName}" (Admin: ${cleanAdminName}, Status: ${newActiveState ? 'Active' : 'Inactive'})`
    );

    return res.json({
      message: `Division account "${cleanDivName}" updated successfully.`,
    });
  } catch (err: any) {
    console.error('Update division error:', err);
    return res.status(500).json({ error: 'Failed to update division account.' });
  }
});

// POST /api/divisions/accounts/:id/reset-password - Regional Only: Reset Division Administrator's password
router.post(
  '/accounts/:id/reset-password',
  requireAuth,
  requireRole('regional'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const divId = parseInt(req.params.id, 10);
      if (isNaN(divId)) {
        return res.status(400).json({ error: 'Invalid division ID.' });
      }

      const { newPassword, confirmPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match.' });
      }

      const userList = await db
        .select()
        .from(users)
        .where(sql`${users.divisionId} = ${divId} AND ${users.role} = 'division'`);
      if (userList.length === 0) {
        return res.status(404).json({ error: 'Division administrator account not found.' });
      }
      const adminUser = userList[0];

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, adminUser.id));

      // Invalidate existing sessions for this user so they must log in with new password
      invalidateUserSessions(adminUser.id);

      await logAudit(
        req,
        'RESET_DIVISION_PASSWORD',
        'users',
        adminUser.id,
        `Password reset by Regional Admin for Division ${divId} (${adminUser.username})`
      );

      return res.json({
        message: `Password for Division Administrator (${adminUser.username}) reset successfully. Active sessions have been invalidated.`,
      });
    } catch (err: any) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Failed to reset administrator password.' });
    }
  }
);

// PATCH /api/divisions/accounts/:id/status - Regional Only: Activate or deactivate division account
router.patch(
  '/accounts/:id/status',
  requireAuth,
  requireRole('regional'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const divId = parseInt(req.params.id, 10);
      if (isNaN(divId)) {
        return res.status(400).json({ error: 'Invalid division ID.' });
      }

      const { isActive } = req.body;
      if (isActive === undefined) {
        return res.status(400).json({ error: 'isActive boolean status is required.' });
      }

      const userList = await db
        .select()
        .from(users)
        .where(sql`${users.divisionId} = ${divId} AND ${users.role} = 'division'`);
      if (userList.length === 0) {
        return res.status(404).json({ error: 'Division administrator account not found.' });
      }
      const adminUser = userList[0];

      const newStatus = Boolean(isActive);
      await db
        .update(users)
        .set({ isActive: newStatus, updatedAt: new Date() })
        .where(eq(users.id, adminUser.id));

      if (!newStatus) {
        invalidateUserSessions(adminUser.id);
      }

      await logAudit(
        req,
        newStatus ? 'ACTIVATE_DIVISION_ACCOUNT' : 'DEACTIVATE_DIVISION_ACCOUNT',
        'users',
        adminUser.id,
        `Division ${divId} account ${newStatus ? 'activated' : 'deactivated'}`
      );

      return res.json({
        message: `Division account ${newStatus ? 'activated' : 'deactivated'} successfully.`,
        isActive: newStatus,
      });
    } catch (err: any) {
      console.error('Toggle status error:', err);
      return res.status(500).json({ error: 'Failed to update division status.' });
    }
  }
);

// GET /api/divisions/accounts/:id/affected-records - Regional Only: Check related records before deletion
router.get(
  '/accounts/:id/affected-records',
  requireAuth,
  requireRole('regional'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const divId = parseInt(req.params.id, 10);
      if (isNaN(divId)) {
        return res.status(400).json({ error: 'Invalid division ID.' });
      }

      const divList = await db.select().from(divisions).where(eq(divisions.id, divId));
      if (divList.length === 0) {
        return res.status(404).json({ error: 'Division not found.' });
      }

      const divSchools = await db.select().from(schools).where(eq(schools.divisionId, divId));
      const schoolIds = divSchools.map((s) => s.id);

      let assessmentCount = 0;
      let responseCount = 0;

      if (schoolIds.length > 0) {
        const assList = await db
          .select()
          .from(assessments)
          .where(inArray(assessments.schoolId, schoolIds));
        assessmentCount = assList.length;

        const assIds = assList.map((a) => a.id);
        if (assIds.length > 0) {
          const respList = await db
            .select({ id: assessmentResponses.id })
            .from(assessmentResponses)
            .where(inArray(assessmentResponses.assessmentId, assIds));
          responseCount = respList.length;
        }
      }

      const schoolUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          sql`${users.divisionId} = ${divId} OR (${users.schoolId} IS NOT NULL AND ${users.schoolId} IN (${
            schoolIds.length > 0 ? sql.raw(schoolIds.join(',')) : -1
          }))`
        );

      return res.json({
        divisionName: divList[0].divisionName,
        affected: {
          schools: divSchools.length,
          schoolNames: divSchools.map((s) => `${s.schoolId} - ${s.schoolName}`),
          assessments: assessmentCount,
          responses: responseCount,
          users: schoolUsers.length,
        },
      });
    } catch (err: any) {
      console.error('Affected records error:', err);
      return res.status(500).json({ error: 'Failed to inspect related records.' });
    }
  }
);

// DELETE /api/divisions/accounts/:id - Regional Only: Delete Division account with related records in transaction
router.delete(
  '/accounts/:id',
  requireAuth,
  requireRole('regional'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const divId = parseInt(req.params.id, 10);
      if (isNaN(divId)) {
        return res.status(400).json({ error: 'Invalid division ID.' });
      }

      const { confirmName } = req.body;

      const divList = await db.select().from(divisions).where(eq(divisions.id, divId));
      if (divList.length === 0) {
        return res.status(404).json({ error: 'Division not found.' });
      }
      const division = divList[0];

      if (!confirmName || confirmName.trim() !== division.divisionName.trim()) {
        return res.status(400).json({
          error: `Please confirm deletion by typing the exact division name: "${division.divisionName}"`,
        });
      }

      const divSchools = await db.select().from(schools).where(eq(schools.divisionId, divId));
      const schoolIds = divSchools.map((s) => s.id);

      // Perform all deletions in a database transaction
      await db.transaction(async (tx) => {
        if (schoolIds.length > 0) {
          const assList = await tx
            .select({ id: assessments.id })
            .from(assessments)
            .where(inArray(assessments.schoolId, schoolIds));
          const assIds = assList.map((a) => a.id);

          if (assIds.length > 0) {
            await tx.delete(assessmentResponses).where(inArray(assessmentResponses.assessmentId, assIds));
            await tx.delete(assessments).where(inArray(assessments.id, assIds));
          }

          // Delete school user accounts
          await tx.delete(users).where(inArray(users.schoolId, schoolIds));
          // Delete schools
          await tx.delete(schools).where(inArray(schools.id, schoolIds));
        }

        // Delete division user account(s)
        await tx.delete(users).where(eq(users.divisionId, divId));

        // Delete division record
        await tx.delete(divisions).where(eq(divisions.id, divId));
      });

      // Clean up logo file if it exists
      if (division.logo) {
        await deleteReplacedAsset(division.logo);
      }

      await logAudit(
        req,
        'DELETE_DIVISION_ACCOUNT',
        'divisions',
        divId,
        `Deleted Division "${division.divisionName}" and ${divSchools.length} related schools.`
      );

      return res.json({
        message: `Division "${division.divisionName}" and all associated data have been permanently deleted.`,
        deletedSchoolsCount: divSchools.length,
      });
    } catch (err: any) {
      console.error('Delete division error:', err);
      return res.status(500).json({ error: 'Failed to delete division account. Database transaction was rolled back.' });
    }
  }
);

export default router;
