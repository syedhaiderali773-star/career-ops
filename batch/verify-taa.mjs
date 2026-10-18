import { writeFileSync } from 'fs';
import { makeHttpCtx } from '../providers/_http.mjs';

const ctx = makeHttpCtx();
const C1 = /german.{0,50}(c1|native|fluent|mother tongue|business fluent|business fluency)|deutsch.{0,50}(c1|flie[sß]end|verhandlungssicher|muttersprache)|fluent german required|fluency in german and english \(must\)/i;
const DE_BODY = (t) => {
  const de = (t.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (t.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
};
const DEAD = /page not found|job not found|this job is no longer|no longer accepting|stellenanzeige wurde|this position has been filled|job posting is closed/i;

const jobs = [
  { slug: 'picnic-analytics-hh', company: 'Picnic', role: 'Analytics - Future Leaders Graduate Program', city: 'Hamburg', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=7256669', focus: 'analyst', gh: ['teampicnic', '7256669'] },
  { slug: 'picnic-analytics-dus', company: 'Picnic', role: 'Analytics - Future Leaders Graduate Program', city: 'Düsseldorf', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=7185834', focus: 'analyst', gh: ['teampicnic', '7185834'] },
  { slug: 'picnic-category', company: 'Picnic', role: 'Category Management - Future Leaders Graduate Program', city: 'Düsseldorf', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=8213631', focus: 'ops', gh: ['teampicnic', '8213631'] },
  { slug: 'picnic-commercial', company: 'Picnic', role: 'Commercial - Future Leaders Graduate Program', city: 'Düsseldorf', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=8213256', focus: 'marketing', gh: ['teampicnic', '8213256'] },
  { slug: 'picnic-trainee-hannover', company: 'Picnic', role: 'Fast Track to Leadership Trainee', city: 'Hannover', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=7730885', focus: 'ops', gh: ['teampicnic', '7730885'] },
  { slug: 'picnic-grad-nbg', company: 'Picnic', role: 'Graduate Operations Supervisor (m/w/d)', city: 'Nürnberg', url: 'https://jobs.picnic.app/nl/vacancies?gh_jid=7096031', focus: 'ops', gh: ['teampicnic', '7096031'] },
  { slug: 'celonis-lunar', company: 'Celonis', role: 'Associate Account Executive (Top Talent Sales Program - Lunar)', city: 'Munich', url: 'https://job-boards.greenhouse.io/celonis/jobs/7816965003?gh_jid=7816965003', focus: 'marketing', gh: ['celonis', '7816965003'] },
  { slug: 'n26-complaints', company: 'N26', role: 'Compliance and Prevention Associate (Complaints Management)', city: 'Berlin', url: 'https://n26.com/en-eu/careers/positions/8161390?gh_jid=8161390', focus: 'ops', gh: ['n26', '8161390'] },
  { slug: 'n26-fraud', company: 'N26', role: 'Fraud Prevention Associate', city: 'Berlin', url: 'https://n26.com/en-eu/careers/positions/8166719?gh_jid=8166719', focus: 'ops', gh: ['n26', '8166719'] },
  { slug: 'cra-associate', company: 'Charles River Associates', role: 'Consulting Associate (European Competition practice)', city: 'Munich', url: 'https://job-boards.greenhouse.io/charlesriverassociates/jobs/1695252', focus: 'strategy', gh: ['charlesriverassociates', '1695252'] },
  { slug: 'wolt-partner', company: 'Wolt', role: 'Partner Operations Associate', city: 'Berlin', url: 'https://job-boards.greenhouse.io/wolt/jobs/8184886', focus: 'ops', gh: ['wolt', '8184886'] },
  { slug: 'wolt-onboard', company: 'Wolt', role: 'Restaurant Onboarding Associate', city: 'Berlin', url: 'https://job-boards.greenhouse.io/wolt/jobs/7856631', focus: 'ops', gh: ['wolt', '7856631'] },
  { slug: 'doctolib-workplace', company: 'Doctolib', role: 'Workplace Experience & Mobility Associate', city: 'Berlin', url: 'https://job-boards.greenhouse.io/doctolib/jobs/7993872003', focus: 'hr', gh: ['doctolib', '7993872003'] },
  { slug: 'helsing-apm', company: 'Helsing', role: 'Associate Programme Manager - Land', city: 'Munich', url: 'https://helsing.ai/jobs/4944070101?gh_jid=4944070101', focus: 'ops', gh: ['helsing', '4944070101'] },
  { slug: 'isar-ops', company: 'Isar Aerospace', role: 'Associate Operations Transformation', city: 'Munich', url: 'https://boards.greenhouse.io/isaraerospace/jobs/4959282101', focus: 'ops', gh: ['isaraerospace', '4959282101'] },
  { slug: 'appian-ac', company: 'Appian', role: 'Associate Consultant (2027 Graduates)', city: 'Frankfurt', url: 'https://job-boards.greenhouse.io/appian/jobs/8201000', focus: 'ops', gh: ['appian', '8201000'] },
  { slug: 'forto-cfo', company: 'Forto', role: 'Corporate Finance Analyst (Temporary)', city: 'Berlin', url: 'https://jobs.ashbyhq.com/forto/6cbb881d-8e17-4e7f-a8de-e2f081015510', focus: 'finance' },
  { slug: 'n8n-sda', company: 'n8n', role: 'Sales Data Analyst', city: 'Germany', url: 'https://jobs.ashbyhq.com/n8n/62309aac-598b-4cb0-bc1b-e0dad9cda130', focus: 'analyst' },
  { slug: 'pliant-coa', company: 'Pliant', role: 'Compliance Operations Analyst', city: 'Berlin', url: 'https://jobs.ashbyhq.com/pliant/c944d7e9-3422-4cfb-a908-00ee9aa27fb4', focus: 'ops' },
  { slug: 'trawa-mkt', company: 'trawa', role: 'Marketing Associate - Special Projects & Events', city: 'Berlin', url: 'https://jobs.ashbyhq.com/trawa/98be1c10-878e-43f9-be58-7201394b0159', focus: 'marketing' },
  { slug: 'trawa-revops', company: 'trawa', role: 'Revenue Operations Associate', city: 'Berlin', url: 'https://jobs.ashbyhq.com/trawa/d70f2d3b-98bf-4222-a65f-8114ff8d6d82', focus: 'ops' },
  { slug: 'dataguard-ac', company: 'DataGuard', role: 'Associate Consultant - Privacy', city: 'Munich', url: 'https://jobs.ashbyhq.com/dataguard/ce871029-22d2-4683-a5b3-4a0df4d39250', focus: 'ops' },
  { slug: 'telli-fa', company: 'Telli', role: 'Founder\'s Associate - Product', city: 'Berlin', url: 'https://jobs.ashbyhq.com/telli/c6f5d2d6-829d-47c5-898e-7c4d6da93f39', focus: 'strategy' },
  { slug: 'almedia-fa', company: 'Almedia', role: 'Founder\'s Associate', city: 'Berlin', url: 'https://jobs.ashbyhq.com/almedia/6859e0b1-c725-4c84-a3b4-42c73067b802', focus: 'strategy' },
  { slug: 'peec-fa', company: 'Peec', role: 'Founders Associate (Sales)', city: 'Berlin', url: 'https://jobs.ashbyhq.com/peec/ad8b5650-3b53-460f-9ef8-a637abc22e73', focus: 'marketing' },
  { slug: 'due-poa', company: 'Due', role: 'Product Operations - Analyst/Associate', city: 'Germany', url: 'https://due-network.notion.site/Product-Operations-Analyst-Associate-3d68a7bd22d18026a5c8fb1830dd7c4f?pvs=25', focus: 'ops' },
  { slug: 'airbus-dba', company: 'Airbus', role: 'Digital Business Analyst - Master Data', city: 'Hamburg', url: 'https://ag.wd3.myworkdayjobs.com/airbus/job/Hamburg-Area/Digital-Business-Analyst---Master-Data--d-m-f-_JR10440529', focus: 'analyst' },
  { slug: 'essity-ca', company: 'Essity', role: 'Commercial Analyst', city: 'Mannheim', url: 'https://essity.wd3.myworkdayjobs.com/job_opportunities/job/Mannheim-Germany/Commercial-Analyst--d-w-m-_Essity265225', focus: 'analyst' },
  { slug: 'circlek-pa', company: 'Circle K', role: 'Pricing Analyst, Global Fuels', city: 'Berlin', url: 'https://circlek.wd3.myworkdayjobs.com/circlekstorejobs/job/Support-Office-Berlin/Pricing-Analyst--Global-Fuels_R620985', focus: 'analyst' },
  { slug: 'mks-ba', company: 'MKS', role: 'Business Analyst', city: 'Berlin', url: 'https://mksinst.wd1.myworkdayjobs.com/mkscareersemea/job/Germany-Berlin/Business-Analyst_R21837', focus: 'analyst' },
  { slug: 'db-payments', company: 'Deutsche Bank', role: 'Cash Operations - Payment Processing Analyst (befristet)', city: 'Berlin', url: 'https://db.wd3.myworkdayjobs.com/dbwebsite/job/Berlin-Otto-Suhr-Allee-16/Cash-Operations---Payment-Processing-Analyst--d-m-w----befristet_R0445157', focus: 'ops' },
  { slug: 'nexperia-bpa', company: 'Nexperia', role: 'Business Planning Analyst', city: 'Hamburg', url: 'https://nexperia.wd3.myworkdayjobs.com/careers/job/Hamburg/Business-Planning-Analyst_R-20015522', focus: 'analyst' },
  { slug: 'rheinmetall-sc', company: 'Rheinmetall', role: 'Trainee Supply Chain Management Automotive', city: 'Duisburg', url: 'https://rhe.wd3.myworkdayjobs.com/r1111/job/Duisburg-Germany/Trainee--w-m-d--Supply-Chain-Management-Automotive_JR105570', focus: 'ops' },
  { slug: 'clearwater-csa', company: 'Clearwater Analytics', role: 'Client Servicing Analyst (Graduate Role)', city: 'Frankfurt', url: 'https://clearwateranalytics.wd1.myworkdayjobs.com/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Analyst--Graduate-Role-_R12115', focus: 'finance' },
  { slug: 'clearwater-assoc', company: 'Clearwater Analytics', role: 'Client Servicing Associate', city: 'Frankfurt', url: 'https://clearwateranalytics.wd1.myworkdayjobs.com/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Associate_R12109', focus: 'finance' },
  { slug: 'abb-apm', company: 'ABB', role: 'Associate Project Manager - Region Süd-West', city: 'Munich', url: 'https://abb.wd3.myworkdayjobs.com/external_career_page/job/Heidelberg-Baden-Wurttemberg-Germany/Associate-Project-Manager--m-w-d----Region-Sd-West_JR00045354', focus: 'ops' },
  { slug: 'resmed-fda', company: 'ResMed', role: 'Financial Data Analyst', city: 'Germany', url: 'https://resmed.wd3.myworkdayjobs.com/resmed_external_careers/job/DE-Bundesweit/Financial-Data-Analyst--m-w-d-_JR_053427-1', focus: 'finance' },
  { slug: 'resmed-cpa', company: 'ResMed', role: 'Commercial Performance Analyst Marketing & Sales', city: 'Germany', url: 'https://resmed.wd3.myworkdayjobs.com/resmed_external_careers/job/DE-Bundesweit/Commercial-Performance-Analyst-Marketing---Sales--m-w-d-_JR_053426-1', focus: 'analyst' },
  { slug: 'ebury-cra', company: 'Ebury', role: 'Credit Risk Analyst', city: 'Düsseldorf', url: 'https://www.welcometothejungle.com/en/companies/ebury-1/jobs/credit-risk-analyst_dusseldorf_4vbkzvn4', focus: 'finance' },
  { slug: 'applovin-bda', company: 'AppLovin', role: 'Business Development Analyst', city: 'Berlin', url: 'https://www.welcometothejungle.com/en/companies/applovin/jobs/business-development-analyst_berlin_co74ip6b', focus: 'strategy' },
  { slug: 'cafeyn-mda', company: 'Cafeyn', role: 'Marketing Data Analyst', city: 'Berlin', url: 'https://www.welcometothejungle.com/en/companies/cafeyn/jobs/marketing-data-analyst_berlin', focus: 'analyst' },
  { slug: 'planet-da', company: 'Planet', role: 'Data Analyst', city: 'Berlin', url: 'https://www.welcometothejungle.com/en/companies/planet/jobs/data-analyst_berlin_fqlbi6iz', focus: 'analyst' },
  { slug: 'ca-fi', company: 'Crédit Agricole CIB', role: 'Financial Institutions Coverage Analyst', city: 'Frankfurt', url: 'https://www.welcometothejungle.com/en/companies/credit-agricole-cib/jobs/financial-institutions-coverage-analyst-f-m-d-h-f_frankfurt', focus: 'finance' },
  { slug: 'ca-ibd', company: 'Crédit Agricole CIB', role: 'International Business Development Analyst', city: 'Frankfurt', url: 'https://www.welcometothejungle.com/en/companies/credit-agricole-cib/jobs/relationship-manager-assistant-h-f_frankfurt', focus: 'strategy' },
  { slug: 'lucid-sa', company: 'Lucid', role: 'Sales Associate, Munich', city: 'Munich', url: 'https://lucidmotors.com/careers/search/5239652007?gh_jid=5239652007', focus: 'marketing', gh: ['lucidmotors', '5239652007'] },
  { slug: 'home-co', company: 'Home & Co', role: 'Analyst/Associate Real Estate Acquisitions', city: 'Frankfurt', url: 'https://www.arbeitnow.com/jobs/companies/home-co-management-gmbh/analyst-associate-real-estate-acquisitions-frankfurt-am-main-23372', focus: 'finance' },
];

function strip(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

async function gh(board, id) {
  const data = await ctx.fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`, { timeoutMs: 15000 });
  return { ok: true, title: data.title, loc: data.location?.name, text: strip(data.content || ''), url: data.absolute_url };
}

async function page(url) {
  const res = await ctx.fetchText(url, { timeoutMs: 18000 });
  const text = typeof res === 'string' ? res : (res?.text || res?.body || '');
  return { ok: true, status: 200, text: strip(text).slice(0, 20000) };
}

const live = [];
const dead = [];
for (const job of jobs) {
  try {
    let text = '';
    if (job.gh) {
      const g = await gh(job.gh[0], job.gh[1]);
      text = g.text;
      if (g.url) job.url = g.url.includes('http') ? (job.url.includes('gh_jid') ? job.url : g.url) : job.url;
    } else {
      const p = await page(job.url);
      text = p.text;
      if (DEAD.test(text)) throw new Error('dead-page');
    }
    if (C1.test(text)) { dead.push({ slug: job.slug, reason: 'c1' }); continue; }
    if (DE_BODY(text)) { dead.push({ slug: job.slug, reason: 'german-body' }); continue; }
    live.push({ ...job, track: 'ft' });
    process.stderr.write(`OK ${job.slug}\n`);
  } catch (e) {
    dead.push({ slug: job.slug, reason: e.message });
    process.stderr.write(`NO ${job.slug} ${e.message}\n`);
  }
}

writeFileSync('batch/pack-taa-jobs.json', JSON.stringify(live, null, 2));
console.log(JSON.stringify({ live: live.length, dead, slugs: live.map((j) => j.slug) }, null, 2));
