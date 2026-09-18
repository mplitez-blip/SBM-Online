import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { users, auditLogs, schools } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'deped-ro8-sbm-online-super-secret-key-2026-prod';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string | null;
  role: 'regional' | 'division' | 'school';
  fullName: string;
  divisionId: number | null;
  schoolId: number | null;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// In-memory active session store for session regeneration & immediate logout invalidation
interface ActiveSession {
  sessionId: string;
  userId: number;
  username: string;
  role: string;
  createdAt: number;
}

const activeSessions = new Map<string, ActiveSession>();
const userActiveSessions = new Map<number, Set<string>>();

/**
 * Regenerate session: invalidates any existing sessions for this user
 * and registers a brand new unique sessionId.
 */
export function registerSession(userId: number, username: string, role: string): string {
  // Invalidate any previous session for this user
  const previousSessions = userActiveSessions.get(userId);
  if (previousSessions) {
    for (const oldSid of previousSessions) {
      activeSessions.delete(oldSid);
    }
    userActiveSessions.delete(userId);
  }

  const sessionId = crypto.randomUUID();
  const session: ActiveSession = {
    sessionId,
    userId,
    username,
    role,
    createdAt: Date.now(),
  };

  activeSessions.set(sessionId, session);
  userActiveSessions.set(userId, new Set([sessionId]));
  return sessionId;
}

/**
 * Checks if a session is currently active and not invalidated.
 */
export function isSessionActive(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}

/**
 * Invalidate a session immediately upon logout.
 */
export function invalidateSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    activeSessions.delete(sessionId);
    const userSet = userActiveSessions.get(session.userId);
    if (userSet) {
      userSet.delete(sessionId);
      if (userSet.size === 0) {
        userActiveSessions.delete(session.userId);
      }
    }
  }
}

// Generate JWT token with embedded unique sessionId
export function generateToken(user: Omit<AuthenticatedUser, 'sessionId'>, sessionId: string): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      divisionId: user.divisionId,
      schoolId: user.schoolId,
      sessionId,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Log audit trail
export async function logAudit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string | number | null,
  details?: string
) {
  try {
    const authReq = req as AuthenticatedRequest;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await db.insert(auditLogs).values({
      userId: authReq.user?.id || null,
      username: authReq.user?.username || 'anonymous',
      role: authReq.user?.role || 'guest',
      action,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : null,
      details: details || null,
      ipAddress: String(ip),
    });
  } catch (err) {
    console.error('Audit log failure:', err);
  }
}

// Require authentication middleware with session validation
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies.sbm_token) {
    token = req.cookies.sbm_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      // Check if it is a Firebase ID Token fallback
      try {
        const decodedFb = await adminAuth.verifyIdToken(token);
        if (decodedFb.email) {
          const userRecords = await db.select().from(users).where(eq(users.email, decodedFb.email));
          if (userRecords.length > 0) {
            const dbUser = userRecords[0];
            if (!dbUser.isActive) {
              return res.status(403).json({ error: 'This account is inactive. Please contact your administrator.' });
            }
            req.user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              role: dbUser.role as any,
              fullName: dbUser.fullName,
              divisionId: dbUser.divisionId,
              schoolId: dbUser.schoolId,
              sessionId: 'firebase-session',
            };
            return next();
          }
        }
      } catch {
        // neither worked
      }
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }

    // Verify session is actively registered and has not been invalidated/logged out
    if (!payload.sessionId || !isSessionActive(payload.sessionId)) {
      return res.status(401).json({ error: 'Session has been invalidated or expired. Please sign in again.' });
    }

    // Verify user exists and is active in DB
    const userRecords = await db.select().from(users).where(eq(users.id, payload.id));
    if (userRecords.length === 0 || !userRecords[0].isActive) {
      return res.status(403).json({ error: 'This account is inactive. Please contact your administrator.' });
    }

    const dbUser = userRecords[0];
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role as any,
      fullName: dbUser.fullName,
      divisionId: dbUser.divisionId,
      schoolId: dbUser.schoolId,
      sessionId: payload.sessionId,
    };
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Session invalid.' });
  }
}

// Role restriction middleware
export function requireRole(...allowedRoles: ('regional' | 'division' | 'school')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
}

// Scope check for Division level
export function enforceDivisionScope(req: AuthenticatedRequest, res: Response, targetDivisionId: number): boolean {
  if (!req.user) return false;
  if (req.user.role === 'regional') return true;
  if (req.user.role === 'division' && req.user.divisionId === targetDivisionId) return true;
  return false;
}

// Scope check for School level
export async function enforceSchoolScopeAsync(req: AuthenticatedRequest, targetSchoolId: number): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'regional') return true;
  if (req.user.role === 'school' && req.user.schoolId === targetSchoolId) return true;
  if (req.user.role === 'division' && req.user.divisionId) {
    const sch = await db.select().from(schools).where(eq(schools.id, targetSchoolId));
    if (sch.length > 0 && sch[0].divisionId === req.user.divisionId) return true;
  }
  return false;
}

export function enforceSchoolScope(req: AuthenticatedRequest, res: Response, targetSchoolId: number): boolean {
  if (!req.user) return false;
  if (req.user.role === 'regional') return true;
  if (req.user.role === 'school' && req.user.schoolId === targetSchoolId) return true;
  return false;
}
