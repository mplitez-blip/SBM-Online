import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { db } from '../../db/index.ts';
import { users, schools, divisions, schoolYears, schoolClassifications, systemCustomization } from '../../db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import {
  AuthenticatedRequest,
  generateToken,
  logAudit,
  requireAuth,
  registerSession,
  invalidateSession,
  invalidateUserSessions,
} from '../auth.ts';
import {
  validateUploadedAsset,
  generateUniqueAssetFilename,
  saveAssetToDisk,
  deleteReplacedAsset,
} from '../assetService.ts';

const router = Router();

// Track in-memory IP/Username login attempts for throttling
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkThrottling(key: string): { locked: boolean; remainingMinutes?: number } {
  const record = loginAttempts.get(key);
  if (!record) return { locked: false };
  if (record.lockedUntil > Date.now()) {
    const remainingMs = record.lockedUntil - Date.now();
    return { locked: true, remainingMinutes: Math.ceil(remainingMs / (1000 * 60)) };
  }
  if (record.lockedUntil <= Date.now() && record.count >= 5) {
    loginAttempts.delete(key);
  }
  return { locked: false };
}

function recordFailedAttempt(key: string) {
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
  }
  loginAttempts.set(key, record);
}

function resetFailedAttempts(key: string) {
  loginAttempts.delete(key);
}

// POST /api/auth/login - Requires accountType, username, and password
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountType, username, password } = req.body;

    if (!accountType) {
      return res.status(400).json({ error: 'Account type is required (regional, division, or school).' });
    }

    const normalizedAccountType = String(accountType).toLowerCase().trim();
    if (!['regional', 'division', 'school'].includes(normalizedAccountType)) {
      return res.status(400).json({ error: 'Invalid account type. Must be regional, division, or school.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const clientIp = req.ip || 'ip';
    const throttleKey = `${clientIp}_${String(username).toLowerCase().trim()}`;
    const throttleCheck = checkThrottling(throttleKey);
    if (throttleCheck.locked) {
      return res.status(429).json({
        error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${throttleCheck.remainingMinutes} minute(s).`,
      });
    }

    const trimmedUsername = String(username).trim();
    // Search user by username or schoolId if school
    const userList = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${trimmedUsername})`);

    let userRecord = userList[0];

    // If not found and input is numbers, also search if schoolId matches a school account
    if (!userRecord && /^\d+$/.test(trimmedUsername)) {
      const schoolMatch = await db.select().from(schools).where(eq(schools.schoolId, trimmedUsername));
      if (schoolMatch.length > 0) {
        const uList = await db.select().from(users).where(eq(users.schoolId, schoolMatch[0].id));
        if (uList.length > 0) {
          userRecord = uList[0];
        }
      }
    }

    if (!userRecord) {
      recordFailedAttempt(throttleKey);
      await logAudit(req, 'LOGIN_FAILED_NOT_FOUND', 'auth', null, `Username: ${trimmedUsername}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Verify account is active
    if (!userRecord.isActive) {
      await logAudit(req, 'LOGIN_REJECTED_INACTIVE', 'auth', userRecord.id, `User: ${userRecord.username}`);
      return res.status(403).json({ error: 'This account is inactive. Please contact your administrator.' });
    }

    // Verify account type matches user role
    if (userRecord.role !== normalizedAccountType) {
      recordFailedAttempt(throttleKey);
      await logAudit(
        req,
        'LOGIN_FAILED_ROLE_MISMATCH',
        'auth',
        userRecord.id,
        `Expected: ${userRecord.role}, Received: ${normalizedAccountType}`
      );
      return res.status(401).json({
        error: 'Account type mismatch. The selected account type does not match your assigned credentials.',
      });
    }

    const isMatch = await bcrypt.compare(password, userRecord.passwordHash);
    if (!isMatch) {
      recordFailedAttempt(throttleKey);
      await logAudit(req, 'LOGIN_FAILED_WRONG_PASSWORD', 'auth', userRecord.id, `User: ${userRecord.username}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    resetFailedAttempts(throttleKey);

    // Regenerate session: invalidates any prior sessions for this user and creates a new session ID
    const sessionId = registerSession(userRecord.id, userRecord.username, userRecord.role);

    const token = generateToken(
      {
        id: userRecord.id,
        username: userRecord.username,
        email: userRecord.email,
        role: userRecord.role as any,
        fullName: userRecord.fullName,
        divisionId: userRecord.divisionId,
        schoolId: userRecord.schoolId,
      },
      sessionId
    );

    // Set HTTP-only cookie
    res.cookie('sbm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    await logAudit(req, 'LOGIN_SUCCESS', 'auth', userRecord.id, `Role: ${userRecord.role}, Session: ${sessionId}`);

    return res.json({
      token,
      message: 'Login successful',
      user: {
        id: userRecord.id,
        username: userRecord.username,
        role: userRecord.role,
        fullName: userRecord.fullName,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch fresh user record
    const userRecords = await db.select().from(users).where(eq(users.id, req.user.id));
    const userRecord = userRecords[0] || null;

    let divisionData: any = null;
    let schoolData: any = null;

    if (req.user.divisionId) {
      const divRecords = await db.select().from(divisions).where(eq(divisions.id, req.user.divisionId));
      if (divRecords.length > 0) {
        divisionData = divRecords[0];
      }
    }

    if (req.user.schoolId) {
      const schRecords = await db.select().from(schools).where(eq(schools.id, req.user.schoolId));
      if (schRecords.length > 0) {
        schoolData = schRecords[0];
        if (!divisionData && schoolData.divisionId) {
          const divRecords = await db.select().from(divisions).where(eq(divisions.id, schoolData.divisionId));
          if (divRecords.length > 0) {
            divisionData = divRecords[0];
          }
        }
      }
    }

    // Fetch system customization for region logo
    const sysRecords = await db.select().from(systemCustomization).limit(1);
    const sysData = sysRecords[0] || null;

    // Resolve organization logo according to role
    let activeLogo: string | null = null;
    if (req.user.role === 'school') {
      activeLogo = schoolData?.logo || userRecord?.logo || null;
    } else if (req.user.role === 'division') {
      activeLogo = divisionData?.logo || userRecord?.logo || null;
    } else {
      activeLogo = sysData?.regionLogo || userRecord?.logo || null;
    }

    // Fetch active school year
    const activeSyList = await db.select().from(schoolYears).where(eq(schoolYears.isActive, true));
    const activeSchoolYear = activeSyList.length > 0 ? activeSyList[0] : null;

    return res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        fullName: userRecord?.fullName || req.user.fullName,
        logo: activeLogo,
        divisionId: req.user.divisionId,
        divisionName: divisionData?.divisionName || null,
        divisionCode: divisionData?.divisionCode || null,
        divisionLogo: divisionData?.logo || null,
        schoolId: req.user.schoolId,
        schoolDepedId: schoolData?.schoolId || null,
        schoolName: schoolData?.schoolName || null,
        schoolDistrict: schoolData?.district || null,
        schoolClassification: schoolData?.classification || null,
        schoolHead: schoolData?.schoolHead || null,
        schoolLogo: schoolData?.logo || null,
        regionLogo: sysData?.regionLogo || null,
        isActive: userRecord ? userRecord.isActive : true,
      },
      activeSchoolYear: activeSchoolYear
        ? {
            id: activeSchoolYear.id,
            name: activeSchoolYear.name,
            isActive: activeSchoolYear.isActive,
            isClosed: activeSchoolYear.isClosed,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error fetching profile:', err);
    return res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

// POST /api/auth/upload-logo - Validates, saves randomized file, and deletes previous logo
router.post('/upload-logo', requireAuth, upload.single('logo'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    let fileBuffer: Buffer | null = null;
    let originalName = 'logo.png';
    let replaceUrl = req.body?.replaceUrl;

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
    } else if (req.body?.base64Data) {
      const match = req.body.base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (match) {
        fileBuffer = Buffer.from(match[2], 'base64');
        originalName = req.body.fileName || 'logo.png';
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No logo image file was provided.' });
    }

    // Validate actual binary MIME type and dimensions (max 2MB as required)
    const metadata = validateUploadedAsset(fileBuffer, originalName, {
      category: 'logo',
      maxSizeBytes: 2 * 1024 * 1024,
    });

    const filename = generateUniqueAssetFilename('logo', metadata.extension);
    const url = await saveAssetToDisk(fileBuffer, filename);

    // Clean up replaced file ONLY after new file was written successfully
    if (replaceUrl && typeof replaceUrl === 'string' && replaceUrl.startsWith('/uploads/')) {
      await deleteReplacedAsset(replaceUrl);
    }

    return res.json({
      url,
      filename,
      metadata,
      message: 'Logo uploaded and validated successfully.',
    });
  } catch (err: any) {
    console.error('Logo upload error:', err);
    return res.status(400).json({ error: err.message || 'Failed to upload logo.' });
  }
});

// POST /api/auth/logout - Invalidate session
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.sessionId) {
    invalidateSession(req.user.sessionId);
  }
  await logAudit(req, 'LOGOUT', 'auth', req.user?.id);
  res.clearCookie('sbm_token');
  return res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    const userRecords = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (userRecords.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const dbUser = userRecords[0];
    const isMatch = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, req.user!.id));
    await logAudit(req, 'CHANGE_PASSWORD', 'users', req.user!.id);

    return res.json({ message: 'Password updated successfully.' });
  } catch (err: any) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// PUT /api/auth/update-profile - Enforces currentPassword, handles logo, password & role-specific fields
router.put('/update-profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
      fullName,
      schoolHead,
      classification,
      logo,
      removeLogo,
    } = req.body;

    // Security Rule: All profile updates require verifying the current password
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to save profile changes.' });
    }

    const userRecords = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (userRecords.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const dbUser = userRecords[0];

    const isMatch = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    let updatedPasswordHash: string | null = null;
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New password confirmation does not match.' });
      }
      const salt = await bcrypt.genSalt(10);
      updatedPasswordHash = await bcrypt.hash(newPassword, salt);
    }

    const role = req.user!.role;

    if (role === 'regional') {
      const cleanAdminName = fullName ? fullName.trim() : dbUser.fullName;

      // Handle Region Logo
      const sysRecords = await db.select().from(systemCustomization).limit(1);
      const currentSys = sysRecords[0] || null;
      let finalLogo = currentSys?.regionLogo || dbUser.logo;

      if (removeLogo) {
        if (currentSys?.regionLogo) {
          await deleteReplacedAsset(currentSys.regionLogo);
        }
        finalLogo = null;
      } else if (logo !== undefined) {
        if (currentSys?.regionLogo && currentSys.regionLogo !== logo) {
          await deleteReplacedAsset(currentSys.regionLogo);
        }
        finalLogo = logo;
      }

      await db.transaction(async (tx) => {
        // Update user
        const userUpdate: any = {
          fullName: cleanAdminName,
          logo: finalLogo,
          updatedAt: new Date(),
        };
        if (updatedPasswordHash) {
          userUpdate.passwordHash = updatedPasswordHash;
        }
        await tx.update(users).set(userUpdate).where(eq(users.id, req.user!.id));

        // Update system customization regionLogo
        if (currentSys) {
          await tx
            .update(systemCustomization)
            .set({ regionLogo: finalLogo, updatedAt: new Date() })
            .where(eq(systemCustomization.id, currentSys.id));
        } else {
          await tx.insert(systemCustomization).values({
            siteTitle: 'Project SBM Online',
            regionTitle: 'DepEd Regional Office VIII',
            regionLogo: finalLogo,
            updatedAt: new Date(),
          });
        }
      });

      await logAudit(req, 'UPDATE_REGIONAL_PROFILE', 'users', req.user!.id, `Admin: ${cleanAdminName}`);
      return res.json({ message: 'Regional profile and credentials updated successfully.' });
    }

    if (role === 'division') {
      const cleanAdminName = fullName ? fullName.trim() : dbUser.fullName;

      let divData: any = null;
      if (req.user!.divisionId) {
        const divRecords = await db.select().from(divisions).where(eq(divisions.id, req.user!.divisionId));
        divData = divRecords[0] || null;
      }

      let finalLogo = divData?.logo || dbUser.logo;
      if (removeLogo) {
        if (divData?.logo) {
          await deleteReplacedAsset(divData.logo);
        }
        finalLogo = null;
      } else if (logo !== undefined) {
        if (divData?.logo && divData.logo !== logo) {
          await deleteReplacedAsset(divData.logo);
        }
        finalLogo = logo;
      }

      await db.transaction(async (tx) => {
        const userUpdate: any = {
          fullName: cleanAdminName,
          logo: finalLogo,
          updatedAt: new Date(),
        };
        if (updatedPasswordHash) {
          userUpdate.passwordHash = updatedPasswordHash;
        }
        await tx.update(users).set(userUpdate).where(eq(users.id, req.user!.id));

        if (req.user!.divisionId) {
          await tx
            .update(divisions)
            .set({ logo: finalLogo, updatedAt: new Date() })
            .where(eq(divisions.id, req.user!.divisionId!));
        }
      });

      await logAudit(req, 'UPDATE_DIVISION_PROFILE', 'users', req.user!.id, `Admin: ${cleanAdminName}`);
      return res.json({ message: 'Division profile and credentials updated successfully.' });
    }

    if (role === 'school') {
      if (!req.user!.schoolId) {
        return res.status(400).json({ error: 'No school associated with this account.' });
      }

      const schRecords = await db.select().from(schools).where(eq(schools.id, req.user!.schoolId!));
      if (schRecords.length === 0) {
        return res.status(404).json({ error: 'School record not found.' });
      }
      const schoolRecord = schRecords[0];

      let finalLogo = schoolRecord.logo || dbUser.logo;
      if (removeLogo) {
        if (schoolRecord.logo) {
          await deleteReplacedAsset(schoolRecord.logo);
        }
        finalLogo = null;
      } else if (logo !== undefined) {
        if (schoolRecord.logo && schoolRecord.logo !== logo) {
          await deleteReplacedAsset(schoolRecord.logo);
        }
        finalLogo = logo;
      }

      const schoolUpdate: any = { logo: finalLogo, updatedAt: new Date() };
      if (schoolHead) schoolUpdate.schoolHead = schoolHead.trim();

      if (classification) {
        const classCheck = await db
          .select()
          .from(schoolClassifications)
          .where(sql`LOWER(${schoolClassifications.name}) = LOWER(${classification.trim()})`);
        if (classCheck.length === 0) {
          return res.status(400).json({ error: 'Invalid school classification selected.' });
        }
        schoolUpdate.classification = classCheck[0].name;
      }

      await db.transaction(async (tx) => {
        const userUpdate: any = { logo: finalLogo, updatedAt: new Date() };
        if (updatedPasswordHash) {
          userUpdate.passwordHash = updatedPasswordHash;
        }
        await tx.update(users).set(userUpdate).where(eq(users.id, req.user!.id));

        await tx.update(schools).set(schoolUpdate).where(eq(schools.id, req.user!.schoolId!));
      });

      await logAudit(
        req,
        'UPDATE_SCHOOL_PROFILE',
        'schools',
        req.user!.schoolId!,
        `School Head: ${schoolUpdate.schoolHead || schoolRecord.schoolHead}`
      );

      return res.json({ message: 'School profile and credentials updated successfully.' });
    }

    return res.status(400).json({ error: 'Invalid user role.' });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
