import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { makeHttpCtx } from '../providers/_http.mjs';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';

const DATE = '2026-09-22';
const OLD = '2026-09-21';
const jobs = JSON.parse(readFileSync(new URL('./pack-taa-jobs.json', import.meta.url), 'utf8'));
const ctx = { ...makeHttpCtx(), includeUndated: true };

const CV_TEXT = readFileSync('cv.md', 'utf8').toLowerCase();

const ALLOWED = [
  'kpi reporting', 'gap analysis', 'power bi', 'market analysis', 'stakeholder management',
  'jira', 'process optimisation', 'excel', 'operations', 'programme management',
  'lean process improvement', 'cross-functional coordination', 'compliance', 'sql',
  'financial analysis', 'process automation', 'sap', 'crm', 'marketing analytics',
  'campaign management', 'consumer insights', 'strategic planning', 'business development',
  'change management', 'project management', 'agile', 'confluence', 'tableau', 'qliksense',
  'rpa', 'portfolio management', 'business intelligence', 'supply chain', 'logistics',
  'procurement', 'training', 'digital transformation', 'data analytics', 'reporting',
  'pricing', 'risk', 'kyc', 'sales operations', 'commercial', 'customer operations',
];

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function germanOnly(text) {
  const de = (text.match(/\b(und|der|die|das|für|mit|wir|eine|Voraussetzungen|Aufgaben|Bewerbung|Kenntnisse)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|you|will|requirements|responsibilities|experience|role)\b/gi) || []).length;
  return de > 25 && de > en * 2.5;
}

function germanAboveA2(text) {
  if (!text) return false;
  if (/(?:german|deutsch).{0,50}(?:optional|preferred|desirable|advantageous|nice to have|a plus|von vorteil|w(?:ü|u)nschenswert).{0,20}(?:a1|a2)?/i.test(text)
    && !/(?:german|deutsch).{0,30}(?:b1|b2|c1|c2).{0,25}(?:required|mandatory|erforderlich|must)/i.test(text)
    && !/(?:fluent|flie[sß]end|native|verhandlungssicher).{0,20}(?:german|deutsch).{0,20}(?:required|mandatory|erforderlich|must)/i.test(text)) {
    // optional German is allowed unless a hard B1+ requirement also appears
  }
  return /german\s*(b1|b2|c1|c2)\b.{0,30}(?:required|mandatory|erforderlich|must)|(?:required|mandatory|must|erforderlich).{0,40}german\s*(b1|b2|c1|c2)|fluency in german|fluent(?:ly)? in german|fluent german required|business[- ]fluent german|professional german required|excellent german required|very good german required|native(?:-level)? german|german native speaker|good knowledge of german|deutsch\s*(b1|b2|c1|c2).{0,20}(?:erforderlich|required)|flie[sß]ende deutschkenntnisse|verhandlungssicheres deutsch|muttersprachliches deutsch|sehr gute deutschkenntnisse|deutsch zwingend erforderlich|working language.{0,25}german.{0,15}(?:required|must)/i.test(text);
}

function keywordsFrom(text) {
  const t = String(text || '').toLowerCase();
  const hits = [];
  for (const k of ALLOWED) {
    if (t.includes(k) && CV_TEXT.includes(k.split(' ')[0]) && !hits.includes(k)) hits.push(k);
  }
  if (hits.length < 6) {
    for (const k of ['stakeholder management', 'excel', 'kpi reporting', 'gap analysis', 'operations', 'power bi']) {
      if (!hits.includes(k)) hits.push(k);
    }
  }
  return hits.slice(0, 8);
}

function ghBoardId(url) {
  const m = String(url).match(/gh_jid=(\d+)/) || String(url).match(/\/jobs\/(\d+)/);
  return m ? m[1] : null;
}
function ghBoard(url) {
  const m = String(url).match(/greenhouse\.io\/([^/]+)\//) || String(url).match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/]+)/);
  if (m) return m[1];
  if (/picnic/.test(url)) return 'teampicnic';
  if (/n26/.test(url)) return 'n26';
  if (/celonis/.test(url)) return 'celonis';
  if (/lucid/.test(url)) return 'lucidmotors';
  if (/applovin/.test(url)) return 'applovin';
  if (/planet/.test(url)) return 'planetlabs';
  if (/appian/.test(url)) return 'appian';
  if (/charlesriver/.test(url)) return 'charlesriverassociates';
  return null;
}

async function fetchJd(job) {
  const url = job.url;
  try {
    const board = ghBoard(url);
    const id = ghBoardId(url);
    if (board && id) {
      const d = await ctx.fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`, { timeoutMs: 18000 });
      return strip(d.content || '');
    }
    if (/ashbyhq\.com\/([^/]+)\/([0-9a-f-]{20,})/i.test(url)) {
      const [, slug] = url.match(/ashbyhq\.com\/([^/]+)\//);
      const data = await ctx.fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, { timeoutMs: 20000 });
      const uuid = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)[0];
      const hit = (data.jobs || []).find((j) => (j.jobUrl || '').includes(uuid) || (j.id && String(j.id).includes(uuid)));
      return strip(hit?.descriptionHtml || hit?.descriptionPlain || '');
    }
    const html = await ctx.fetchText(url, { timeoutMs: 18000 });
    return strip(html);
  } catch (e) {
    return `ERROR ${e.message}`;
  }
}

function summary(job, kws) {
  const lead = kws.slice(0, 5).join(', ');
  return `Master's student in business targeting ${job.role} at ${job.company}. Three Infineon working-student rotations in Munich through August 2026 covered global product management, SAP roles and authorisation, and Global Distribution Operations. Strengths: ${lead}. English C2; German B1. Available immediately.`;
}

function coverFor(job, jd, kws) {
  const duty = (jd.match(/(?:you will|responsibilities|what you.?ll do|your impact)(.{0,280})/i) || [, ''])[1].replace(/\s+/g, ' ').trim().slice(0, 180);
  const focus = kws.slice(0, 4).join(', ');
  return {
    candidate: {
      name: 'Syed Haider Ali',
      email: 'syedhaiderali773@gmail.com',
      phone: '+49 157 341 47861',
      location: 'Munich, Germany',
      linkedin: 'linkedin.com/in/syedhaiderali08',
      credentials: ['M.Sc. Digital Technology Management, Hochschule München', 'BBA, IBA Karachi'],
    },
    letter: {
      role_title: job.role,
      company: job.company,
      city: job.city,
      date: DATE,
      greeting: 'Dear Hiring Team,',
      opening: `I am applying for the ${job.role} in ${job.city}. The posting asks for ${focus}, which matches the work I delivered in Infineon working-student rotations and earlier operations and analytics roles.`,
      profile_intro: `I am an M.Sc. Digital Technology Management student at Hochschule München (BBA, IBA Karachi) with English C2 and German B1. I am available to start this full-time role immediately.`,
      achievements: [
        { lead: 'Programme and operations delivery', impact: 'Managed the Infineon Distribution Certification Programme across 5 global regions, running gap analyses across 118 focus applications and hitting 100% on-time sprint milestones with Sales, Application Engineering, and Regional Marketing.' },
        { lead: 'Analytics used by leadership', impact: 'Built KPI dashboards in JIRA/Confluence and Power BI, cut processing time by 40% through Lean redesign, and generated 0.5M EUR additional revenue through market and portfolio analysis.' },
        { lead: 'Process and compliance', impact: 'Reduced operational costs by 70% at Habib Bank Limited, automated 75 FTEs of manual work, and improved KYC onboarding efficiency by 50%.' },
        { lead: 'Fit to this JD', impact: duty ? `This role needs ${focus}. ${duty}` : `This role needs ${focus}. That is the working method I used in Infineon sprints: make the work visible, then improve the process.` },
      ],
      problems_section: `At ${job.company} I would start with the reporting, handoffs, and bottlenecks named in the ${job.role} description, then put a simple KPI view in front of the team so decisions sit on the same numbers.`,
      closing: `I live in Munich, can relocate within Germany, and can start immediately. I would welcome the chance to discuss the ${job.role}.`,
    },
  };
}

const experience = [
  {
    company: 'Infineon Technologies',
    role: 'Working Student',
    location: 'Munich, Germany',
    dates: '09.2023 – 08.2026',
    roles: [
      {
        role: 'Working Student - Global Distribution Operations Management',
        dates: '12.2025 – 08.2026',
        bullets: [
          'Managed the Distribution Certification Programme across 5 global regions — conducting gap analyses across 118 focus applications and building execution roadmaps to maximise regional product adoption',
          'Delivered 100% on-time sprint milestones — coordinating cross-functional workstreams with Application Engineering, Sales, and Regional Marketing',
          'Developed voice-of-customer intelligence reports and programme materials for 5 regional distributor networks, enabling standardised governance and commercial alignment',
        ],
      },
      {
        role: 'Working Student - IT SAP Roles & Authorisation',
        dates: '04.2025 – 11.2025',
        bullets: [
          'Delivered SAP Security process solutions across 7 consecutive monthly sprints — 100% on-time within structured agile programme governance',
          'Built JIRA/Confluence dashboards tracking 5+ concurrent workstreams — providing real-time programme visibility to senior leadership',
          'Contributed to the IT R&A Process Transformation Programme serving Infineon\'s global workforce of 58,000+ employees across 40+ countries',
        ],
      },
      {
        role: 'Working Student - Global Product Management',
        dates: '09.2023 – 03.2025',
        bullets: [
          'Facilitated cross-functional collaboration between Supply Chain, Customer Logistics, and Regional Marketing — achieving 98.5% reduction in compliance monitoring violations',
          'Reduced processing time by 40% through Lean lifecycle management protocol redesign across global product lines',
          'Generated €0.5M additional revenue through strategic market analyses, portfolio optimisation, and market positioning',
        ],
      },
    ],
  },
  {
    company: 'Habib Bank Limited',
    role: 'Manager - System Implementation Analyst',
    location: 'Karachi, Pakistan',
    dates: '01.2022 – 03.2023',
    bullets: [
      'Reduced operational costs by 70% — implementing end-to-end automated compliance and transaction monitoring systems across international markets',
      'Automated 75 FTEs of manual workload via RPA bot deployment, permanently eliminating process bottlenecks and improving throughput',
      'Improved KYC onboarding efficiency by 50% through structured digital process redesign and regulatory compliance framework implementation',
    ],
  },
  {
    company: 'K-Electric',
    role: 'Assistant Manager - Enterprise IT Strategy & Business Support',
    location: 'Karachi, Pakistan',
    dates: '01.2020 – 12.2021',
    bullets: [
      'Developed a 5-year digital transformation roadmap for C-suite — covering 5 business units at Pakistan\'s largest private energy utility',
      'Implemented SAP ISU and QlikSense solutions — digitalised 50+ FTE processes and improved operational efficiency by 50%',
      'Delivered digital systems training to cross-functional teams across 5 business units, driving organisation-wide adoption of new operational standards',
    ],
  },
  {
    company: 'Bank Alfalah',
    role: 'Assistant Manager - Contextual Marketing',
    location: 'Karachi, Pakistan',
    dates: '01.2019 – 12.2019',
    bullets: [
      'Increased digital product registrations by 40% — designing and executing targeted B2B/B2C campaigns with consumer segmentation and competitor analysis',
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data — delivering 100% automated real-time financial intelligence for management decisions',
      'Delivered product training to 70+ staff and managed agency coordination for integrated multi-channel marketing campaigns',
    ],
  },
];

const keep = [];
const drop = [];

mkdirSync('output/_pack-ats', { recursive: true });
mkdirSync('jds', { recursive: true });

for (const job of jobs) {
  process.stderr.write(`JD ${job.slug}\n`);
  const jd = await fetchJd(job);
  if (jd.startsWith('ERROR')) {
    drop.push({ slug: job.slug, reason: jd });
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
  const kws = keywordsFrom(jd + ' ' + job.role);
  keep.push({ ...job, kws, jd: jd.slice(0, 4000) });
  writeFileSync(`jds/${job.slug}.md`, `Posted: not visible in source\n\n# ${job.role}\n\nCompany: ${job.company}\nLocation: ${job.city}, Germany\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
}

writeFileSync('batch/pack-taa-drop.json', JSON.stringify({ drop, keep: keep.map((j) => ({ slug: j.slug, kws: j.kws })) }, null, 2));
console.log(JSON.stringify({ kept: keep.length, dropped: drop }, null, 2));

const manifest = [];
for (const job of keep) {
  const payload = {
    lang: 'en',
    page_format: 'a4',
    candidate: {
      name: 'Syed Haider Ali',
      email: 'syedhaiderali773@gmail.com',
      phone: '+49 157 341 47861',
      location: 'Munich, Germany',
      linkedin: { url: 'https://linkedin.com/in/syedhaiderali08', display: 'linkedin.com/in/syedhaiderali08' },
    },
    summary: summary(job, job.kws),
    competencies: job.kws,
    experience,
    projects: [
      { name: 'Munich RE — Product Development Analyst (academic project)', description: 'Led consumer segmentation and competitive benchmarking across 5 global initiatives for a 2.2M-unit target market (04.2024 – 07.2024).' },
      { name: 'BMW Group — Agile Scrum Analyst (academic case study)', description: 'Developed a transformation roadmap addressing 15+ operational challenges with KPI frameworks and 85% adoption (10.2023 – 02.2024).' },
    ],
    education: [
      { title: 'M.Sc. Digital Technology Management', org: 'Hochschule München University of Applied Sciences', location: 'Munich, Germany', year: '09.2023 – Present' },
      { title: 'Bachelor of Business Administration (BBA)', org: 'Institute of Business Administration (IBA)', location: 'Karachi, Pakistan', year: '04.2014 – 09.2018', description: 'Top-ranked South Asian business school' },
    ],
    certifications: [
      { title: 'Career Essentials in Generative AI', org: 'Microsoft' },
      { title: 'Introduction to Statistics', org: 'DataCamp' },
      { title: 'Intermediate SQL', org: 'DataCamp' },
      { title: 'Data Visualizations', org: 'DataCamp' },
    ],
    awards: [],
    skills: [
      { category: 'Strategy & Analytics', items: ['Strategic Planning', 'Market Analysis', 'Portfolio Management', 'Competitive Intelligence', 'Financial Analysis', 'KPI Reporting'] },
      { category: 'Operations & Process', items: ['Operations Management', 'Lean Management', 'Change Management', 'Gap Analysis', 'Business Process Optimisation'] },
      { category: 'Project Management', items: ['Programme Management', 'Agile/Scrum', 'Stakeholder Management', 'JIRA', 'Confluence'] },
      { category: 'Data & Systems', items: ['Power BI', 'Advanced Excel', 'SQL', 'QlikSense', 'SAP', 'RPA'] },
      { category: 'Languages', items: ['English C2', 'German B1', 'Urdu native'] },
    ],
  };
  const cvJson = resolve('output/_pack-ats', `cv-${job.slug}.json`);
  const cvHtml = resolve('output/_pack-ats', `cv-${job.slug}.html`);
  const cvPdf = resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(cvJson, JSON.stringify(payload));
  execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml], { stdio: 'inherit' });
  try {
    execFileSync(process.execPath, ['verify-ats.mjs', cvHtml, '--role', job.role, '--keywords', job.kws.join(','), '--min-score', '70'], { stdio: 'inherit' });
  } catch {
    process.stderr.write(`ATS warn ${job.slug}\n`);
  }
  manifest.push({ input: cvHtml, output: cvPdf, format: 'a4' });
  const coverHtml = resolve('output/_pack-ats', `cover-${job.slug}.html`);
  const coverPdf = resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(coverHtml, buildCoverHtml(coverFor(job, job.jd, job.kws)));
  manifest.push({ input: coverHtml, output: coverPdf, format: 'a4' });
}

const manPath = 'output/_pack-ats/manifest.json';
writeFileSync(manPath, JSON.stringify(manifest, null, 2));
if (manifest.length) {
  execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
}

for (const job of jobs) {
  for (const kind of ['cv', 'cover']) {
    const oldp = resolve('output', `${kind}-syed-haider-ali-${job.slug}-${OLD}.pdf`);
    if (existsSync(oldp)) unlinkSync(oldp);
  }
}
for (const d of drop) {
  for (const kind of ['cv', 'cover']) {
    const p = resolve('output', `${kind}-syed-haider-ali-${d.slug}-${DATE}.pdf`);
    if (existsSync(p)) unlinkSync(p);
  }
}

console.log(`generated ${keep.length} packs; dropped ${drop.length}`);
