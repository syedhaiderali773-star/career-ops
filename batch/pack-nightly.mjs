#!/usr/bin/env node
/**
 * Last-24h morning list. 40% intern/WS, 60% full-time. 70–100 roles. English title, Germany, A2, live JD.
 * ATS audit tailors CV/cover to each JD — advisory only, never a drop gate.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import { localToday } from '../lib/local-today.mjs';
import { isMainModule } from '../lib/is-main-module.mjs';
import { checkLivenessViaApi } from '../liveness-api.mjs';
import { classifyLiveness } from '../liveness-core.mjs';
import { auditAts } from '../verify-ats.mjs';
import {
  classify, keywordsFrom, coverFor, buildPayload, fetchJd, companyName, CV_TPL,
} from './redesign-pack-80.mjs';

const MIN_TOTAL = 70;
const MAX_TOTAL = 100;
const INTERN_SHARE = 0.4;
const FT_SHARE = 0.6;
const DATE = localToday();

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const YDAY = yesterday();

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

function germanTitle(title) {
  const cleaned = String(title || '').replace(/\((?:m\/w\/d|m\/f\/d|f\/m\/d|w\/m\/d|d\/f\/m|all genders|all genders welcome)\)/gi, '');
  return /[äöüß]|praktikum|praktikant|pflichtpraktikum|werkstudent|einkäufer|projektleiter|sachbearbeiter|vertriebsmitarbeiter|mitarbeiter|referent:in|assistent:in|teamassistenz|teamleiter|ausbildung|duales studium|kundenberater|buchhalter|sachbearbeitung/i.test(cleaned);
}

function certFinance(role, jd) {
  return /econometrics|\bcfa\b|\bcpa\b|\bacca\b|steuerberater|wirtschaftsprüfer|chartered accountant|qualified accountant|cfa required|cpa required/.test(`${role} ${jd}`.toLowerCase());
}

const FOREIGN = /mexico|méxico|monterrey|pennsylvania|amsterdam|netherlands|lisbon|portugal|glasgow|london|massachusetts|brockton|florida|united-states|united states|\busa\b|new-york|san-francisco|vienna|wien|zurich|zürich|warsaw|madrid|milan|paris|dublin|stockholm|copenhagen|prague|brussels|luxembourg|singapore|shanghai|tokyo|dubai|toronto|sydney|austria|switzerland|poland|spain|italy|france|sweden|denmark|ireland|belgium|india|pakistan|uk\/|\/gb\/|united-kingdom/;
const GERMANY = /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|leipzig|nuremberg|nürnberg|garching|karlsruhe|heidelberg|aachen|mannheim|darmstadt|dortmund|essen|bremen|dresden|hannover|ingolstadt|kassel|augsburg|mainz|feucht|wustermark|remote germany|hybrid germany|deutschlandweit/;

function foreignPlace(loc, url, jd) {
  const locUrl = `${loc} ${url}`.toLowerCase();
  if (FOREIGN.test(locUrl)) return true;
  if (/addressCountry.: .(NL|US|GB|MX|PT|FR|ES|IT|PL|IN|PK|AT|CH|SE|DK|IE|BE|LU|SG)./i.test(jd || '')) return true;
  const t = `${loc} ${jd}`.toLowerCase();
  if (FOREIGN.test(t) && !GERMANY.test(t)) return true;
  if (!GERMANY.test(t)) return true;
  return false;
}

async function linkLive(url) {
  const api = await checkLivenessViaApi(url);
  if (api?.result === 'expired') return { ok: false, reason: api.reason };
  if (api?.result === 'active') return { ok: true, reason: api.reason };
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 career-ops' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    const cls = classifyLiveness({
      status: r.status,
      requestedUrl: url,
      finalUrl: r.url,
      bodyText: text.slice(0, 20000),
    });
    if (cls.result === 'expired') return { ok: false, reason: cls.reason };
    if (r.status === 404 || r.status === 410) return { ok: false, reason: `http ${r.status}` };
    return { ok: true, reason: cls.reason || `http ${r.status}` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function jdPosted(text) {
  const m = String(text || '').match(/datePosted["']?\s*[:=]\s*["']?(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : '';
}

function recentEnough(posted, arbeitnow) {
  if (posted === DATE || posted === YDAY) return true;
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

function slugify(prefix, company, role) {
  return `${prefix}-${`${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadApplied() {
  const path = existsSync('data/applications.md') ? 'data/applications.md' : 'applications.md';
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || line.includes('| # |')) continue;
    const cols = line.split('|').map((c) => c.trim());
    if (cols[6] === 'Applied' && cols[3]) out.push(norm(cols[3]));
  }
  return out;
}

function alreadyApplied(company, applied) {
  const c = norm(company);
  return applied.some((a) => c.includes(a) || a.includes(c.slice(0, 16)));
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

function unpaidFounder(role, jd) {
  return /founder/.test(`${role} ${jd}`.toLowerCase()) && /unpaid|unvergütet|ohne vergütung|equity only|equity-only/.test(`${role} ${jd}`.toLowerCase());
}

function asJob(url, company, title, location, posted) {
  const intern = isIntern(title);
  return {
    url,
    company: company || 'Company',
    role: title,
    loc: location || '',
    posted: posted || '',
    city: (location || 'Germany').split(/[·,;]/)[0].trim() || 'Germany',
    arbeitnow: /arbeitnow\.com/i.test(url),
    intern,
  };
}

function keepForTrack(job, track) {
  if (!job.url || !job.role) return false;
  if (job.posted && job.posted !== DATE && job.posted !== YDAY) return false;
  if (germanTitle(job.role)) return false;
  if (track === 'intern' && !job.intern) return false;
  if (track === 'ft' && job.intern) return false;
  return true;
}

function looksLikeJobUrl(url, title) {
  const u = String(url || '').toLowerCase();
  const t = String(title || '').toLowerCase();
  if (/investor|analyst coverage|analyst recommendation|share\/analyst|\/blog-|airbus-faces|magazine|jobcategory|\/teams\/|students-graduates$|entry-opportunities|life-at-|work-areas|overview/.test(`${u} ${t}`)) return false;
  return /myworkdayjobs|greenhouse|lever\.co|ashbyhq|smartrecruiters|personio|join\.com|recruitee|pinpoint|successfactors|icims|\/job\/|\/jobs\/|jobid=|job\.html\?|stellenangebot|requisition/.test(u);
}

function loadHistory() {
  if (!existsSync('data/scan-history.tsv')) return [];
  const jobs = [];
  for (const line of readFileSync('data/scan-history.tsv', 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const [url, firstSeen, , title, company, , location, , postedAt] = cols;
    const posted = String(postedAt || firstSeen || '').slice(0, 10);
    jobs.push(asJob(url, company, title, location, posted));
  }
  return jobs;
}

function loadPipeline() {
  if (!existsSync('data/pipeline.md')) return [];
  const jobs = [];
  for (const line of readFileSync('data/pipeline.md', 'utf8').split('\n')) {
    if (!line.startsWith('- [ ] http')) continue;
    const parts = line.replace(/^- \[ \] /, '').split('|').map((s) => s.trim());
    const url = parts[0];
    const company = parts[1] || '';
    const title = parts[2] || '';
    const loc = parts[3] && !parts[3].startsWith('posted:') ? parts[3] : '';
    const postedPart = parts.find((p) => p.startsWith('posted:'));
    const posted = postedPart ? postedPart.replace(/^posted:\s*/, '').slice(0, 10) : '';
    jobs.push(asJob(url, company, title, loc, posted));
  }
  return jobs;
}

function loadExcel() {
  const path = 'data/excel-career-hits.md';
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const finished = (text.match(/Finished:\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
  if (finished && finished !== DATE) return [];
  const jobs = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || line.includes('| Sheet |')) continue;
    const cols = line.split('|').map((c) => c.trim());
    const company = cols[2];
    const title = cols[3];
    const loc = cols[4];
    const url = cols[6];
    if (!looksLikeJobUrl(url, title)) continue;
    jobs.push(asJob(url, company, title, loc, DATE));
  }
  return jobs;
}

function loadAll(track) {
  return [...loadHistory(), ...loadPipeline(), ...loadExcel()].filter((j) => keepForTrack(j, track));
}

function urlKey(url) {
  return String(url || '').replace(/\/$/, '').split('?')[0].toLowerCase();
}

function jobKey(company, role) {
  return `${norm(company)}|${norm(role)}`;
}

function loadAlreadyProvided() {
  const urls = new Set();
  const jobs = new Set();
  const files = [
    'batch/pack-nightly.json',
    'batch/pack-ft-24h.json',
    'batch/pack-intern-24h.json',
    'batch/pack-taa-jobs.json',
    'batch/pack-ft-40.json',
    'batch/pack-intern-40.json',
    'batch/pack-40-jobs.json',
  ];
  for (const f of files) {
    if (!existsSync(f)) continue;
    const raw = JSON.parse(readFileSync(f, 'utf8'));
    const rows = Array.isArray(raw)
      ? raw
      : [...(raw.intern || []), ...(raw.ft || []), ...(raw.jobs || [])];
    for (const r of rows) {
      if (r.url) urls.add(urlKey(r.url));
      if (r.company && r.role) jobs.add(jobKey(r.company, r.role));
    }
  }
  return { urls, jobs };
}

function alreadyProvided(j, prior) {
  return prior.urls.has(urlKey(j.url)) || prior.jobs.has(jobKey(j.company, j.role));
}

function pick(jobs, track, applied, prior) {
  const scored = [];
  const seenUrl = new Set();
  for (const j of jobs) {
    const key = urlKey(j.url);
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    if (alreadyProvided(j, prior)) continue;
    if (alreadyApplied(j.company, applied)) continue;
    if (foreignPlace(j.loc, j.url, '')) continue;
    const score = track === 'intern' ? internScore(j) : ftScore(j);
    if (score < 8) continue;
    scored.push({
      ...j,
      score,
      track,
      type: track === 'intern' ? internType(j.role) : 'FT',
      slug: slugify(track === 'intern' ? 'n24ws' : 'n24ft', j.company, j.role),
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
    if (out.length >= 180) break;
  }
  return out;
}

async function gate(pool, limit) {
  const keep = [];
  const drop = [];
  for (const job of pool) {
    if (keep.length >= limit) break;
    process.stderr.write(`JD ${job.slug}\n`);
    const live = await linkLive(job.url);
    if (!live.ok) {
      drop.push({ slug: job.slug, reason: `dead-link ${live.reason}` });
      continue;
    }
    await sleep(400);
    const jd = await fetchJd(job);
    if (jd.startsWith('ERROR') || jd.length < 80) {
      drop.push({ slug: job.slug, reason: jd.startsWith('ERROR') ? jd : 'empty-or-dead' });
      continue;
    }
    const deadJd = classifyLiveness({ status: 200, requestedUrl: job.url, finalUrl: job.url, bodyText: jd });
    if (deadJd.result === 'expired') {
      drop.push({ slug: job.slug, reason: `expired-jd ${deadJd.reason}` });
      continue;
    }
    const posted = jdPosted(jd);
    if (!recentEnough(posted, job.arbeitnow)) {
      drop.push({ slug: job.slug, reason: `stale-jd ${posted || 'nodate'}` });
      continue;
    }
    if (germanAboveA2(jd) || germanOnly(jd) || foreignPlace(job.loc, job.url, jd) || certFinance(job.role, jd) || unpaidFounder(job.role, jd)) {
      drop.push({ slug: job.slug, reason: 'gate' });
      continue;
    }
    const kws = keywordsFrom(`${jd} ${job.role}`);
    keep.push({ ...job, kws, jd: jd.slice(0, 4000) });
    writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
  }
  return { keep, drop };
}

function qualify(keep, workdir) {
  const ok = [];
  const warnings = [];
  for (const job of keep) {
    try {
      const group = classify(job);
      const payload = buildPayload(job, group, job.kws);
      const cvJson = resolve(workdir, `cv-${job.slug}.json`);
      const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
      writeFileSync(cvJson, JSON.stringify(payload));
      execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml, CV_TPL], { stdio: 'inherit' });
      const ats = auditAts(readFileSync(cvHtml, 'utf8'), { role: job.role, keywords: job.kws });
      if (ats.score < 100 || (ats.keywordCoverage && ats.keywordCoverage.percent < 100)) {
        warnings.push({
          slug: job.slug,
          reason: `ats-advisory score ${ats.score} kw ${ats.keywordCoverage?.percent ?? 'n/a'}%`,
        });
      }
      const cover = coverFor(job, group, job.jd, job.kws);
      const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
      writeFileSync(coverHtml, buildCoverHtml(cover));
      ok.push({ ...job, cvHtml, coverHtml, atsScore: ats.score });
    } catch (err) {
      warnings.push({ slug: job.slug, reason: `build ${err.message}` });
    }
  }
  return { ok, warnings };
}

function writePdfs(keep, workdir) {
  const manifest = [];
  for (const job of keep) {
    const cvHtml = job.cvHtml || resolve(workdir, `cv-${job.slug}.html`);
    const coverHtml = job.coverHtml || resolve(workdir, `cover-${job.slug}.html`);
    manifest.push({ input: cvHtml, output: resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
    manifest.push({ input: coverHtml, output: resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`), format: 'a4' });
  }
  const manPath = resolve(workdir, 'manifest.json');
  writeFileSync(manPath, JSON.stringify(manifest, null, 2));
  if (manifest.length) {
    execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
  }
  return manifest.length;
}

function chartRow(i, j) {
  const cv = `cv-syed-haider-ali-${j.slug}-${DATE}.pdf`;
  const cover = `cover-syed-haider-ali-${j.slug}-${DATE}.pdf`;
  return `| ${i} | ${companyName(j)} | ${j.role} | ${j.city} | ${j.type} | [Apply](${j.url}) | \`${cv}\` | \`${cover}\` |`;
}

function mix40_60(internKeep, ftKeep) {
  const total = Math.min(
    MAX_TOTAL,
    Math.floor(internKeep.length / INTERN_SHARE),
    Math.floor(ftKeep.length / FT_SHARE),
  );
  const internN = Math.min(internKeep.length, Math.round(total * INTERN_SHARE));
  const ftN = Math.min(ftKeep.length, total - internN);
  return { intern: internKeep.slice(0, internN), ft: ftKeep.slice(0, ftN), total: internN + ftN };
}

async function main() {
  const applied = loadApplied();
  const prior = loadAlreadyProvided();
  mkdirSync('jds', { recursive: true });
  mkdirSync('output', { recursive: true });
  const internPool = pick(loadAll('intern'), 'intern', applied, prior);
  const ftPool = pick(loadAll('ft'), 'ft', applied, prior);
  writeFileSync('batch/pack-nightly-pool.json', JSON.stringify({ intern: internPool, ft: ftPool }, null, 2));

  const internCapped = 80;
  const ftCapped = 120;
  const intern = await gate(internPool, internCapped);
  const ft = await gate(ftPool, ftCapped);

  const workdir = resolve('output/_pack-nightly');
  mkdirSync(workdir, { recursive: true });
  const internQ = qualify(intern.keep, workdir);
  const ftQ = qualify(ft.keep, workdir);
  const mixed = mix40_60(internQ.ok, ftQ.ok);
  const pdfs = writePdfs([...mixed.intern, ...mixed.ft], workdir);
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }

  const chart = [
    `# Nightly last-24h pack — ${DATE}`,
    '',
    `Total: ${mixed.total} · Intern/WS: ${mixed.intern.length} (40%) · Full-time: ${mixed.ft.length} (60%)`,
    '',
    '## Intern / working student',
    '',
    '| # | Company | Role | City | Type | Apply | CV | Cover |',
    '|---|---|---|---|---|---|---|---|',
    ...mixed.intern.map((j, i) => chartRow(i + 1, j)),
    '',
    '## Full-time',
    '',
    '| # | Company | Role | City | Type | Apply | CV | Cover |',
    '|---|---|---|---|---|---|---|---|',
    ...mixed.ft.map((j, i) => chartRow(mixed.intern.length + i + 1, j)),
    '',
  ].join('\n');
  writeFileSync(`output/nightly-${DATE}.md`, chart);
  writeFileSync('batch/pack-nightly.json', JSON.stringify({
    date: DATE,
    intern: mixed.intern.map((j) => ({ slug: j.slug, company: companyName(j), role: j.role, url: j.url })),
    ft: mixed.ft.map((j) => ({ slug: j.slug, company: companyName(j), role: j.role, url: j.url })),
  }, null, 2));
  writeFileSync('batch/pack-nightly-drop.json', JSON.stringify({
    intern: intern.drop,
    ft: ft.drop,
    internWarnings: internQ.warnings,
    ftWarnings: ftQ.warnings,
  }, null, 2));
  console.log(JSON.stringify({
    date: DATE,
    intern: mixed.intern.length,
    ft: mixed.ft.length,
    total: mixed.total,
    internDropped: intern.drop.length,
    ftDropped: ft.drop.length,
    internWarnings: internQ.warnings.length,
    ftWarnings: ftQ.warnings.length,
    pdfs,
    chart: `output/nightly-${DATE}.md`,
  }, null, 2));
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
