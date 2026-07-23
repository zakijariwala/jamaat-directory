// Nightly D1 → R2 backup (scheduled Worker).
//
// Runs on a cron trigger, dumps every table to a dated JSON object in the R2
// backups bucket, and prunes anything older than 30 days. This is a private
// recovery backup, so it DOES include phone numbers (unlike directory.json).
//
// Deploy separately:  cd workers/backup && npx wrangler deploy
// It binds the SAME D1 database and R2 bucket as the Pages project.

export interface Env {
  DB: D1Database;
  BACKUPS: R2Bucket;
}

const RETENTION_DAYS = 30;

async function runBackup(env: Env): Promise<void> {
  const [cities, contacts, facilities, flags] = await Promise.all([
    env.DB.prepare('SELECT * FROM cities').all(),
    env.DB.prepare('SELECT * FROM contacts').all(),
    env.DB.prepare('SELECT * FROM facilities').all(),
    env.DB.prepare('SELECT * FROM flags').all(),
  ]);

  const dump = {
    exported_at: new Date().toISOString(),
    cities: cities.results,
    contacts: contacts.results,
    facilities: facilities.results,
    flags: flags.results,
  };

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await env.BACKUPS.put(`backups/${date}.json`, JSON.stringify(dump), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Prune backups older than the retention window.
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const listed = await env.BACKUPS.list({ prefix: 'backups/' });
  for (const obj of listed.objects) {
    if (obj.uploaded.getTime() < cutoff) {
      await env.BACKUPS.delete(obj.key);
    }
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runBackup(env));
  },
  // Allow a manual trigger for testing: GET the worker URL runs one backup.
  async fetch(_request: Request, env: Env): Promise<Response> {
    await runBackup(env);
    return new Response('backup complete\n');
  },
} satisfies ExportedHandler<Env>;
