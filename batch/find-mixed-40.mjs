import { writeFileSync } from 'fs';
import { makeHttpCtx } from '../providers/_http.mjs';
import sf from '../providers/successfactors.mjs';
import { buildTitleFilter } from '../title-keywords.mjs';

const ctx = { ...makeHttpCtx(), includeUndated: true };

const APPLIED = new Set([
  'tytan technologies|operations trainee',
  'tactilia|working student / thesis - strategy operations & business development',
  'marvel fusion|intern / working student talent acquisition',
  'sap|working student - operations & automation for sap signavio value accelerators',
  'solaris|marketing data analytics working student',
  'sap|working student - team coordinator at sap signavio.next',
  'ctrl qs gmbh|working student - content and data management',
  'munich re|working student project & product management in digital & automation',
  'munich re|working student esg & client reporting sap',
  'siemens energy|working student operations strategy, data & ai',
  'unternehmertum|working student business development & operations',
  'westwing|working student category management',
  'upvest|network intern',
  'munich re|internship opportunity: crm system design',
  'jd.com|jd young business analysis internship',
  'celonis|intern technology consultant, data & ai',
  'borgwarner|working student data management aftermarket',
  'fresenius medical care|intern international internal control system',
  'airbus defence and space|working student procurement, air power',
  'airbus defence and space|working student, general procurement',
  'jd.com|jd young marketing internship',
  'samsung electronics|working student, samsung tv plus',
  'peec ai|gtm internship',
  'heidelberg materials|working student or intern, business development',
  'dyson|e-commerce executive',
  'dyson|online retail activation intern',
  'lemon.markets|ai-enabled governance associate',
  'taktile|strategy & operations associate',
  'tourlane|strategy and transformation manager',
  'statista|revenue operations process manager',
  'xometry europe|product analyst',
  'statista|sales operations manager',
  'lightspeed|analyst, data operations & analytics',
  'statista|analyst – education',
  'lucanet|marketing analyst',
  'flexport|global operations associate',
  'pigment|technical solutions consultant',
  'dun & bradstreet|people operations associate dach',
  'pigment|solution consultant',
  'almedia|product manager',
  'statista|api consultant',
  'yepoda|logistics manager',
  'mirakl|enterprise business development representative',
  'numa|hotel operations manager – munich',
  'hellofresh|fulfillment technology analyst',
  'telli|associate - strategy & business operations',
  'munich re|international graduate trainee - ba',
]);

const GH = [
  ['Celonis', 'celonis'],
  ['N26', 'n26'],
  ['Trade Republic', 'traderepublicbank'],
  ['HelloFresh', 'hellofresh'],
  ['GetYourGuide', 'getyourguide'],
  ['Contentful', 'contentful'],
  ['SumUp', 'sumup'],
  ['Helsing', 'helsing'],
  ['Parloa', 'parloa'],
  ['Flix', 'flix'],
  ['Raisin', 'raisin'],
  ['Scout24', 'scout24'],
  ['Staffbase', 'staffbase'],
  ['Moonfare', 'moonfare'],
  ['IONOS', 'ionos'],
  ['Doctolib', 'doctolib'],
  ['Bitpanda', 'bitpanda'],
  ['trivago', 'trivago'],
  ['Grover', 'grover'],
  ['Wolt', 'wolt'],
  ['Picnic', 'teampicnic'],
  ['Personio', 'personio'],
  ['Adjust', 'adjust'],
  ['Delivery Hero', 'deliveryhero'],
  ['AUTO1', 'auto1group'],
  ['Zalando', 'zalando'],
];

const ASHBY = [
  'forto', 'DeepL', 'n8n', 'enpal', 'babbel', 'upvest', 'moss', 'pleo',
  'tourlane', 'choco', 'cargo-one', 'taktile', 'telli', 'bunch',
];

const INTERN_POS = [
  'internship', 'word:intern', 'intern (', 'intern -', 'intern/', ' intern-',
  'praktikum', 'praktikant', 'praktikantin', 'pflichtpraktikum',
  'werkstudent', 'werkstudentin', 'working student', 'student assistant',
  'studentische', 'hiwi',
];
const FT_POS = [
  'Trainee', 'Analyst', 'Associate', 'Junior', 'Coordinator', 'Graduate',
  'Procurement', 'Logistics', 'Operations', 'Marketing', 'Strategy',
  'Finance', 'People Operations', 'Human Resources', 'Einkauf', 'Beschaffung',
  'Logistik', 'Personal', 'Vertrieb', 'Controlling',
];
const NEG = [
  'director', 'vice president', 'principal', 'head of', 'chief ',
  'software engineer', 'firmware', 'embedded', 'ausbildung', 'apprentice',
  'senior', 'staff ', 'lead ', 'vp ',
];

const DE_CITIES = /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|nuremberg|nürnberg|dortmund|essen|bremen|dresden|hannover|aachen|karlsruhe|mannheim|freiburg|augsburg|heidelberg|garching|düsseldorf|nrw|bavaria|bayern|hessen|deutschlandweit|\bde\b/i;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function applied(company, title) {
  const key = `${norm(company)}|${norm(title)}`;
  for (const a of APPLIED) {
    if (key.includes(a) || a.includes(key) || (key.split('|')[0] === a.split('|')[0] && key.includes(a.split('|')[1].slice(0, 28)))) return true;
  }
  return false;
}

function locOk(loc) {
  const s = String(loc || '');
  if (!s.trim()) return true;
  if (DE_CITIES.test(s)) return true;
  if (/\b(united states|usa|uk|united kingdom|france|spain|italy|netherlands|poland|india|mexico|brazil|canada|china|singapore|remote-mexico|dallas|geneva|delaware)\b/i.test(s) && !DE_CITIES.test(s)) return false;
  return false;
}

const internFilter = buildTitleFilter({ positive: INTERN_POS, negative: NEG });
const ftFilter = buildTitleFilter({ positive: FT_POS, negative: NEG });

function internTitle(title) {
  return internFilter(title);
}
function ftTitle(title) {
  const t = title.toLowerCase();
  if (internTitle(title)) return false;
  if (/\b(senior|staff|principal|director|head of|vice president|lead |vp\b)\b/.test(t)) return false;
  if (/\bmanager\b/.test(t) && !/\b(assistant manager|junior manager|office manager)\b/.test(t)) return false;
  if (/\b(engineer|developer|scientist|designer|counsel|legal)\b/.test(t)) return false;
  return ftFilter(title);
}

function germanOnly(text) {
  if (!text) return false;
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|einer|werden|Voraussetzungen|Aufgaben|Bewerbung)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}
function c1Block(text) {
  if (!text) return false;
  return /german.{0,40}(c1|native|fluent|mother tongue|business fluent)|deutsch.{0,40}(c1|flie[sß]end|verhandlungssicher|muttersprache)|native[- ]level german|fluent german required/i.test(text);
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const out = [];
function add(row) {
  if (!row.title || !row.url) return;
  if (applied(row.company, row.title)) return;
  if (!locOk(row.location)) return;
  const intern = internTitle(row.title);
  const ft = ftTitle(row.title);
  if (!intern && !ft) return;
  if (row.text && (germanOnly(row.text) || c1Block(row.text))) return;
  row.track = intern ? 'intern' : 'ft';
  const k = `${norm(row.company)}|${norm(row.title)}`;
  if (out.some((x) => `${norm(x.company)}|${norm(x.title)}` === k)) return;
  out.push(row);
}

async function greenhouse(name, board) {
  try {
    const data = await ctx.fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { timeoutMs: 20000 });
    for (const job of data.jobs || []) {
      const loc = job.location?.name || (job.offices || []).map((o) => o.name || o.location).join(', ');
      add({
        company: name,
        title: job.title,
        location: loc,
        url: job.absolute_url || `https://job-boards.greenhouse.io/${board}/jobs/${job.id}`,
        text: stripHtml(job.content || ''),
        source: 'greenhouse',
      });
    }
    process.stderr.write(`gh ${name}: ok\n`);
  } catch (e) {
    process.stderr.write(`gh ${name}: ${e.message}\n`);
  }
}

async function ashby(slug) {
  try {
    const data = await ctx.fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, { timeoutMs: 30000 });
    const jobs = data.jobs || data.postings || [];
    const company = data.name || slug;
    for (const job of jobs) {
      const loc = job.location || job.address?.postalAddress?.addressLocality || (job.locations || []).join(', ');
      add({
        company,
        title: job.title,
        location: loc,
        url: job.jobUrl || job.applyUrl,
        text: stripHtml(job.descriptionHtml || job.descriptionPlain || ''),
        source: 'ashby',
      });
    }
    process.stderr.write(`ashby ${slug}: ok\n`);
  } catch (e) {
    process.stderr.write(`ashby ${slug}: ${e.message}\n`);
  }
}

async function successfactors(name, url) {
  try {
    const jobs = await sf.fetch({ name, careers_url: url, provider: 'successfactors', api: url }, ctx);
    for (const job of jobs || []) {
      add({
        company: name,
        title: job.title,
        location: job.location,
        url: job.url,
        text: '',
        source: 'successfactors',
      });
    }
    process.stderr.write(`sf ${name}: ${(jobs || []).length} jobs\n`);
  } catch (e) {
    process.stderr.write(`sf ${name}: ${e.message}\n`);
  }
}

for (const [name, board] of GH) await greenhouse(name, board);
for (const slug of ASHBY) await ashby(slug);
await successfactors('Henkel', 'https://jobs.henkel.com');
try {
  const jobs = await sf.fetch({ name: 'Henkel', careers_url: 'https://jobs.henkel.com/search/', provider: 'successfactors', api: 'https://jobs.henkel.com', sfVariant: 'csb' }, ctx);
  process.stderr.write(`sf Henkel csb: ${(jobs || []).length} jobs\n`);
  for (const job of jobs || []) {
    add({ company: 'Henkel', title: job.title, location: job.location, url: job.url, text: '', source: 'successfactors-csb' });
  }
} catch (e) {
  process.stderr.write(`sf Henkel csb: ${e.message}\n`);
}
await successfactors('BMW Group', 'https://jobs.bmwgroup.com');
await successfactors('SAP', 'https://jobs.sap.com');
await successfactors('Volkswagen Group', 'https://jobs.volkswagen-group.com');

const intern = out.filter((x) => x.track === 'intern');
const ft = out.filter((x) => x.track === 'ft');
const picked = [...intern.slice(0, 24), ...ft.slice(0, 16)];
const extra = [...intern.slice(24), ...ft.slice(16)];
while (picked.length < 40 && extra.length) picked.push(extra.shift());

const result = { total: out.length, intern: intern.length, ft: ft.length, picked, all: out };
writeFileSync('data/mixed-40-candidates.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ total: out.length, intern: intern.length, ft: ft.length, picked: picked.length }));
for (const j of picked) {
  console.log(`${j.track}\t${j.company}\t${j.title}\t${j.location || ''}\t${j.url}`);
}
