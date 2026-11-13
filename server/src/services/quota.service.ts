import { query } from '../db/connection';

export class QuotaService {
  /**
   * Atomically checks and reserves department quota hours.
   * Standard uploads fail if quota is exceeded.
   * Urgent priority uploads are allowed to bypass the quota ceiling.
   */
  static async enforceAndReserveQuota(
    departmentId: string,
    fileSizeBytes: number,
    priority: 'urgent' | 'standard',
    explicitDurationSec?: number
  ): Promise<{ allowed: boolean; remainingHours?: number; error?: string }> {
    // Estimate compute hours: 1GB roughly equals ~1.2 compute hours of multi-quality H.264 transcoding
    // or explicit duration / 3600
    const estimatedHours = explicitDurationSec
      ? +(explicitDurationSec / 3600).toFixed(2)
      : +(Math.max(0.1, fileSizeBytes / (1024 * 1024 * 1024) * 1.2)).toFixed(2);

    const updateSql = `
      UPDATE departments 
      SET used_hours = used_hours + $1 
      WHERE id = $2 AND (used_hours + $1 <= quota_hours OR $3 = 'urgent') 
      RETURNING id, name, quota_hours, used_hours;
    `;

    try {
      const result = await query(updateSql, [estimatedHours, departmentId, priority]);

      if (result.rowCount === 0) {
        // Fetch current quota to provide helpful diagnostic error
        const checkResult = await query('SELECT quota_hours, used_hours FROM departments WHERE id = $1', [departmentId]);
        const dept = checkResult.rows[0];
        const currentUsed = dept ? Number(dept.used_hours) : 0;
        const limit = dept ? Number(dept.quota_hours) : 0;

        return {
          allowed: false,
          error: `Department quota exceeded. Current: ${currentUsed.toFixed(1)}h / ${limit}h limit. Required: ${estimatedHours}h. Select 'Urgent' priority to request an institutional override.`,
        };
      }

      const updatedDept = result.rows[0];
      const remaining = Number(updatedDept.quota_hours) - Number(updatedDept.used_hours);

      return {
        allowed: true,
        remainingHours: Math.max(0, +remaining.toFixed(2)),
      };
    } catch (err: any) {
      console.error('[Quota Service Error]', err);
      // Fail closed
      return {
        allowed: false,
        error: `Failed to evaluate department quota: ${err.message}`,
      };
    }
  }
}

