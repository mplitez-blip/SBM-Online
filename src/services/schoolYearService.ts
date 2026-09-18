import { prisma } from '../lib/prisma.ts';
import { SchoolYearStatus } from '@prisma/client';

export class SchoolYearService {
  /**
   * Transactionally activates a target School Year while deactivating any other active School Year.
   * Enforces that exactly one School Year is Active at any given time.
   */
  static async activateSchoolYear(targetSchoolYearId: number, actingUserId?: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify target school year exists and is not closed
      const targetYear = await tx.schoolYear.findUnique({
        where: { id: targetSchoolYearId },
      });

      if (!targetYear) {
        throw new Error(`School Year with ID ${targetSchoolYearId} was not found.`);
      }

      if (targetYear.status === SchoolYearStatus.Closed) {
        throw new Error(`Cannot activate a closed School Year (${targetYear.label}). Re-open it first.`);
      }

      // 2. Transactionally deactivate all currently Active School Years (set to Open)
      const deactivated = await tx.schoolYear.updateMany({
        where: {
          status: SchoolYearStatus.Active,
          id: { not: targetSchoolYearId },
        },
        data: {
          status: SchoolYearStatus.Open,
        },
      });

      // 3. Mark the target School Year as Active
      const activatedYear = await tx.schoolYear.update({
        where: { id: targetSchoolYearId },
        data: {
          status: SchoolYearStatus.Active,
        },
      });

      // 4. Record the state change in the Audit Log
      await tx.auditLog.create({
        data: {
          userId: actingUserId ?? null,
          action: 'ACTIVATE_SCHOOL_YEAR',
          resourceType: 'SchoolYear',
          resourceId: String(targetSchoolYearId),
          details: {
            previousActiveDeactivatedCount: deactivated.count,
            activatedSchoolYear: activatedYear.label,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return activatedYear;
    });
  }

  /**
   * Closes a school year, locking all associated assessments.
   */
  static async closeSchoolYear(schoolYearId: number, actingUserId?: number) {
    return await prisma.$transaction(async (tx) => {
      const year = await tx.schoolYear.findUnique({ where: { id: schoolYearId } });
      if (!year) throw new Error('School Year not found.');

      // Lock all assessments in this school year
      await tx.assessment.updateMany({
        where: { schoolYearId },
        data: { isLocked: true },
      });

      const updated = await tx.schoolYear.update({
        where: { id: schoolYearId },
        data: { status: SchoolYearStatus.Closed },
      });

      await tx.auditLog.create({
        data: {
          userId: actingUserId ?? null,
          action: 'CLOSE_SCHOOL_YEAR',
          resourceType: 'SchoolYear',
          resourceId: String(schoolYearId),
          details: { label: updated.label },
        },
      });

      return updated;
    });
  }
}
