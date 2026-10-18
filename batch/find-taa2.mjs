import { readFileSync, writeFileSync } from 'fs';
import { makeHttpCtx } from '../providers/_http.mjs';

const ctx = { ...makeHttpCtx(), includeUndated: true };

const SKIP = [
  'intern technology consultant',
  'associate - strategy & business operations',
  'fulfillment technology analyst',
  'international graduate trainee',
  'operations trainee',
  'ai-enabled governance associate',
  'strategy & operations associate',
  'product analyst',
  'analyst, data operations',
  'analyst education',
  'marketing analyst',
  'global operations associate',
  'people operations associate',
  'growth associate - bank',
  'associate (ai) solution consultant',
  'investor relations associate',
  'afc compliance',
  'strategy - future leaders',
  'trainee international talent programme',
  'trainee sales',
  'grocery associate',
  'expert trade analyst',
  'visiting founders associate (engineering)',
];

const DE = /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|nuremberg|nürnberg|mannheim|karlsruhe|aachen|heidelberg|garching|bavaria|bayern|nrw|hessen|deutschlandweit|dresden|hannover|dortmund|essen|bremen|augsburg|freiburg|\bde\b/i;
const TITLE = /\b(trainee|analyst|associate|graduate programme|graduate program|future leaders)\b/i;
const NEG = /\b(senior|staff |principal|director|head of|vice president|intern(ship)?|werkstudent|working student|praktikum|praktikant|engineer|developer|scientist|phd|cook|stylist|legal trainee)\b/i;
const C1 = /german.{0,50}(c1|native|fluent|mother tongue|business fluent|business fluency)|deutsch.{0,50}(c1|flie[sß]end|verhandlungssicher|muttersprache)|fluent german required|fluency in german and english \(must\)|flie[sß]end deutsch auf c1/i;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function locOk(loc) {
  const s = String(loc || '');
  if (!s.trim()) return true;
  if (DE.test(s)) return true;
  if (/\b(united states|usa|uk|united kingdom|france|spain|italy|netherlands|poland|india|mexico|brazil|canada|china|singapore|dallas|geneva|madrid|paris|london|dublin|amsterdam|lisbon|portugal)\b/i.test(s) && !DE.test(s)) return false;
  return false;
}
function germanOnly(text) {
  if (!text) return false;
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}
function skip(title) {
  const t = norm(title);
  return SKIP.some((s) => t.includes(s));
}
function strip(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

const out = [];
const seen = new Set();
function add(row) {
  if (!row.title || !row.url) return;
  if (!TITLE.test(row.title) || NEG.test(row.title)) return;
  if (skip(row.title)) return;
  if (!locOk(row.location)) return;
  if (row.text && (germanOnly(row.text) || C1.test(row.text))) return;
  const k = `${norm(row.company)}|${norm(row.title)}`;
  if (seen.has(k)) return;
  seen.add(k);
  const copy = { ...row };
  delete copy.text;
  out.push(copy);
}

const GH = [
  ['Adyen', 'adyen'], ['Stripe', 'stripe'], ['Intercom', 'intercom'],
  ['StepStone', 'stepstone'], ['Isar Aerospace', 'isaraerospace'],
  ['Tide', 'tide'], ['Hive', 'hive'], ['Thirdbridge', 'thirdbridge'],
  ['ARX Robotics', 'arxroboticsgmbh'], ['Marvel Fusion', 'marvelfusion'],
  ['Project A', 'project-a'], ['Personio', 'personio1'],
  ['AUTO1', 'auto1'], ['Zalando', 'zalandose'], ['About You', 'aboutyou'],
  ['HomeToGo', 'hometogo1'], ['Delivery Hero', 'deliveryhero1'],
  ['Omio', 'goeuro'], ['Taxfix', 'taxfix'], ['Adjust', 'adjust'],
  ['Wayfair', 'wayfair'], ['Palantir', 'palantirtechnologies'],
  ['McKinsey', 'mckinseyandcompany'], ['BCG', 'bcg'],
  ['Oliver Wyman', 'oliverwyman'], ['Roland Berger', 'rolandberger'],
  ['Accenture', 'accenture'], ['Deloitte', 'deloitte'],
  ['KPMG', 'kpmg'], ['EY', 'ey'], ['PwC', 'pwc'],
  ['NERA', 'nera'], ['CRA', 'charlesriverassociates'],
  ['LaSalle', 'lasalleinvestmentmanagement'],
  ['JLL', 'jll'], ['CBRE', 'cbre'],
  ['BlackRock', 'blackrock'], ['Goldman Sachs', 'goldmansachs'],
  ['JPMorgan', 'jpmorganchase'], ['Morgan Stanley', 'morganstanley'],
  ['Deutsche Bank', 'deutschebank'], ['Commerzbank', 'commerzbank'],
  ['ING', 'ing'], ['Allianz', 'allianz'],
  ['Siemens', 'siemens'], ['Siemens Energy', 'siemensenergy'],
  ['Infineon', 'infineon'], ['SAP', 'sap'],
  ['Bosch', 'bosch'], ['Continental', 'continental'],
  ['TWAICE', 'twaice'], ['Grover', 'grover'],
  ['Doctolib', 'doctolib'], ['IONOS', 'ionos'],
  ['Flix', 'flix'], ['Wolt', 'wolt'],
  ['Picnic', 'teampicnic'], ['HelloFresh', 'hellofresh'],
  ['N26', 'n26'], ['Celonis', 'celonis'],
  ['SumUp', 'sumup'], ['Helsing', 'helsing'],
];

const ASHBY = [
  'AlephAlpha', 'flink', 'clark', 'mollie', 'bolt', 'taxfix.com',
  'trawa', 'voize', 'pliant', 'nomos', 'uipath', 'pigment',
  'enpal', 'babbel', 'upvest', 'moss', 'n8n', 'forto',
  'DeepL', 'choco', 'cargo-one', 'taktile', 'telli', 'almedia',
  'peec', 'Luminovo', 'lemon.markets', 'yepoda',
];

const LEVER = ['qonto', 'spotify', 'pigment', 'palantir', 'finn', 'sennder', 'tier'];

async function greenhouse(name, board) {
  try {
    const data = await ctx.fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { timeoutMs: 18000 });
    for (const job of data.jobs || []) {
      add({
        company: name, title: job.title, location: job.location?.name || '',
        url: job.absolute_url || `https://job-boards.greenhouse.io/${board}/jobs/${job.id}`,
        text: strip(job.content || ''), source: 'greenhouse',
      });
    }
    process.stderr.write(`gh ${name} ${ (data.jobs || []).length }\n`);
  } catch (e) { process.stderr.write(`gh ${name}: ${e.message}\n`); }
}

async function ashby(slug) {
  try {
    const data = await ctx.fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, { timeoutMs: 25000 });
    const jobs = data.jobs || data.postings || [];
    for (const job of jobs) {
      add({
        company: data.name || slug,
        title: job.title,
        location: job.location || job.address?.postalAddress?.addressLocality || '',
        url: job.jobUrl || job.applyUrl,
        text: strip(job.descriptionHtml || job.descriptionPlain || ''),
        source: 'ashby',
      });
    }
    process.stderr.write(`ashby ${slug} ${jobs.length}\n`);
  } catch (e) { process.stderr.write(`ashby ${slug}: ${e.message}\n`); }
}

async function lever(slug) {
  try {
    const data = await ctx.fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`, { timeoutMs: 18000 });
    const jobs = Array.isArray(data) ? data : [];
    for (const job of jobs) {
      add({
        company: slug, title: job.text || job.title,
        location: job.categories?.location || '',
        url: job.hostedUrl || job.applyUrl,
        text: strip(job.descriptionPlain || job.description || ''),
        source: 'lever',
      });
    }
    process.stderr.write(`lever ${slug} ${jobs.length}\n`);
  } catch (e) { process.stderr.write(`lever ${slug}: ${e.message}\n`); }
}

const pipe = readFileSync('data/pipeline.md', 'utf8');
for (const line of pipe.split(/\r?\n/)) {
  const m = line.match(/^- \[[ x]\] (https?:\S+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)/i);
  if (!m) continue;
  add({ company: m[2].trim(), title: m[3].trim(), location: (m[4] || '').trim(), url: m[1].trim(), source: 'pipeline' });
}

const seenB = new Set();
for (const [name, board] of GH) {
  if (seenB.has(board)) continue;
  seenB.add(board);
  await greenhouse(name, board);
}
for (const slug of ASHBY) await ashby(slug);
for (const slug of LEVER) await lever(slug);

writeFileSync('data/taa-candidates2.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ total: out.length }));
for (const j of out) console.log(`${j.company}\t${j.title}\t${j.location || ''}\t${j.url}`);
