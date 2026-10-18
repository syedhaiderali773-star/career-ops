import { makeHttpCtx } from '../providers/_http.mjs';
const ctx = makeHttpCtx();
function strip(h) { return String(h || '').replace(/<[^>]+>/g, ' '); }
function gate(t) {
  const de = (t.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Kenntnisse)\b/gi) || []).length;
  const en = (t.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  const c1 = /german.{0,50}(c1|native|fluent|mother tongue)|deutsch.{0,50}(c1|flie[sß]end|verhandlungssicher)|fluency in german|fluent in german/i.test(t);
  return { de, en, c1, germanBody: de > 25 && de > en * 2.5 };
}

const cxs = [
  ['clearwater-csa', 'https://clearwateranalytics.wd1.myworkdayjobs.com/wday/cxs/clearwateranalytics/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Analyst--Graduate-Role-_R12115'],
  ['clearwater-assoc', 'https://clearwateranalytics.wd1.myworkdayjobs.com/wday/cxs/clearwateranalytics/clearwater_analytics_careers/job/Office---Frankfurt/Client-Servicing-Associate_R12109'],
  ['rheinmetall', 'https://rhe.wd3.myworkdayjobs.com/wday/cxs/rhe/r1111/job/Duisburg-Germany/Trainee--w-m-d--Supply-Chain-Management-Automotive_JR105570'],
  ['abb', 'https://abb.wd3.myworkdayjobs.com/wday/cxs/abb/external_career_page/job/Heidelberg-Baden-Wurttemberg-Germany/Associate-Project-Manager--m-w-d----Region-Sd-West_JR00045354'],
  ['airbus', 'https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/airbus/job/Hamburg-Area/Digital-Business-Analyst---Master-Data--d-m-f-_JR10440529'],
  ['nexperia', 'https://nexperia.wd3.myworkdayjobs.com/wday/cxs/nexperia/careers/job/Hamburg/Business-Planning-Analyst_R-20015522'],
  ['mks', 'https://mksinst.wd1.myworkdayjobs.com/wday/cxs/mksinst/mkscareersemea/job/Germany-Berlin/Business-Analyst_R21837'],
  ['circlek', 'https://circlek.wd3.myworkdayjobs.com/wday/cxs/circlek/circlekstorejobs/job/Support-Office-Berlin/Pricing-Analyst--Global-Fuels_R620985'],
  ['jd', 'https://jd.wd103.myworkdayjobs.com/wday/cxs/jd/Campus_Career_Site/job/DEU-Berlin-Berlin/JD-STAR-Graduate-E-Commerce-Business-Development-Account-Manager_JR103975'],
];

for (const [n, u] of cxs) {
  try {
    const d = await ctx.fetchJson(u, { timeoutMs: 18000 });
    const job = d.jobPostingInfo || d;
    const title = job.title || job.jobTitle;
    const text = strip(job.jobDescription || '');
    console.log('CXS', n, title, gate(text));
  } catch (e) { console.log('CXS-NO', n, e.message); }
}

try {
  const amz = await ctx.fetchJson('https://www.amazon.jobs/en/search.json?offset=0&result_limit=50&sort=relevant&country[]=DEU&distanceType=Mi&radius=24km&latitude=&longitude=&loc_group_id=&loc_query=Germany&base_query=Financial%20Analyst&city=&country=&region=&county=&query_options=&', { timeoutMs: 20000 });
  for (const j of amz.jobs || []) {
    if (/analyst|associate|trainee/i.test(j.title) && !/senior|intern/i.test(j.title)) {
      console.log('AMZ', j.title, j.location, j.id_icims, `https://www.amazon.jobs/en/jobs/${j.id_icims}`);
    }
  }
} catch (e) { console.log('AMZ-NO', e.message); }

try {
  const db = await ctx.fetchJson('https://db.wd3.myworkdayjobs.com/wday/cxs/db/dbwebsite/jobs', { timeoutMs: 15000 });
  console.log('DB-search', Object.keys(db));
} catch (e) { console.log('DB-NO', e.message); }
