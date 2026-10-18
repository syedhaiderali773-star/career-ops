#!/usr/bin/env node
/**
 * Last-24h intern / working-student packs. Germany only.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import {
  classify, keywordsFrom, coverFor, buildPayload, fetchJd, companyName, DATE, CV_TPL,
} from './redesign-pack-80.mjs';

const TARGET = 40;
const APPLIED = [
  'tytan technologies', 'tactilia', 'marvel fusion', 'sap', 'solaris', 'ctrl qs',
  'munich re', 'siemens energy', 'unternehmertum', 'westwing', 'upvest', 'jd.com',
  'celonis', 'borgwarner', 'fresenius', 'airbus', 'samsung', 'peec', 'heidelberg',
  'dyson', 'lemon.markets', 'taktile', 'tourlane', 'statista', 'xometry',
  'lightspeed', 'lucanet', 'flexport', 'pigment', 'dun & bradstreet', 'almedia',
  'yepoda', 'mirakl', 'numa',
].map((s) => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim());

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function germanAboveA2(text) {
  return /german\s*(b1|b2|c1|c2)\b.{0,40}(?:required|mandatory|erforderlich|must)|(?:required|mandatory|must|erforderlich).{0,40}german\s*(b1|b2|c1|c2)|fluency in german|fluent(?:ly)? in german|fluent german required|business[- ]fluent german|professional german required|excellent german required|very good german required|native(?:-level)? german|german native speaker|good knowledge of german|german c2|deutsch\s*(b1|b2|c1|c2).{0,20}(?:erforderlich|required)|flie[sß]ende deutschkenntnisse|verhandlungssicheres deutsch|muttersprachliches deutsch|sehr gute deutsch(?:kenntnisse)?|deutsch zwingend|working language.{0,25}german.{0,15}(?:required|must)/i.test(text || '');
}

function germanOnly(text) {
  const de = (String(text || '').match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (String(text || '').match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}

function certFinance(role, jd) {
  return /econometrics|\bcfa\b|\bcpa\b|\bacca\b|steuerberater|wirtschaftsprüfer|chartered accountant|qualified accountant|cfa required|cpa required/.test(`${role} ${jd}`.toLowerCase());
}

function foreignPlace(loc, url, jd) {
  const locUrl = `${loc} ${url}`.toLowerCase();
  if (/mexico|méxico|monterrey|pennsylvania|amsterdam|netherlands|lisbon|portugal|glasgow|london|massachusetts|brockton|florida|united-states|united states|\busa\b|new-york|san-francisco/i.test(locUrl)) return true;
  if (/addressCountry.: .(NL|US|GB|MX|PT|FR|ES|IT|PL|IN|PK)./i.test(jd || '')) return true;
  if (/\b(location:\s*mexico|based in mexico|office in mexico|hamburg-pennsylvania)\b/i.test(`${loc} ${url} ${jd}`)) return true;
  const t = `${loc} ${jd}`.toLowerCase();
  if (!/germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|nuremberg|nürnberg|garching|karlsruhe|heidelberg|aachen|mannheim|darmstadt|dortmund|essen|bremen|dresden|hannover|ingolstadt|kassel|augsburg|mainz|feucht|wustermark|remote germany|hybrid germany|deutschlandweit/i.test(t)) {
    return true;
  }
  return false;
}

function jdPosted(text) {
  const m = String(text || '').match(/datePosted["']?\s*[:=]\s*["']?(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : '';
}

function recentEnough(posted, arbeitnow) {
  if (posted === '2026-09-22' || posted === '2026-09-21') return true;
  if (!posted && !arbeitnow) return true;
  return false;
}

function isIntern(role) {
  if (/internal/i.test(role) && !/(werkstudent|working student|praktikum|internship|(^|[^a-z])intern([^a-z]|$))/i.test(role)) return false;
  return /(werkstudent|working student|praktikum|praktikant|internship|(^|[^a-z])intern([^a-z]|$)|student assistant)/i.test(role);
}

function internType(role) {
  if (/werkstudent|working student|student assistant/i.test(role)) return 'WS';
  return 'Intern';
}

function slugify(company, role) {
  return `ws24-${`${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function alreadyApplied(company) {
  const c = norm(company);
  return APPLIED.some((a) => c.includes(a) || a.includes(c.slice(0, 16)));
}

function internScore(j) {
  const t = `${j.role} ${j.loc}`.toLowerCase();
  let s = 0;
  if (/analyst|analytics|operations|procurement|supply chain|logistics|marketing|strategy|people|human resources|hr |commercial|pricing|product|business/.test(t)) s += 12;
  if (/working student|werkstudent/.test(t)) s += 8;
  if (/internship|praktikum|praktikant|(^|[^a-z])intern([^a-z]|$)/.test(t)) s += 8;
  if (/munich|münchen/.test(t)) s += 8;
  if (/berlin|hamburg|frankfurt/.test(t)) s += 4;
  if (/founder/.test(t)) s += 4;
  if (/software engineer|developer|firmware|data scientist/.test(t)) s -= 20;
  if (/\bsr\.|\bsenior\b|director|head of|principal/.test(t)) s -= 40;
  return s;
}

function unpaidFounder(role, jd) {
  return /founder/.test(`${role} ${jd}`.toLowerCase()) && /unpaid|unvergütet|ohne vergütung|equity only|equity-only/.test(`${role} ${jd}`.toLowerCase());
}

function loadHistory() {
  const text = readFileSync('data/scan-history.tsv', 'utf8');
  const jobs = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const [url, , , title, company, , location, , postedAt] = cols;
    const posted = String(postedAt || '').slice(0, 10);
    if (posted !== '2026-09-22' && posted !== '2026-09-21') continue;
    if (!url || !title) continue;
    if (!isIntern(title)) continue;
    jobs.push({
      url,
      company: company || 'Company',
      role: title,
      loc: location || '',
      posted,
      city: (location || 'Germany').split(/[·,;]/)[0].trim() || 'Germany',
      arbeitnow: /arbeitnow\.com/i.test(url),
    });
  }
  return jobs;
}

function pick(jobs) {
  const scored = [];
  const seenUrl = new Set();
  for (const j of jobs) {
    const key = j.url.replace(/\/$/, '').split('?')[0].toLowerCase();
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    if (alreadyApplied(j.company)) continue;
    if (foreignPlace(j.loc, j.url, '')) continue;
    const score = internScore(j);
    if (score < 8) continue;
    scored.push({
      ...j,
      score,
      track: 'intern',
      type: internType(j.role),
      slug: slugify(j.company, j.role),
    });
  }
  scored.sort((a, b) => {
    if (a.arbeitnow !== b.arbeitnow) return a.arbeitnow ? 1 : -1;
    return b.score - a.score;
  });
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

const pool = pick(loadHistory());
writeFileSync('batch/pack-intern-24h-pool.json', JSON.stringify(pool, null, 2));
process.stderr.write(`pool ${pool.length}\n`);

mkdirSync('output/_pack-ws24', { recursive: true });
mkdirSync('jds', { recursive: true });
const workdir = resolve('output/_pack-ws24');
const keep = [];
const drop = [];

for (const job of pool) {
  if (keep.length >= TARGET) break;
  process.stderr.write(`JD ${job.slug}\n`);
  await sleep(1000);
  const jd = await fetchJd(job);
  if (jd.startsWith('ERROR')) {
    drop.push({ slug: job.slug, reason: jd });
    continue;
  }
  if (jd.length < 80) {
    drop.push({ slug: job.slug, reason: 'empty-or-dead' });
    continue;
  }
  const posted = jdPosted(jd);
  if (!recentEnough(posted, job.arbeitnow)) {
    drop.push({ slug: job.slug, reason: `stale-jd ${posted || 'nodate'}` });
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
  if (foreignPlace(job.loc, job.url, jd)) {
    drop.push({ slug: job.slug, reason: 'not-germany' });
    continue;
  }
  if (certFinance(job.role, jd)) {
    drop.push({ slug: job.slug, reason: 'cert-finance-or-econometrics' });
    continue;
  }
  if (unpaidFounder(job.role, jd)) {
    drop.push({ slug: job.slug, reason: 'unpaid-founder' });
    continue;
  }
  const kws = keywordsFrom(`${jd} ${job.role}`);
  keep.push({ ...job, kws, jd: jd.slice(0, 4000) });
  writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
}

writeFileSync('batch/pack-intern-24h.json', JSON.stringify(keep.map((j) => ({
  slug: j.slug,
  company: companyName(j),
  role: j.role,
  city: j.city,
  type: j.type,
  url: j.url,
  kws: j.kws,
})), null, 2));
writeFileSync('batch/pack-intern-24h-drop.json', JSON.stringify(drop, null, 2));

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
