import { writeFileSync } from 'fs';
import { makeHttpCtx } from '../providers/_http.mjs';

const ctx = { ...makeHttpCtx(), includeUndated: true };

const SKIP_TITLE = [
  'intern technology consultant',
  'associate - strategy & business operations',
  'fulfillment technology analyst',
  'international graduate trainee - ba',
  'operations trainee',
  'ai-enabled governance associate',
  'strategy & operations associate',
  'product analyst',
  'analyst, data operations',
  'analyst – education',
  'analyst - education',
  'marketing analyst',
  'global operations associate',
  'people operations associate',
  'growth associate - bank',
  'associate (ai) solution consultant',
  'investor relations associate',
  'afc compliance',
  'strategy - future leaders',
  'trainee international talent programme - finance',
  'trainee sales',
];

const GH = [
  ['Celonis', 'celonis'], ['N26', 'n26'], ['Trade Republic', 'traderepublicbank'],
  ['HelloFresh', 'hellofresh'], ['GetYourGuide', 'getyourguide'], ['Contentful', 'contentful'],
  ['SumUp', 'sumup'], ['Helsing', 'helsing'], ['Parloa', 'parloa'], ['Flix', 'flix'],
  ['Raisin', 'raisin'], ['Scout24', 'scout24'], ['Staffbase', 'staffbase'],
  ['Moonfare', 'moonfare'], ['IONOS', 'ionos'], ['Doctolib', 'doctolib'],
  ['Bitpanda', 'bitpanda'], ['trivago', 'trivago'], ['Grover', 'grover'],
  ['Wolt', 'wolt'], ['Picnic', 'teampicnic'], ['Personio', 'personio'],
  ['Adjust', 'adjustgmbh'], ['Flexport', 'flexport'], ['Lightspeed', 'lightspeedhq'],
  ['Tourlane', 'tourlane'], ['Statista', 'statista'], ['Delivery Hero', 'deliveryhero'],
  ['AUTO1', 'auto1group'], ['Zalando', 'zalando'], ['Spotify', 'spotify'],
  ['Contentful', 'contentful'], ['Personio', 'personio'], ['Taxfix', 'taxfix'],
  ['Omio', 'omio'], ['Free Now', 'freenow'], ['Tier', 'tier'],
  ['Infarm', 'infarm'], ['Project A', 'projecta'], ['About You', 'aboutyou'],
  ['HomeToGo', 'hometogo'], ['Mister Spex', 'misterspex'], ['FlixBus', 'flix'],
  ['Solaris', 'solarisbank'], ['Raisin', 'raisin'], ['N26', 'n26'],
  ['Celonis', 'celonis'], ['HelloFresh', 'hellofresh'],
  ['Charles River Associates', 'charlesriverassociates'],
  ['BCG', 'bcg'], ['McKinsey', 'mckinsey'],
];

const ASHBY = [
  'forto', 'DeepL', 'n8n', 'enpal', 'babbel', 'upvest', 'moss', 'pleo',
  'tourlane', 'choco', 'cargo-one', 'taktile', 'telli', 'bunch',
  'Luminovo', 'pigment', 'almedia', 'lemonmarkets', 'peec',
];

const DE = /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|nuremberg|nürnberg|mannheim|karlsruhe|aachen|heidelberg|garching|bavaria|bayern|nrw|hessen|deutschlandweit|\bde\b/i;
const TITLE = /\b(trainee|analyst|associate|graduate programme|graduate program|future leaders)\b/i;
const NEG = /\b(senior|staff |principal|director|head of|vice president|intern(ship)?|werkstudent|working student|praktikum|praktikant|engineer|developer|scientist|phd|cook|stylist)\b/i;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function skip(company, title) {
  const t = norm(title);
  return SKIP_TITLE.some((s) => t.includes(s));
}
function locOk(loc) {
  const s = String(loc || '');
  if (!s.trim()) return true;
  if (DE.test(s)) return true;
  if (/\b(united states|usa|uk|united kingdom|france|spain|italy|netherlands|poland|india|mexico|brazil|canada|china|singapore|dallas|geneva)\b/i.test(s) && !DE.test(s)) return false;
  return false;
}
function germanOnly(text) {
  if (!text) return false;
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}
function c1Block(text) {
  if (!text) return false;
  return /german.{0,40}(c1|native|fluent|mother tongue|business fluent)|deutsch.{0,40}(c1|flie[sß]end|verhandlungssicher|muttersprache)|fluent german required/i.test(text);
}
function strip(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

const out = [];
const seen = new Set();
function add(row) {
  if (!row.title || !row.url) return;
  if (!TITLE.test(row.title) || NEG.test(row.title)) return;
  if (skip(row.company, row.title)) return;
  if (!locOk(row.location)) return;
  if (row.text && (germanOnly(row.text) || c1Block(row.text))) return;
  const k = `${norm(row.company)}|${norm(row.title)}`;
  if (seen.has(k)) return;
  seen.add(k);
  delete row.text;
  out.push(row);
}

async function greenhouse(name, board) {
  try {
    const data = await ctx.fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { timeoutMs: 20000 });
    for (const job of data.jobs || []) {
      const loc = job.location?.name || '';
      add({
        company: name, title: job.title, location: loc,
        url: job.absolute_url || `https://job-boards.greenhouse.io/${board}/jobs/${job.id}`,
        text: strip(job.content || ''), source: 'greenhouse',
      });
    }
    process.stderr.write(`gh ${name} ok\n`);
  } catch (e) { process.stderr.write(`gh ${name}: ${e.message}\n`); }
}

async function ashby(slug) {
  try {
    const data = await ctx.fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, { timeoutMs: 30000 });
    const jobs = data.jobs || data.postings || [];
    const company = data.name || slug;
    for (const job of jobs) {
      const loc = job.location || job.address?.postalAddress?.addressLocality || '';
      add({
        company, title: job.title, location: loc,
        url: job.jobUrl || job.applyUrl,
        text: strip(job.descriptionHtml || job.descriptionPlain || ''),
        source: 'ashby',
      });
    }
    process.stderr.write(`ashby ${slug} ok\n`);
  } catch (e) { process.stderr.write(`ashby ${slug}: ${e.message}\n`); }
}

const seenBoards = new Set();
for (const [name, board] of GH) {
  if (seenBoards.has(board)) continue;
  seenBoards.add(board);
  await greenhouse(name, board);
}
for (const slug of ASHBY) await ashby(slug);

writeFileSync('data/taa-candidates.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ total: out.length }));
for (const j of out) console.log(`${j.company}\t${j.title}\t${j.location || ''}\t${j.url}`);
