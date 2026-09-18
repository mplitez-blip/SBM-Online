import { Response } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from './auth.ts';
import { db } from '../db/index.ts';
import { schools, divisions } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AuthorizationError';
  }
}

export class ScopeService {
  /**
   * Never trust divisionId supplied by the browser.
   * Derives effective divisionId strictly from authenticated user.
   * If a Division user explicitly targets a divisionId, verifies that it matches their assigned divisionId.
   */
  static getAuthorizedDivisionId(user: AuthenticatedUser, requestedDivisionId?: number | null): number | null {
    if (user.role === 'regional') {
      return requestedDivisionId || null;
    }

    if (user.role === 'division') {
      if (!user.divisionId) {
        throw new AuthorizationError('Division user has no assigned division.');
      }
      if (requestedDivisionId && requestedDivisionId !== user.divisionId) {
        throw new AuthorizationError('Access denied: You cannot access or target another Division.');
      }
      return user.divisionId;
    }

    // School users cannot query or manage by division
    throw new AuthorizationError('Access denied: School users are not authorized for division-level operations.');
  }

  /**
   * Never trust schoolId supplied by the browser.
   * If user is 'school', returns strictly user.schoolId. If requestedSchoolId is supplied and differs, throws 403.
   * If user is 'division', checks that target school belongs to user.divisionId.
   * If user is 'regional', returns target school.
   */
  static async assertSchoolAccess(
    user: AuthenticatedUser,
    targetSchoolId: number
  ): Promise<{ id: number; schoolId: string; divisionId: number; schoolName: string }> {
    if (!targetSchoolId) {
      throw new AuthorizationError('School ID is required.', 400);
    }

    const schoolRecords = await db.select().from(schools).where(eq(schools.id, targetSchoolId));
    if (schoolRecords.length === 0) {
      throw new AuthorizationError('School not found.', 404);
    }
    const school = schoolRecords[0];

    if (user.role === 'regional') {
      return school;
    }

    if (user.role === 'division') {
      if (!user.divisionId || school.divisionId !== user.divisionId) {
        throw new AuthorizationError('Access denied: You cannot access or view schools outside your assigned Division.');
      }
      return school;
    }

    if (user.role === 'school') {
      if (user.schoolId !== school.id) {
        throw new AuthorizationError("Access denied: You cannot access another school's assessment or data.");
      }
      return school;
    }

    throw new AuthorizationError('Access denied: Unauthorized role.');
  }

  /**
   * Ensures that a user can edit/modify a school.
   * - School users are strictly forbidden (cannot edit school profiles administratively).
   * - Division users can only edit schools within their assigned division.
   * - Regional users can edit any school.
   */
  static async assertSchoolEdit(
    user: AuthenticatedUser,
    targetSchoolId: number
  ): Promise<{ id: number; schoolId: string; divisionId: number; schoolName: string }> {
    if (user.role === 'school') {
      throw new AuthorizationError('Access denied: School accounts cannot perform administrative school modifications.');
    }
    return this.assertSchoolAccess(user, targetSchoolId);
  }

  /**
   * Ensures that a user has access to a division.
   * - Regional can access any division.
   * - Division can only access their assigned division.
   * - School cannot access division-level administration.
   */
  static assertDivisionAccess(user: AuthenticatedUser, targetDivisionId: number): void {
    if (user.role === 'regional') return;

    if (user.role === 'division') {
      if (!user.divisionId || user.divisionId !== targetDivisionId) {
        throw new AuthorizationError('Access denied: You cannot access or administer another Division.');
      }
      return;
    }

    throw new AuthorizationError('Access denied: School users cannot access Division administration.');
  }
}
