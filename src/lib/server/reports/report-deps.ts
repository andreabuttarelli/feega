import { createServiceRoleDb, type Db } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { sendEmail } from '$lib/server/email';
import { internalEmails } from '$lib/server/internal-users';
import type { BanHours, ReportDeps } from './reports';

const USE = SERVICE_ROLE_USES.find((u) => u.path.startsWith('src/lib/server/reports/report-deps.ts'))!;
const LIFT_BAN = 'none';

function banWith(db: Db) {
  return async (userId: string, hours: BanHours): Promise<void> => {
    const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: hours ? `${hours}h` : LIFT_BAN });
    if (error) {
      throw error;
    }
  };
}

export function reportDeps(origin: string): ReportDeps {
  const db = createServiceRoleDb(USE);
  return {
    db,
    send: (to, mail) => sendEmail({ to, ...mail }),
    ban: banWith(db),
    now: () => new Date(),
    internalRecipients: internalEmails,
    origin
  };
}
