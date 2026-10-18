#!/usr/bin/env node
/**
 * First 40 full-time packs from last-24h postings. Germany only.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import {
  classify, keywordsFrom, coverFor, buildPayload, fetchJd, companyName, DATE, CV_TPL,
} from './redesign-pack-80.mjs';

const TARGET = 40;
const APPLIED = new Set([
  'tytan technologies', 'tactilia', 'marvel fusion', 'sap', 'solaris', 'ctrl qs',
  'munich re', 'siemens energy', 'unternehmertum', 'westwing', 'upvest', 'jd.com',
  'celonis', 'borgwarner', 'fresenius', 'airbus', 'samsung', 'peec', 'heidelberg',
  'dyson', 'lemon.markets', 'taktile', 'tourlane', 'statista', 'xometry',
  'lightspeed', 'lucanet', 'flexport', 'pigment', 'dun & bradstreet', 'almedia',
  'yepoda', 'mirakl', 'numa',
]);

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function germanAboveA2(text) {
  if (!text) return false;
  return /german\s*(b1|b2|c1|c2)\b.{0,40}(?:required|mandatory|erforderlich|must)|(?:required|mandatory|must|erforderlich).{0,40}german\s*(b1|b2|c1|c2)|fluency in german|fluent(?:ly)? in german|fluent german required|business[- ]fluent german|professional german required|excellent german required|very good german required|native(?:-level)? german|german native speaker|good knowledge of german|german c2|deutsch\s*(b1|b2|c1|c2).{0,20}(?:erforderlich|required)|flie[sß]ende deutschkenntnisse|verhandlungssicheres deutsch|muttersprachliches deutsch|sehr gute deutschkenntnisse|deutsch zwingend|working language.{0,25}german.{0,15}(?:required|must)/i.test(text);
}

function germanOnly(text) {
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}

function notGermany(loc, jd) {
  const t = `${loc} ${jd}`.toLowerCase();
  if (/mexico|méxico|monterrey|guadalajara|portugal|lisbon|united states|\busa\b|new york|united kingdom|\blondon\b|netherlands|amsterdam|switzerland|austria|spain|italy|france|\bparis\b|poland|india|pakistan/i.test(t)
    && !/germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|karlsruhe|garching/i.test(t)) {
    return true;
  }
  if (/\bmexico\b|\bméxico\b|location:\s*mexico|based in mexico|office in mexico/i.test(t)) return true;
  if (!/germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|nuremberg|garching|karlsruhe|heidelberg|aachen|mannheim|darmstadt|dortmund|essen|bremen|dresden|hannover|remote germany|hybrid germany|deutschlandweit/i.test(t)) {
    return true;
  }
  return false;
}

function certFinance(role, jd) {
  const t = `${role} ${jd}`.toLowerCase();
  return /econometrics|\bcfa\b|\bcpa\b|\bacca\b|steuerberater|wirtschaftsprüfer|chartered accountant|qualified accountant|cpa required|cfa required/.test(t);
}

function isIntern(role) {
  if (/internal/i.test(role) && !/(werkstudent|working student|praktikum|internship|(^|[^a-z])intern([^a-z]|$))/i.test(role)) return false;
  return /(werkstudent|working student|praktikum|praktikant|internship|(^|[^a-z])intern([^a-z]|$)|student assistant)/i.test(role);
}

function slugify(company, role) {
  return `ft24-${`${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function alreadyApplied(company) {
  const c = norm(company);
  for (const a of APPLIED) {
    const n = norm(a);
    if (c.includes(n) || n.includes(c.slice(0, 16))) return true;
  }
  return false;
}

function ftScore(j) {
  const t = `${j.role} ${j.loc}`.toLowerCase();
  let s = 0;
  if (/trainee|graduate|berufseinsteiger|absolvent/.test(t)) s += 12;
  if (/analyst/.test(t)) s += 11;
  if (/associate/.test(t)) s += 10;
  if (/junior/.test(t)) s += 9;
  if (/operations|supply chain|procurement|logistics/.test(t)) s += 10;
  if (/product|portfolio|pricing/.test(t)) s += 8;
  if (/strategy|business development|founder/.test(t)) s += 8;
  if (/marketing|commercial/.test(t)) s += 7;
  if (/munich|münchen/.test(t)) s += 8;
  if (/berlin|hamburg|frankfurt/.test(t)) s += 4;
  if (/\bmanager\b/.test(t) && !/programme|program/.test(t)) s -= 8;
  if (/\bsr\.|\bsenior\b|\bstaff\b|director|head of|principal/.test(t)) s -= 40;
  return s;
}

function loadRecentFromHistory() {
  const text = readFileSync('data/scan-history.tsv', 'utf8');
  const jobs = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const [url, firstSeen, , title, company, , location, , postedAt] = cols;
    if (!url || !title) continue;
    const posted = String(postedAt || '').slice(0, 10);
    const seen = String(firstSeen || '').slice(0, 10);
    const recent = posted === '2026-09-22' || posted === '2026-09-21';
    if (!recent) continue;
    if (isIntern(title)) continue;
    jobs.push({
      url, company: company || 'Company', role: title, loc: location || '',
      posted, city: (location || 'Germany').split(/[·,;]/)[0].trim() || 'Germany',
    });
  }
  return jobs;
}

function loadRecentFromPipeline() {
  const text = readFileSync('data/pipeline.md', 'utf8');
  const jobs = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('- [ ] http')) continue;
    const posted = (line.match(/posted:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    if (posted !== '2026-09-22' && posted !== '2026-09-21') continue;
    const m = line.match(/^- \[ \] (\S+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)/);
    if (!m) continue;
    const role = m[3].trim();
    if (isIntern(role)) continue;
    jobs.push({
      url: m[1], company: m[2].trim(), role, loc: (m[4] || '').trim(),
      posted, city: (m[4] || 'Germany').replace(/posted:.*/i, '').split(/[·,;]/)[0].trim() || 'Germany',
    });
  }
  return jobs;
}

function pick(jobs) {
  const senior = /\bsenior\b|\bstaff\b|\bdirector\b|head of|vice president|\bprincipal\b|\bsr\./i;
  const scored = [];
  const seenUrl = new Set();
  for (const j of jobs) {
    const key = j.url.replace(/\/$/, '').split('?')[0].toLowerCase();
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    if (alreadyApplied(j.company)) continue;
    if (senior.test(j.role)) continue;
    if (/software engineer|developer|data scientist|firmware/.test(j.role)) continue;
    if (!/trainee|analyst|associate|graduate|junior|coordinator|berufseinsteiger|absolvent|founder|account executive|business development|customer success|pmo|operations|procurement|marketing|strategy|people ops|human resources|pricing|sales ops/i.test(j.role)) continue;
    const score = ftScore(j);
    if (score < 10) continue;
    scored.push({ ...j, score, track: 'ft', slug: slugify(j.company, j.role) });
  }
  scored.sort((a, b) => b.score - a.score);
  const usedCo = new Map();
  const out = [];
  for (const j of scored) {
    const co = norm(j.company).slice(0, 24);
    const n = usedCo.get(co) || 0;
    if (n >= 2) continue;
    usedCo.set(co, n + 1);
    out.push(j);
    if (out.length >= 90) break;
  }
  return out;
}

const hist = loadRecentFromHistory();
const pipe = loadRecentFromPipeline();
const pool = pick([...hist, ...pipe]);
writeFileSync('batch/pack-ft-24h-pool.json', JSON.stringify(pool, null, 2));
process.stderr.write(`pool ${pool.length} hist ${hist.length} pipe ${pipe.length}\n`);

mkdirSync('output/_pack-ft24', { recursive: true });
mkdirSync('jds', { recursive: true });
const workdir = resolve('output/_pack-ft24');
const keep = [];
const drop = [];

for (const job of pool) {
  if (keep.length >= TARGET) break;
  process.stderr.write(`JD ${job.slug}\n`);
  const jd = await fetchJd(job);
  if (jd.startsWith('ERROR')) {
    drop.push({ slug: job.slug, reason: jd });
    continue;
  }
  if (jd.length < 80) {
    drop.push({ slug: job.slug, reason: 'empty-or-dead' });
    continue;
  }
  if (germanAboveA2(jd)) {
    drop.push({ slug: job.slug, reason: 'german-above-a2' });
    continue;
  }
  if (germanOnly(jd)) {
    drop.push({ slug: job.slug, reason: 'german-body' });
    continue;
  }
  if (notGermany(job.loc, jd)) {
    drop.push({ slug: job.slug, reason: 'not-germany' });
    continue;
  }
  if (certFinance(job.role, jd)) {
    drop.push({ slug: job.slug, reason: 'cert-finance-or-econometrics' });
    continue;
  }
  const kws = keywordsFrom(`${jd} ${job.role}`);
  keep.push({ ...job, kws, jd: jd.slice(0, 4000) });
  writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
}

writeFileSync('batch/pack-ft-24h.json', JSON.stringify(keep.map((j) => ({
  slug: j.slug, company: companyName(j), role: j.role, city: j.city, url: j.url, kws: j.kws,
})), null, 2));
writeFileSync('batch/pack-ft-24h-drop.json', JSON.stringify(drop, null, 2));

const manifest = [];
for (const job of keep) {
  const group = classify(job);
  const payload = buildPayload(job, group, job.kws);
  const cvJson = resolve(workdir, `cv-${job.slug}.json`);
  const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
  const cvPdf = resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(cvJson, JSON.stringify(payload));
  execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml, CV_TPL], { stdio: 'inherit' });
  try {
    execFileSync(process.execPath, ['verify-ats.mjs', cvHtml, '--role', job.role, '--keywords', job.kws.join(','), '--min-score', '70'], { stdio: 'inherit' });
  } catch {
    process.stderr.write(`ATS warn ${job.slug}\n`);
  }
  manifest.push({ input: cvHtml, output: cvPdf, format: 'a4' });
  const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
  const coverPdf = resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(coverHtml, buildCoverHtml(coverFor(job, group, job.jd, job.kws)));
  manifest.push({ input: coverHtml, output: coverPdf, format: 'a4' });
}

const manPath = resolve(workdir, 'manifest.json');
writeFileSync(manPath, JSON.stringify(manifest, null, 2));
if (manifest.length) {
  execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
}
try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }
console.log(JSON.stringify({ kept: keep.length, dropped: drop.length, pdfs: manifest.length }, null, 2));
