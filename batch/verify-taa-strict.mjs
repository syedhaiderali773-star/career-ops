import { makeHttpCtx } from '../providers/_http.mjs';
const ctx = makeHttpCtx();

const checks = [
  ['ashby', 'forto', 'https://api.ashbyhq.com/posting-api/job-board/forto'],
  ['ashby', 'n8n', 'https://api.ashbyhq.com/posting-api/job-board/n8n'],
  ['ashby', 'pliant', 'https://api.ashbyhq.com/posting-api/job-board/pliant'],
  ['ashby', 'dataguard', 'https://api.ashbyhq.com/posting-api/job-board/dataguard'],
  ['ashby', 'telli', 'https://api.ashbyhq.com/posting-api/job-board/telli'],
  ['ashby', 'almedia', 'https://api.ashbyhq.com/posting-api/job-board/almedia'],
  ['ashby', 'peec', 'https://api.ashbyhq.com/posting-api/job-board/peec'],
];

const pages = [
  { slug: 'airbus-dba', needle: 'Digital Business Analyst', url: 'https://ag.wd3.myworkdayjobs.com/airbus/job/Hamburg-Area/Digital-Business-Analyst---Master-Data--d-m-f-_JR10440529' },
  { slug: 'circlek-pa', needle: 'Pricing Analyst', url: 'https://circlek.wd3.myworkdayjobs.com/circlekstorejobs/job/Support-Office-Berlin/Pricing-Analyst--Global-Fuels_R620985' },
  { slug: 'mks-ba', needle: 'Business Analyst', url: 'https://mksinst.wd1.myworkdayjobs.com/mkscareersemea/job/Germany-Berlin/Business-Analyst_R21837' },
  { slug: 'nexperia-bpa', needle: 'Business Planning Analyst', url: 'https://nexperia.wd3.myworkdayjobs.com/careers/job/Hamburg/Business-Planning-Analyst_R-20015522' },
  { slug: 'rheinmetall-sc', needle: 'Trainee', url: 'https://rhe.wd3.myworkdayjobs.com/r1111/job/Duisburg-Germany/Trainee--w-m-d--Supply-Chain-Management-Automotive_JR105570' },
  { slug: 'clearwater-csa', needle: 'Client Servicing Analyst', url: 'https://clearwateranalytics.wd1.myworkdayjobs.com/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Analyst--Graduate-Role-_R12115' },
  { slug: 'clearwater-assoc', needle: 'Client Servicing Associate', url: 'https://clearwateranalytics.wd1.myworkdayjobs.com/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Associate_R12109' },
  { slug: 'abb-apm', needle: 'Associate Project Manager', url: 'https://abb.wd3.myworkdayjobs.com/external_career_page/job/Heidelberg-Baden-Wurttemberg-Germany/Associate-Project-Manager--m-w-d----Region-Sd-West_JR00045354' },
  { slug: 'due-poa', needle: 'Product Operations', url: 'https://due-network.notion.site/Product-Operations-Analyst-Associate-3d68a7bd22d18026a5c8fb1830dd7c4f' },
  { slug: 'home-co', needle: 'Analyst', url: 'https://www.arbeitnow.com/jobs/companies/home-co-management-gmbh/analyst-associate-real-estate-acquisitions-frankfurt-am-main-23372' },
  { slug: 'ebury-cra', needle: 'Credit Risk Analyst', url: 'https://www.welcometothejungle.com/en/companies/ebury-1/jobs/credit-risk-analyst_dusseldorf_4vbkzvn4' },
  { slug: 'applovin-bda', needle: 'Business Development Analyst', url: 'https://www.welcometothejungle.com/en/companies/applovin/jobs/business-development-analyst_berlin_co74ip6b' },
  { slug: 'cafeyn-mda', needle: 'Marketing Data Analyst', url: 'https://www.welcometothejungle.com/en/companies/cafeyn/jobs/marketing-data-analyst_berlin' },
  { slug: 'planet-da', needle: 'Data Analyst', url: 'https://www.welcometothejungle.com/en/companies/planet/jobs/data-analyst_berlin_fqlbi6iz' },
  { slug: 'ca-fi', needle: 'Coverage Analyst', url: 'https://www.welcometothejungle.com/en/companies/credit-agricole-cib/jobs/financial-institutions-coverage-analyst-f-m-d-h-f_frankfurt' },
  { slug: 'ca-ibd', needle: 'Business Development Analyst', url: 'https://www.welcometothejungle.com/en/companies/credit-agricole-cib/jobs/relationship-manager-assistant-h-f_frankfurt' },
  { slug: 'isar-eu', needle: 'Associate Operations', url: 'https://job-boards.greenhouse.io/isaraerospace/jobs/4959282101' },
];

const want = {
  forto: /corporate finance analyst/i,
  n8n: /sales data analyst/i,
  pliant: /compliance operations analyst/i,
  dataguard: /associate consultant/i,
  telli: /founder.?s associate - product/i,
  almedia: /founder.?s associate/i,
  peec: /founders associate \(sales\)/i,
};

for (const [kind, slug, url] of checks) {
  try {
    const data = await ctx.fetchJson(url, { timeoutMs: 20000 });
    const jobs = data.jobs || data.postings || [];
    const hit = jobs.find((j) => want[slug].test(j.title || ''));
    if (!hit) { console.log('ASHBY-MISS', slug); continue; }
    const text = String(hit.descriptionPlain || hit.descriptionHtml || '').replace(/<[^>]+>/g, ' ');
    const paid = /€|EUR|salary|compensation|paid|full-time|full time|festanstellung/i.test(text + (hit.compensationTierSummary || ''));
    const unpaid = /unpaid|unbezahlt|equity only/i.test(text);
    console.log('ASHBY-OK', slug, hit.title, hit.jobUrl || hit.applyUrl, 'paidHint=' + paid, 'unpaid=' + unpaid);
  } catch (e) {
    console.log('ASHBY-NO', slug, e.message);
  }
}

for (const p of pages) {
  try {
    const html = await ctx.fetchText(p.url, { timeoutMs: 18000 });
    const has = new RegExp(p.needle, 'i').test(html);
    const dead = /page not found|job not found|no longer|this job is closed|stellenanzeige wurde/i.test(html);
    console.log((has && !dead ? 'PAGE-OK' : 'PAGE-WEAK'), p.slug, 'len=' + html.length, 'hasNeedle=' + has, 'dead=' + dead);
  } catch (e) {
    console.log('PAGE-NO', p.slug, e.message);
  }
}
