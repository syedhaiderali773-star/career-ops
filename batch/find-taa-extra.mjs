import { makeHttpCtx } from '../providers/_http.mjs';
const ctx = makeHttpCtx();
const TITLE = /\b(trainee|analyst|associate|graduate program|future leaders)\b/i;
const NEG = /\b(senior|staff |director|intern|werkstudent|working student|praktikum|engineer|developer)\b/i;
const DE = /germany|deutschland|munich|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|mannheim|karlsruhe|nuremberg|nürnberg/i;

async function sr(company) {
  try {
    const data = await ctx.fetchJson(`https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=100`, { timeoutMs: 15000 });
    for (const j of data.content || []) {
      const loc = `${j.location?.city || ''} ${j.location?.country || ''}`;
      if (!DE.test(loc) && !/Germany|DE/i.test(j.location?.country || '')) continue;
      if (!TITLE.test(j.name) || NEG.test(j.name)) continue;
      console.log('SR', company, j.name, loc, `https://jobs.smartrecruiters.com/${company}/${j.id}`);
    }
  } catch (e) { console.log('SR-NO', company, e.message); }
}

for (const c of ['Continental', 'deliveryhero', 'Auto1', 'ScalableGmbH', 'omio']) await sr(c);

const hf = await ctx.fetchJson('https://boards-api.greenhouse.io/v1/boards/hellofresh/jobs?content=false');
for (const j of hf.jobs || []) {
  if (/germany|berlin|barleben/i.test(j.location?.name || '') && TITLE.test(j.title) && !NEG.test(j.title)) {
    console.log('HF', j.id, j.title, j.location.name);
  }
}

const pages = [
  ['jd-grad', 'https://jd.wd103.myworkdayjobs.com/en-US/Campus_Career_Site/job/DEU-Berlin-Berlin/JD-STAR-Graduate-E-Commerce-Business-Development-Account-Manager_JR103975'],
  ['jd-grad2', 'https://jd.wd103.myworkdayjobs.com/Campus_Career_Site/job/DEU-Berlin-Berlin/JD-STAR-Graduate-E-Commerce-Business-Development-Account-Manager_JR103975'],
  ['zf', 'https://jobs.zf.com/job/Project-Analyst/1414918333/'],
  ['solactive', 'https://www.solactive.com/career/'],
];
for (const [n, u] of pages) {
  try {
    const html = await ctx.fetchText(u, { timeoutMs: 18000 });
    console.log('PAGE', n, html.length, /analyst|graduate|trainee|associate/i.test(html), /page not found|job not found|no longer/i.test(html));
  } catch (e) { console.log('PAGE-NO', n, e.message); }
}
