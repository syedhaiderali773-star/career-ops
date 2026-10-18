#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import {
  classify, keywordsFrom, coverFor, buildPayload, fetchJd, companyName, DATE, CV_TPL,
} from './redesign-pack-80.mjs';

const extras = [
  {
    url: 'https://jobs.smartrecruiters.com/Auto1/744000151054139-intern-financial-planning-analytics-f-m-x',
    company: 'AUTO1',
    role: 'Intern Financial Planning & Analytics (f/m/x)',
    loc: 'Berlin, Germany',
    city: 'Berlin',
    slug: 'ws24-auto1-intern-financial-planning-analytics',
    type: 'Intern',
    track: 'intern',
  },
  {
    url: 'https://jobs.bmwgroup.com/job/Praktikant-Strategischer-Einkauf-Digitalisierung-%28wmx%29/196423-de_DE',
    company: 'BMW Group',
    role: 'Praktikant Strategischer Einkauf Digitalisierung (w/m/x)',
    loc: 'Germany',
    city: 'Germany',
    slug: 'ws24-bmw-group-praktikant-strategischer-einkauf',
    type: 'Intern',
    track: 'intern',
  },
];

function germanAboveA2(text) {
  return /german\s*(b1|b2|c1|c2)|fluency in german|fluent(?:ly)? in german|business[- ]fluent german|good knowledge of german|german native|sehr gute deutsch|deutsch zwingend|flie[sß]ende deutsch|verhandlungssicheres deutsch|muttersprachliches deutsch/i.test(text || '');
}
function germanOnly(text) {
  const de = (String(text || '').match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung)\b/gi) || []).length;
  const en = (String(text || '').match(/\b(the|and|you|will|requirements|responsibilities|experience)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}
function foreignPlace(loc, url, jd) {
  const locUrl = `${loc} ${url}`.toLowerCase();
  if (/mexico|amsterdam|pennsylvania|london|united states|glasgow/i.test(locUrl)) return true;
  const t = `${loc} ${jd}`.toLowerCase();
  return !/germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|nuremberg|düsseldorf|stuttgart|köln|cologne/i.test(t);
}
function certFinance(role, jd) {
  return /econometrics|\bcfa\b|\bcpa\b|\bacca\b|steuerberater|wirtschaftsprüfer|chartered accountant/i.test(`${role} ${jd}`);
}

mkdirSync('output/_pack-ws24', { recursive: true });
const workdir = resolve('output/_pack-ws24');
const keep = JSON.parse(readFileSync('batch/pack-intern-24h.json', 'utf8'))
  .filter((j) => j.slug !== 'ws24-urban-sports-club-product-design-intern-');
const drop = [];
const manifest = [];

for (const job of extras) {
  process.stderr.write(`JD ${job.slug}\n`);
  const jd = await fetchJd(job);
  if (jd.startsWith('ERROR') || jd.length < 80) {
    drop.push({ slug: job.slug, reason: jd.slice(0, 80) });
    continue;
  }
  if (germanAboveA2(jd)) { drop.push({ slug: job.slug, reason: 'german-above-a2' }); continue; }
  if (germanOnly(jd)) { drop.push({ slug: job.slug, reason: 'german-body' }); continue; }
  if (foreignPlace(job.loc, job.url, jd)) { drop.push({ slug: job.slug, reason: 'not-germany' }); continue; }
  if (certFinance(job.role, jd)) { drop.push({ slug: job.slug, reason: 'cert-finance' }); continue; }
  const kws = keywordsFrom(`${jd} ${job.role}`);
  keep.push({ ...job, kws });
  writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
  const group = classify(job);
  const payload = buildPayload(job, group, kws);
  const cvJson = resolve(workdir, `cv-${job.slug}.json`);
  const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
  writeFileSync(cvJson, JSON.stringify(payload));
  execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml, CV_TPL], { stdio: 'inherit' });
  manifest.push({ input: cvHtml, output: resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
  const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
  writeFileSync(coverHtml, buildCoverHtml(coverFor(job, group, jd, kws)));
  manifest.push({ input: coverHtml, output: resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
}

writeFileSync('batch/pack-intern-24h.json', JSON.stringify(keep, null, 2));
writeFileSync('batch/pack-intern-24h-fill-drop.json', JSON.stringify(drop, null, 2));
if (manifest.length) {
  const manPath = resolve(workdir, 'manifest.json');
  writeFileSync(manPath, JSON.stringify(manifest, null, 2));
  execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
}
try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(JSON.stringify({ kept: keep.length, dropped: drop, newPdfs: manifest.length / 2 }, null, 2));
