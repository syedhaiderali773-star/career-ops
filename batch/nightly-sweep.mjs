#!/usr/bin/env node
/**
 * 02:00 last-24h sweep: both portal files, reverse-ATS (FT + intern),
 * Interamt, HN, Excel, blocked boards, then one 40/60 list (70–100).
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, appendFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { localToday } from '../lib/local-today.mjs';
import { isMainModule } from '../lib/is-main-module.mjs';
import { getCareerOpsRoot } from '../path-resolver.mjs';

const ROOT = getCareerOpsRoot();
const DATE = localToday();
const LOCK = resolve(ROOT, 'data/.nightly-sweep.lock');
const LOG = resolve(ROOT, 'data/nightly-log.tsv');
const CHECKPOINT = resolve(ROOT, 'data/cache/ats-full-checkpoint.json');

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (existsSync(LOCK)) {
    const prev = Number(readFileSync(LOCK, 'utf8').trim());
    if (prev && pidAlive(prev)) {
      console.error(`nightly already running pid ${prev}`);
      process.exit(0);
    }
  }
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  writeFileSync(LOCK, String(process.pid));
}

function releaseLock() {
  try { unlinkSync(LOCK); } catch { /* ignore */ }
}

function run(label, args, env = {}) {
  const started = Date.now();
  process.stderr.write(`\n== ${label} ==\n`);
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  const status = r.status ?? 1;
  const row = `${new Date().toISOString()}\t${DATE}\t${label}\t${status}\t${Date.now() - started}\n`;
  if (!existsSync(LOG)) writeFileSync(LOG, 'ts\tdate\tstep\tstatus\tms\n');
  appendFileSync(LOG, row);
  return status;
}

async function main() {
  acquireLock();
  try {
    run('scan-ft', ['scan.mjs', '--since', '1', '--quiet']);
    run('scan-intern', ['scan.mjs', '--since', '1', '--quiet'], { CAREER_OPS_PORTALS: 'portals-intern.yml' });

    const atsArgs = ['scan-ats-full.mjs', '--since', '1'];
    if (existsSync(CHECKPOINT)) atsArgs.push('--resume');
    run('scan-ats-full', atsArgs);

    run('scan-ats-full-intern', ['scan-ats-full.mjs', '--since', '1'], { CAREER_OPS_PORTALS: 'portals-intern.yml' });

    run('scan-interamt', ['scan-interamt.mjs']);
    run('scan-hn', ['scan-hn.mjs']);
    run('excel', ['batch/excel-career-scan.mjs']);
    run('blocked-boards', ['batch/scan-blocked-boards.mjs']);
    const pack = run('pack', ['batch/pack-nightly.mjs']);
    if (pack !== 0) process.exit(pack);
  } finally {
    releaseLock();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    releaseLock();
    process.exit(1);
  });
}
