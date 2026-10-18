#!/usr/bin/env node
/**
 * Tailored CV + cover PDFs for net-new shortlist (not in prior packs).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import { localToday } from '../lib/local-today.mjs';
import { isMainModule } from '../lib/is-main-module.mjs';
import { auditAts } from '../verify-ats.mjs';
import {
  classify, keywordsFrom, coverFor, buildPayload, fetchJd, companyName, CV_TPL,
} from './redesign-pack-80.mjs';

const DATE = localToday();

function slugify(prefix, company, role) {
  return `${prefix}-${`${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
}

function chartRow(i, j) {
  const cv = `cv-syed-haider-ali-${j.slug}-${DATE}.pdf`;
  const cover = `cover-syed-haider-ali-${j.slug}-${DATE}.pdf`;
  return `| ${i} | ${companyName(j)} | ${j.role} | ${j.city} | ${j.type} | [Apply](${j.url}) | \`${cv}\` | \`${cover}\` |`;
}

async function main() {
  const raw = JSON.parse(readFileSync('batch/pack-18-new.json', 'utf8'));
  const jobs = raw.map((j) => ({
    ...j,
    slug: slugify(j.track === 'intern' ? 'n18ws' : 'n18ft', j.company, j.role),
  }));

  mkdirSync('jds', { recursive: true });
  mkdirSync('output', { recursive: true });
  const workdir = resolve('output/_pack-18-new');
  mkdirSync(workdir, { recursive: true });

  const manifest = [];
  const warnings = [];
  const built = [];

  for (const job of jobs) {
    process.stderr.write(`JD ${job.slug}\n`);
    let jd = await fetchJd(job);
    if (jd.startsWith('ERROR') || jd.length < 80) {
      warnings.push({ slug: job.slug, reason: jd.startsWith('ERROR') ? jd : 'short-jd' });
      jd = `${job.role}. ${job.company}. ${job.city}.`;
    }
    writeFileSync(
      `jds/${job.slug}.md`,
      `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`,
    );

    const group = classify(job);
    const kws = keywordsFrom(`${jd} ${job.role}`);
    const payload = buildPayload(job, group, kws);
    const cvJson = resolve(workdir, `cv-${job.slug}.json`);
    const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
    writeFileSync(cvJson, JSON.stringify(payload));
    execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml, CV_TPL], { stdio: 'inherit' });

    const ats = auditAts(readFileSync(cvHtml, 'utf8'), { role: job.role, keywords: kws });
    if (ats.score < 100) {
      warnings.push({ slug: job.slug, reason: `ats-advisory ${ats.score}` });
    }

    const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
    writeFileSync(coverHtml, buildCoverHtml(coverFor(job, group, jd, kws)));

    manifest.push({ input: cvHtml, output: resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
    manifest.push({ input: coverHtml, output: resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
    built.push({ ...job, group, atsScore: ats.score });
  }

  const manPath = resolve(workdir, 'manifest.json');
  writeFileSync(manPath, JSON.stringify(manifest, null, 2));
  if (manifest.length) {
    execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
  }
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }

  const intern = built.filter((j) => j.track === 'intern');
  const ft = built.filter((j) => j.track === 'ft');
  const chart = [
    `# Net-new pack — ${DATE}`,
    '',
    `Total: ${built.length} · Intern/WS: ${intern.length} · Full-time / Trainee: ${ft.length}`,
    '',
    '## Intern / working student',
    '',
    '| # | Company | Role | City | Type | Apply | CV | Cover |',
    '|---|---|---|---|---|---|---|---|',
    ...intern.map((j, i) => chartRow(i + 1, j)),
    '',
    '## Full-time / trainee',
    '',
    '| # | Company | Role | City | Type | Apply | CV | Cover |',
    '|---|---|---|---|---|---|---|---|',
    ...ft.map((j, i) => chartRow(intern.length + i + 1, j)),
    '',
  ].join('\n');
  writeFileSync(`output/pack-18-${DATE}.md`, chart);
  writeFileSync('batch/pack-18-new-built.json', JSON.stringify({ date: DATE, intern, ft, warnings }, null, 2));

  console.log(JSON.stringify({
    date: DATE,
    total: built.length,
    intern: intern.length,
    ft: ft.length,
    pdfs: manifest.length,
    warnings: warnings.length,
    chart: `output/pack-18-${DATE}.md`,
  }, null, 2));
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
