// Admin "Run full check": one line per part of the app, green (ok), amber (warn) or red (fail).
import { FunctionsHttpError } from '@supabase/supabase-js';

import { checkConnection, supabase } from '../auth/supabase';
import { dbHealth } from '../db/libraryStore';
import { checkForUpdate, installedBuild, installedVersion } from '../updater';
import { CheckResult, FaultEntry, buildReport, isNetworkError, recentErrors } from './faultLog';
import { firstDepartment, readFaults } from './faultStore';

/** A fixed, harmless question: no patient or personal information. */
const OMNIBAR_TEST_MESSAGE = 'Test from the Admin check: where are the 4x4 sponges?';
const TIMEOUT_MS = 20000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`No answer in ${ms / 1000} s`)), ms))]);
}

const OFFLINE = 'Offline (no internet)';

/** Plain words for a failure: any network failure reads "Offline". */
function plain(text: string): string {
  return isNetworkError(text) ? OFFLINE : text;
}

function msg(e: unknown): string {
  return plain(e instanceof Error ? e.message : String(e));
}

async function step(name: string, run: () => Promise<Omit<CheckResult, 'name'>>): Promise<CheckResult> {
  try {
    return { name, ...(await withTimeout(run())) };
  } catch (e) {
    return { name, status: 'fail', value: msg(e) };
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function runFullCheck(userId: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  out.push(
    await step('Server', async () => {
      const c = await checkConnection();
      const text = { ok: 'Connected', offline: 'Offline (no internet)', paused: 'Paused: resume it in Supabase', error: 'Error' }[c];
      return { status: c === 'ok' ? 'ok' : 'fail', value: text };
    }),
  );

  out.push(
    await step('Sign-in', async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return { status: 'fail', value: error ? plain(error.message) : 'Not signed in on the server' };
      return { status: 'ok', value: 'Session is valid' };
    }),
  );

  let loadedAt: string | null = null;
  out.push(
    await step('Phone database', async () => {
      const h = await dbHealth();
      loadedAt = h.loadedAt;
      const same = h.schemaVersion === h.latestVersion;
      return { status: same ? 'ok' : 'fail', value: `v${h.schemaVersion} of v${h.latestVersion}, ${h.counts.cards} cards, ${h.counts.items} items` };
    }),
  );

  out.push(
    await step('Last sync', async () => {
      if (!loadedAt) return { status: 'warn', value: 'Never' };
      const days = (Date.now() - new Date(loadedAt).getTime()) / 86400000;
      return { status: days > 7 ? 'warn' : 'ok', value: when(loadedAt) };
    }),
  );

  out.push(
    await step('App version', async () => {
      const c = await checkForUpdate().catch((e) => {
        throw new Error(/reach github/i.test(msg(e)) ? OFFLINE : msg(e));
      });
      if (c.updateAvailable) return { status: 'warn', value: `${c.installed}; ${c.remote.tag} is out` };
      return { status: 'ok', value: `${c.installed} (latest)` };
    }),
  );

  out.push(
    await step('Fault log', async () => {
      const n = recentErrors(await readFaults());
      return { status: n ? 'warn' : 'ok', value: n ? `${n} error${n === 1 ? '' : 's'} in 24 h` : 'No errors in 24 h' };
    }),
  );

  out.push(
    await step('Omnibar AI', async () => {
      const dept = await firstDepartment(userId);
      if (!dept) return { status: 'warn', value: 'Join a department first' };
      const started = Date.now();
      const { data, error } = await supabase.functions.invoke('omnibar', {
        body: { message: OMNIBAR_TEST_MESSAGE, history: [], department_id: dept },
      });
      if (error) {
        let text = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            if (body?.error) text = String(body.error);
          } catch {
            // keep the plain message
          }
        }
        return { status: 'fail', value: plain(text) };
      }
      const s = ((Date.now() - started) / 1000).toFixed(1);
      if (!data?.reply) return { status: 'fail', value: 'Empty answer' };
      return { status: 'ok', value: `${typeof data.model === 'string' && data.model ? data.model : 'The AI'} answered (${s} s)` };
    }),
  );

  return out;
}

/** Uploads the check lines and the newest log entries to Supabase (table fault_reports, admins read). */
export async function sendReport(userId: string, checks: CheckResult[], entries: FaultEntry[]): Promise<void> {
  const r = buildReport(installedVersion(), installedBuild(), checks, entries);
  const { error } = await withTimeout(Promise.resolve(supabase.from('fault_reports').insert({ user_id: userId, ...r })));
  if (error) {
    if (/relation .* does not exist|schema cache/i.test(error.message)) throw new Error('The server is not set up yet. Run 0004_fault_reports.sql in Supabase.');
    if (/network|fetch/i.test(error.message)) throw new Error('Offline. The log stays on the phone; send it when you have internet.');
    throw new Error(error.message);
  }
}
