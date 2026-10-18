#!/usr/bin/env node
/**
 * Read every Excel sheet, including hyperlink Targets (not cell text),
 * detect ATS from career pages, pull jobs, write matches.
 * Output: data/excel-career-hits.md
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { appendToPipeline, appendToScanHistory, loadSeenUrls } from '../scan.mjs';
import { localToday } from '../lib/local-today.mjs';

const XLSX =
  process.env.EXCEL_PATH ||
  'C:\\Users\\syedh\\OneDrive\\Desktop\\CV\\german_finance_analyst_career_companies_updated_with_fintechs.xlsx';
const ROOT = process.cwd();
const TMP = join(ROOT, 'data', '.excel-scan-tmp');
const OUT = join(ROOT, 'data', 'excel-career-hits.md');

const POS = [
  'trainee', 'analyst', 'associate', 'graduate', 'junior', 'coordinator',
  'business analyst', 'data analyst', 'supply chain',
  'operations', 'marketing', 'strategy', 'finance', 'fp&a', 'controlling',
  'human resources', 'people operations', 'people partner', 'hr business',
  'procurement', 'logistics', 'demand planning', 'commercial',
  'business intelligence', 'business development', 'account executive',
  'customer success', 'pmo', 'crm', 'founder', 'implementation',
  'berufseinsteiger', 'direkt einstieg', 'absolvent', 'traineeprogramm',
  'internship', 'intern (', 'intern -', 'intern/',
  'praktikum', 'praktikant', 'werkstudent', 'working student', 'student assistant',
];
const NEG = [
  'software engineer', 'developer', 'frontend', 'backend', 'full stack',
  'fullstack', 'firmware', 'embedded', 'director', 'vice president',
  'principal', 'head of', 'chief ', 'schüler', 'schueler', 'ausbildung', 'apprentice',
];
function looksLikeJobUrl(url, title) {
  const u = String(url || '').toLowerCase();
  const t = String(title || '').toLowerCase();
  if (/investor|analyst coverage|analyst recommendation|share\/analyst|\/blog-|airbus-faces|magazine|jobcategory|\/teams\/|students-graduates$|entry-opportunities|life-at-|work-areas|overview/.test(`${u} ${t}`)) return false;
  return /myworkdayjobs|greenhouse|lever\.co|ashbyhq|smartrecruiters|personio|join\.com|recruitee|pinpoint|successfactors|icims|\/job\/|\/jobs\/|jobid=|job\.html\?|stellenangebot|requisition/.test(u);
}

const DE_LOC = /germany|deutschland|\bde\b|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|nuremberg|nürnberg|dortmund|essen|bremen|dresden|hannover|aachen|karlsruhe|mannheim|freiburg|augsburg|heidelberg|garching|deutschlandweit|dach/i;
const BLOCK_LOC = /india|bengaluru|bangalore|pakistan|karachi|united kingdom|\blondon\b|united states|\bUSA\b|new york|san francisco|poland|warsaw|netherlands|amsterdam|switzerland|zurich|zürich|austria|vienna|wien|spain|barcelona|madrid|italy|milan|canada|france|\bparis\b|japan|brazil|australia|indonesia|panama|colombia|mexico|méxico|monterrey|guadalajara|westwood|hooksett|berlin,\s*ct/i;

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseSharedStrings(xml) {
  const strings = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]));
    strings.push(texts.join(''));
  }
  return strings;
}

function colRow(ref) {
  const m = String(ref).match(/^([A-Z]+)(\d+)$/);
  return m ? { col: m[1], row: Number(m[2]) } : null;
}

function parseSheet(xml, sst) {
  const rows = new Map();
  const re = /<c r="([A-Z]+\d+)"([^>]*)>(?:[\s\S]*?<v>([\s\S]*?)<\/v>)?/g;
  let m;
  while ((m = re.exec(xml))) {
    const pos = colRow(m[1]);
    if (!pos) continue;
    const attrs = m[2] || '';
    const t = (attrs.match(/\bt="([^"]*)"/) || [])[1] || '';
    let val = decode(m[3] || '');
    if (t === 's') val = sst[Number(m[3])] || '';
    if (t === 'inlineStr') continue;
    if (!rows.has(pos.row)) rows.set(pos.row, {});
    rows.get(pos.row)[pos.col] = val;
  }
  return rows;
}

function parseHyperlinks(sheetXml, relsXml) {
  const ridToUrl = {};
  if (relsXml) {
    for (const x of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      if (/^https?:/i.test(x[2])) ridToUrl[x[1]] = decode(x[2]);
    }
  }
  const byRow = new Map();
  const re = /<hyperlink\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(sheetXml))) {
    const attrs = m[1] || '';
    const ref = (attrs.match(/\bref="([A-Z]+)(\d+)"/) || [])[2];
    const rid = (attrs.match(/\br:id="([^"]+)"/) || [])[1];
    const display = (attrs.match(/\bdisplay="([^"]+)"/) || [])[1];
    const url = (rid && ridToUrl[rid]) || (display && /^https?:/i.test(display) ? display : '');
    if (!ref || !url) continue;
    const row = Number(ref);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(url);
  }
  return byRow;
}

function extractRows() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const zip = join(TMP, 'book.zip');
  execSync(`Copy-Item -LiteralPath "${XLSX}" -Destination "${zip}" -Force`, { shell: 'powershell.exe' });
  execSync(`tar -xf "${zip}" -C "${TMP}"`);
  const sst = parseSharedStrings(readFileSync(join(TMP, 'xl', 'sharedStrings.xml'), 'utf8'));
  const wb = readFileSync(join(TMP, 'xl', 'workbook.xml'), 'utf8');
  const sheets = [...wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
    .map((x) => ({ name: x[1], rid: x[2] }));
  const rels = readFileSync(join(TMP, 'xl', '_rels', 'workbook.xml.rels'), 'utf8');
  const ridToPath = {};
  for (const x of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    ridToPath[x[1]] = join(TMP, 'xl', ...x[2].replace(/^\//, '').split('/'));
  }
  const companies = [];
  for (const sh of sheets) {
    const sheetPath = ridToPath[sh.rid];
    if (!sheetPath || !existsSync(sheetPath)) continue;
    const sheetXml = readFileSync(sheetPath, 'utf8');
    const rows = parseSheet(sheetXml, sst);
    const relsPath = join(dirname(sheetPath), '_rels', `${basename(sheetPath)}.rels`);
    const relsXml = existsSync(relsPath) ? readFileSync(relsPath, 'utf8') : '';
    const hyperByRow = parseHyperlinks(sheetXml, relsXml);
    const headerRow = [...rows.keys()].sort((a, b) => a - b)[0];
    const header = rows.get(headerRow) || {};
    const cols = Object.keys(header);
    const nameCol = cols.find((c) => /company|name|firma/i.test(header[c])) || 'A';
    for (const [rowNum, cells] of rows) {
      if (rowNum === headerRow) continue;
      const name = String(cells[nameCol] || '').trim();
      const urls = [];
      for (const c of cols) {
        const v = String(cells[c] || '');
        urls.push(...(v.match(/https?:\/\/[^\s<>"]+/gi) || []));
      }
      for (const u of hyperByRow.get(rowNum) || []) urls.push(u);
      const unique = [...new Set(urls.map((u) => u.replace(/[),.;]+$/, '')))];
      if (!name && !unique.length) continue;
      companies.push({ sheet: sh.name, name: name || '(no name)', urls: unique });
    }
  }
  return companies;
}

function keepTitle(title) {
  const t = title.toLowerCase();
  if (NEG.some((k) => t.includes(k))) return false;
  const internWord = /(^|[^a-z])intern([^a-z]|$)/i.test(title);
  return internWord || POS.some((k) => t.includes(k));
}

function keepLoc(loc) {
  const s = String(loc || '');
  if (/berlin,\s*ct|westwood|hooksett|ciudad de panama|bogot/i.test(s)) return false;
  if (!s.trim()) return true;
  if (BLOCK_LOC.test(s) && !DE_LOC.test(s)) return false;
  return DE_LOC.test(s) || /remote|hybrid|emea|europe|dach/i.test(s);
}

function germanOnly(text) {
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}

function germanAboveA2(text) {
  if (!text) return false;
  return /german\s*(b1|b2|c1|c2)\b.{0,30}(?:required|mandatory|erforderlich|must)|(?:required|mandatory|must|erforderlich).{0,40}german\s*(b1|b2|c1|c2)|fluency in german|fluent(?:ly)? in german|fluent german required|business[- ]fluent german|professional german required|excellent german required|very good german required|native(?:-level)? german|german native speaker|good knowledge of german|deutsch\s*(b1|b2|c1|c2).{0,20}(?:erforderlich|required)|flie[sß]ende deutschkenntnisse|verhandlungssicheres deutsch|muttersprachliches deutsch|sehr gute deutschkenntnisse|deutsch zwingend erforderlich/i.test(text);
}

function jobsFromHtml(html, pageUrl) {
  let base;
  try { base = new URL(pageUrl); } catch { return []; }
  const jobs = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 8 || text.length > 140) continue;
    if (!keepTitle(text)) continue;
    let href = decode(m[1]);
    if (href.startsWith('/')) href = `${base.origin}${href}`;
    if (!/^https?:/i.test(href)) continue;
    if (!/job|career|karriere|position|vacanc|intern|werkstudent|praktikum|trainee|analyst|apply/i.test(`${href} ${text}`)) continue;
    jobs.push({ title: text, loc: '', href, desc: '' });
  }
  const seen = new Set();
  const uniq = [];
  for (const j of jobs) {
    const k = j.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(j);
  }
  return uniq.slice(0, 40);
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 career-ops' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 career-ops', accept: 'text/html' },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(String(r.status));
  return { url: r.url, html: await r.text() };
}

function jobsFromUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const parts = path.split('/').filter(Boolean);
  if (host.includes('greenhouse.io')) {
    const slug = host.startsWith('job-boards') ? parts[0] : parts[0];
    if (slug && !/^(jobs|embed|v1)$/i.test(slug)) {
      return { kind: 'gh', api: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` };
    }
  }
  if (host === 'jobs.ashbyhq.com' || host.endsWith('.ashbyhq.com')) {
    const slug = parts[0];
    if (slug) return { kind: 'ashby', api: `https://api.ashbyhq.com/posting-api/job-board/${slug}` };
  }
  if (host.includes('lever.co')) {
    const slug = parts[0];
    if (slug) return { kind: 'lever', api: `https://api.lever.co/v0/postings/${slug}?mode=json` };
  }
  if (host.includes('myworkdayjobs.com')) {
    return { kind: 'wd', url };
  }
  if (host.includes('smartrecruiters.com')) {
    const slug = parts.filter((p) => p && p !== 'otys') .pop();
    if (slug) return { kind: 'sr', api: `https://api.smartrecruiters.com/v1/companies/${slug}/postings` };
  }
  if (host.endsWith('.recruitee.com')) {
    return { kind: 'rt', api: `https://${host}/api/offers` };
  }
  if (host.endsWith('.pinpointhq.com')) {
    return { kind: 'pin', api: `https://${host}/postings.json` };
  }
  if (host.endsWith('.jobs.personio.de') || host.endsWith('.jobs.personio.com')) {
    const slug = host.split('.')[0];
    return { kind: 'personio', api: `https://${slug}.jobs.personio.de/xml` };
  }
  if (host.includes('personio.de') && parts[0] === 'job') {
    return { kind: 'page', url };
  }
  if (host.includes('workable.com')) {
    const slug = parts[0] || host.split('.')[0];
    return { kind: 'workable', api: `https://apply.workable.com/api/v1/widget/accounts/${slug}` };
  }
  if (host.endsWith('.teamtailor.com')) {
    return { kind: 'page', url };
  }
  if (host === 'join.com' && /\/companies\//.test(path)) {
    return { kind: 'join', url };
  }
  if (host.includes('amazon.jobs')) {
    return { kind: 'amazon', api: 'https://www.amazon.jobs/en/search.json?base_query=&loc_query=Germany&offset=0&result_limit=100&sort=relevant' };
  }
  return { kind: 'page', url };
}

function specsFromHtml(html, pageUrl) {
  const specs = [];
  const seen = new Set();
  const add = (spec) => {
    if (!spec || !spec.api && spec.kind !== 'wd') return;
    const key = spec.api || spec.url;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push(spec);
  };
  for (const m of html.matchAll(/job-boards(?:\.eu)?\.greenhouse\.io\/([a-z0-9_-]+)/gi)) {
    if (!/^(jobs|embed)$/i.test(m[1])) add({ kind: 'gh', api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs` });
  }
  for (const m of html.matchAll(/boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?([a-z0-9_-]+)/gi)) {
    if (!/^(v1|boards|embed|jobs)$/i.test(m[1])) add({ kind: 'gh', api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs` });
  }
  for (const m of html.matchAll(/greenhouse\.io\/embed\/job_board\?for=([a-z0-9_-]+)/gi)) {
    add({ kind: 'gh', api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs` });
  }
  for (const m of html.matchAll(/ashbyhq\.com\/([a-z0-9_-]+)/gi)) {
    if (m[1] !== 'posting-api') add({ kind: 'ashby', api: `https://api.ashbyhq.com/posting-api/job-board/${m[1]}` });
  }
  for (const m of html.matchAll(/(?:jobs|api)\.lever\.co\/([a-z0-9_-]+)/gi)) {
    add({ kind: 'lever', api: `https://api.lever.co/v0/postings/${m[1]}?mode=json` });
  }
  for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.wd\d\.myworkdayjobs\.com\/[^\s"'<>]+/gi)) {
    add({ kind: 'wd', url: m[0].replace(/&amp;/g, '&') });
  }
  for (const m of html.matchAll(/([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/gi)) {
    add({ kind: 'personio', api: `https://${m[1]}.jobs.personio.de/xml` });
  }
  for (const m of html.matchAll(/smartrecruiters\.com\/(?:[^/]+\/)?([A-Za-z0-9_-]+)/gi)) {
    add({ kind: 'sr', api: `https://api.smartrecruiters.com/v1/companies/${m[1]}/postings` });
  }
  try {
    const u = new URL(pageUrl);
    if (u.hostname.includes('amazon.jobs')) {
      add({ kind: 'page', url: pageUrl });
    }
  } catch { /* ignore */ }
  return specs;
}

async function pull(spec) {
  if (!spec) return [];
  try {
    if (spec.kind === 'amazon') {
      const j = await fetchJson(spec.api);
      return (j.jobs || []).map((x) => ({
        title: x.title,
        loc: (x.city && x.city_name) || x.location || '',
        href: x.url_next_step || (x.id_icims ? `https://www.amazon.jobs/en/jobs/${x.id_icims}` : spec.api),
        desc: x.description || '',
      }));
    }
    if (spec.kind === 'gh') {
      const j = await fetchJson(spec.api);
      return (j.jobs || []).map((x) => ({
        title: x.title,
        loc: (x.location && x.location.name) || '',
        href: x.absolute_url,
        desc: '',
      }));
    }
    if (spec.kind === 'ashby') {
      const j = await fetchJson(spec.api);
      return (j.jobs || j.jobPostings || []).map((x) => ({
        title: x.title,
        loc: x.locationName || (x.location && x.location.name) || '',
        href: x.jobUrl || x.applyUrl || '',
      }));
    }
    if (spec.kind === 'lever') {
      const j = await fetchJson(spec.api);
      return (Array.isArray(j) ? j : []).map((x) => ({
        title: x.text,
        loc: (x.categories && (x.categories.location || x.categories.allLocations)) || '',
        href: x.hostedUrl || x.applyUrl,
      }));
    }
    if (spec.kind === 'sr') {
      const j = await fetchJson(spec.api);
      const list = j.content || j.postings || [];
      return list.map((x) => ({
        title: x.name,
        loc: x.location?.city || [x.location?.city, x.location?.country].filter(Boolean).join(', '),
        href: x.ref || x.applyUrl,
      }));
    }
    if (spec.kind === 'rt') {
      const j = await fetchJson(spec.api);
      return (j.offers || []).map((x) => ({
        title: x.title,
        loc: x.location || x.city || '',
        href: x.careers_url || x.url,
      }));
    }
    if (spec.kind === 'pin') {
      const j = await fetchJson(spec.api);
      return (j.data || []).map((x) => ({
        title: x.title,
        loc: x.location?.name || x.location?.city || '',
        href: x.url,
      }));
    }
    if (spec.kind === 'personio') {
      const r = await fetch(spec.api, {
        headers: { 'user-agent': 'Mozilla/5.0 career-ops' },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return [];
      const xml = await r.text();
      const jobs = [];
      for (const block of xml.split(/<position>/i).slice(1)) {
        const title = (block.match(/<name>([\s\S]*?)<\/name>/i) || [])[1] || '';
        const office = (block.match(/<office>([\s\S]*?)<\/office>/i) || [])[1] || '';
        const id = (block.match(/<id>([\s\S]*?)<\/id>/i) || [])[1] || '';
        const base = spec.api.replace(/\/xml$/, '');
        jobs.push({ title: decode(title), loc: decode(office), href: id ? `${base}/job/${id}` : base });
      }
      return jobs;
    }
    if (spec.kind === 'workable') {
      const j = await fetchJson(spec.api);
      return (j.jobs || []).map((x) => ({
        title: x.title,
        loc: [x.city, x.country].filter(Boolean).join(', '),
        href: x.url || x.shortlink,
      }));
    }
    if (spec.kind === 'wd') {
      const u = new URL(spec.url);
      const tenant = u.hostname.split('.')[0];
      const site = u.pathname.split('/').filter((p) => p && !['en-US', 'de-DE', 'en-GB'].includes(p))[0];
      const api = `${u.origin}/wday/cxs/${tenant}/${site}/jobs`;
      const r = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 career-ops' },
        body: JSON.stringify({ appliedFacets: {}, limit: 40, offset: 0, searchText: 'analyst intern trainee associate' }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.jobPostings || []).map((x) => ({
        title: x.title,
        loc: x.locationsText || x.bulletFields?.join(', ') || '',
        href: x.externalPath ? `${u.origin}${x.externalPath}` : spec.url,
      }));
    }
  } catch {
    return [];
  }
  return [];
}

async function jobsForCompany(c) {
  const urls = c.urls.slice(0, 3);
  for (const url of urls) {
    const spec = jobsFromUrl(url);
    if (spec && spec.kind !== 'page' && spec.kind !== 'join') {
      const found = await pull(spec);
      if (found.length) return { found, via: spec.kind };
    }
  }
  for (const url of urls) {
    try {
      const page = await fetchText(url);
      const specs = specsFromHtml(page.html, page.url);
      for (const spec of specs.slice(0, 3)) {
        const found = await pull(spec);
        if (found.length) return { found, via: `html:${spec.kind}` };
      }
      const scraped = jobsFromHtml(page.html, page.url);
      if (scraped.length) return { found: scraped, via: 'html-links' };
    } catch {
      continue;
    }
  }
  return { found: [], via: 'none' };
}

async function main() {
  const started = new Date().toISOString();
  writeFileSync(OUT, `# Excel career-page scan\n\nStarted: ${started}\nStatus: running\n`);
  const companies = extractRows();
  const withUrl = companies.filter((c) => c.urls.length).length;
  console.log(JSON.stringify({ companies: companies.length, withUrl, sample: companies.slice(0, 3).map((c) => ({ name: c.name, urls: c.urls })) }));
  const hits = [];
  const skipped = [];
  let apiHits = 0;
  let i = 0;
  for (const c of companies) {
    i += 1;
    if (i % 10 === 0 || i === 1) {
      writeFileSync(
        OUT,
        `# Excel career-page scan\n\nStarted: ${started}\nStatus: running (${i}/${companies.length}) last=${c.name}\nCompanies with a URL: ${withUrl}\nCareer pages that returned jobs: ${apiHits}\nHits so far: ${hits.length}\n`,
      );
    }
    if (!c.urls.length) {
      skipped.push(`${c.sheet}\t${c.name}\tno career URL`);
      continue;
    }
    const { found, via } = await jobsForCompany(c);
    if (!found.length) {
      skipped.push(`${c.sheet}\t${c.name}\tvisited; no jobs readable (${c.urls[0]})`);
      continue;
    }
    apiHits += 1;
    const kept = found.filter((j) => keepTitle(j.title || '') && keepLoc(j.loc));
    for (const j of kept) {
      const desc = String(j.desc || '');
      let lang = 'title-only';
      if (desc.length > 400) {
        if (germanAboveA2(desc) || germanOnly(desc)) continue;
        lang = 'english-ok';
      }
      hits.push({
        sheet: c.sheet,
        company: c.name,
        title: j.title,
        loc: j.loc || '',
        url: j.href || c.urls[0],
        via,
        lang,
      });
    }
  }
  const lines = [
    '# Excel career-page scan',
    '',
    `Finished: ${new Date().toISOString()}`,
    `Companies on Excel: ${companies.length}`,
    `Companies with a career URL: ${withUrl}`,
    `Career pages that returned jobs: ${apiHits}`,
    `Matching jobs (title + Germany): ${hits.length}`,
    '',
    '| Sheet | Company | Role | Location | Language | Link |',
    '|---|---|---|---|---|---|',
    ...hits.map((h) => `| ${h.sheet} | ${h.company} | ${h.title} | ${h.loc} | ${h.lang} | ${h.url} |`),
  ];
  writeFileSync(OUT, lines.join('\n') + '\n');
  writeFileSync(join(ROOT, 'data', 'excel-career-skipped.tsv'), skipped.join('\n') + '\n');
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }

  const { seen } = loadSeenUrls();
  const offers = [];
  for (const h of hits) {
    if (!looksLikeJobUrl(h.url, h.title)) continue;
    if (!h.url || seen.has(h.url)) continue;
    seen.add(h.url);
    offers.push({
      url: h.url,
      company: h.company,
      title: h.title,
      location: h.loc || 'Germany',
      source: 'excel',
    });
  }
  if (offers.length) {
    await appendToPipeline(offers);
    await appendToScanHistory(offers, localToday(), 'added');
  }
  process.stderr.write(`excel jobs appended: ${offers.length} of ${hits.length} title hits\n`);
}

main().catch((err) => {
  writeFileSync(OUT, `# Excel career-page scan\n\nFailed: ${err.message}\n`);
  process.exit(1);
});
