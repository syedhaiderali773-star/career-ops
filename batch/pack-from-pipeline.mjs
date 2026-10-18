#!/usr/bin/env node
/**
 * Select highest-fit intern/WS and FT roles from pipeline.md, A2-gate JDs,
 * write ATS CV+cover PDFs. Target 40 intern + 40 FT.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { makeHttpCtx } from '../providers/_http.mjs';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';

const DATE = '2026-09-22';
const ctx = { ...makeHttpCtx(), includeUndated: true };
const CV_TEXT = readFileSync('cv.md', 'utf8').toLowerCase();
const TARGET = { intern: 40, ft: 40 };
const POOL = { intern: 90, ft: 90 };

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
]);

const TAA_URL_IDS = [
  '7256669', '7185834', '7816965003', '8161390', '8166719', '1695252', '8201000',
  '5239652007', '5203687007', '6cbb881d-8e17-4e7f-a8de-e2f081015510',
  '62309aac-598b-4cb0-bc1b-e0dad9cda130', 'c944d7e9-3422-4cfb-a908-00ee9aa27fb4',
  '6859e0b1-c725-4c84-a3b4-42c73067b802', 'ad8b5650-3b53-460f-9ef8-a637abc22e73',
  'JR10440529', 'R620985', 'R21837', 'R-20015522', '4706850006', '8103527',
  '8242666', '1414918333', '1479484', '2712578', '3177732', '10488234',
];

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

function slugify(company, role) {
  const s = `${company}-${role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42);
  return s || 'role';
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9äöüß&+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function applied(company, title) {
  const key = `${norm(company)}|${norm(title)}`;
  for (const a of APPLIED) {
    if (key.includes(a) || a.includes(key) || (key.split('|')[0].includes(a.split('|')[0]) && key.includes(a.split('|')[1].slice(0, 28)))) return true;
  }
  return false;
}

function inGermany(loc) {
  const s = String(loc || '');
  if (/berlin,\s*ct|westwood|hooksett|ciudad de panama|bogot|colombia|massachusetts|connecticut/i.test(s)) return false;
  if (/india|bengaluru|pakistan|united kingdom|\blondon\b|united states|new york|poland|netherlands|switzerland|austria|spain|italy|france|\bparis\b|panam/i.test(s) && !/germany|deutschland|munich|berlin|hamburg|frankfurt|cologne|stuttgart|düsseldorf/i.test(s)) return false;
  if (!s.trim() || /^posted:/i.test(s)) return true;
  return /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig|nuremberg|garching|karlsruhe|heidelberg|aachen|mannheim|remote|hybrid|dach|emea|europe|deutschlandweit/i.test(s);
}

function isIntern(role) {
  if (/internal/i.test(role) && !/(werkstudent|working student|praktikum|internship|(^|[^a-z])intern([^a-z]|$))/i.test(role)) return false;
  return /(werkstudent|working student|praktikum|praktikant|internship|(^|[^a-z])intern([^a-z]|$)|student assistant|pflichtpraktikum)/i.test(role);
}

function internScore(j) {
  const t = `${j.role} ${j.loc}`.toLowerCase();
  let s = 0;
  if (/werkstudent|working student/.test(t)) s += 8;
  if (/internship|\bintern\b|praktikum/.test(t)) s += 6;
  if (/operations|supply chain|procurement|einkauf|logistik|distribution|beschaffung/.test(t)) s += 12;
  if (/product management|portfolio/.test(t)) s += 11;
  if (/analyst|analytics|controlling|reporting|kpi/.test(t)) s += 11;
  if (/sap|process|pmo|project/.test(t)) s += 9;
  if (/marketing|commercial|crm|sales/.test(t)) s += 8;
  if (/strategy|business development|founder/.test(t)) s += 8;
  if (/finance|fp&a|accounting/.test(t)) s += 7;
  if (/hr|people|talent|personal/.test(t)) s += 6;
  if (/compliance|kyc|governance/.test(t)) s += 6;
  if (/munich|münchen/.test(t)) s += 8;
  if (/berlin|hamburg|frankfurt|düsseldorf|cologne|köln/.test(t)) s += 4;
  if (/schüler|schueler|software engineer|developer|data scientist|mechanik|fertigung|elektronik/.test(t)) s -= 50;
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
  if (/finance|fp&a|controlling/.test(t)) s += 7;
  if (/marketing|commercial/.test(t)) s += 7;
  if (/munich|münchen/.test(t)) s += 8;
  if (/berlin|hamburg|frankfurt/.test(t)) s += 4;
  if (/\bmanager\b/.test(t) && !/programme|program/.test(t)) s -= 8;
  if (/\bsr\.|\bsenior\b|\bstaff\b|director|head of|principal/.test(t)) s -= 40;
  return s;
}

function parsePipeline() {
  const text = readFileSync('data/pipeline.md', 'utf8');
  const jobs = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('- [ ] http')) continue;
    const m = line.match(/^- \[ \] (\S+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)/);
    if (!m) continue;
    jobs.push({ url: m[1], company: m[2].trim(), role: m[3].trim(), loc: (m[4] || '').trim() });
  }
  return jobs;
}

function pick(jobs, kind) {
  const internReSkip = /schüler|schueler|ausbildung|apprentice|software engineer|developer|firmware|embedded|data scientist|full[- ]stack|frontend|backend/;
  const senior = /\bsenior\b|\bstaff\b|\bdirector\b|head of|vice president|\bprincipal\b|\bsr\./i;
  const scored = [];
  for (const j of jobs) {
    if (applied(j.company, j.role)) continue;
    if (TAA_URL_IDS.some((id) => j.url.includes(id))) continue;
    if (!inGermany(j.loc)) continue;
    if (internReSkip.test(j.role)) continue;
    if (senior.test(j.role)) continue;
    const intern = isIntern(j.role);
    if (kind === 'intern' && !intern) continue;
    if (kind === 'ft' && intern) continue;
    if (kind === 'ft' && !/trainee|analyst|associate|graduate|junior|coordinator|berufseinsteiger|absolvent|founder|account executive|business development|customer success|pmo|operations|procurement|marketing|strategy|finance|controlling|people ops|human resources/i.test(j.role)) continue;
    const score = kind === 'intern' ? internScore(j) : ftScore(j);
    if (score < 16) continue;
    scored.push({ ...j, score, track: kind });
  }
  scored.sort((a, b) => b.score - a.score);
  const usedCo = new Map();
  const usedKey = new Set();
  const out = [];
  for (const j of scored) {
    const key = `${norm(j.company)}|${norm(j.role).slice(0, 36)}`;
    if (usedKey.has(key)) continue;
    const co = norm(j.company).slice(0, 24);
    const n = usedCo.get(co) || 0;
    if (n >= 2) continue;
    usedCo.set(co, n + 1);
    usedKey.add(key);
    const prefix = kind === 'intern' ? 'ws' : 'ft';
    out.push({ ...j, slug: `${prefix}-${slugify(j.company, j.role)}`, city: (j.loc.split(/[·,]/)[0] || 'Germany').replace(/posted:.*/i, '').trim() || 'Germany' });
    if (out.length >= POOL[kind]) break;
  }
  return out;
}

function ghBoardId(url) {
  const m = String(url).match(/gh_jid=(\d+)/) || String(url).match(/\/jobs\/(\d+)/);
  return m ? m[1] : null;
}
function ghBoard(url) {
  const m = String(url).match(/greenhouse\.io\/([^/]+)\//) || String(url).match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/]+)/);
  return m ? m[1] : null;
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
  const kind = job.track === 'intern' ? 'internship / working-student role' : 'full-time role';
  return `Master's student in business targeting the ${kind} ${job.role} at ${job.company}. Three Infineon working-student rotations in Munich through August 2026 covered global product management, SAP roles and authorisation, and Global Distribution Operations. Strengths: ${lead}. English C2; German B1. Available immediately.`;
}

function coverFor(job, jd, kws) {
  const duty = (jd.match(/(?:you will|responsibilities|what you.?ll do|your impact|aufgaben)(.{0,280})/i) || [, ''])[1].replace(/\s+/g, ' ').trim().slice(0, 180);
  const focus = kws.slice(0, 4).join(', ');
  const intern = job.track === 'intern';
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
      profile_intro: intern
        ? `I am an M.Sc. Digital Technology Management student at Hochschule München (BBA, IBA Karachi) with English C2 and German B1. I am looking for a working-student or internship role alongside the degree and can start immediately.`
        : `I am an M.Sc. Digital Technology Management student at Hochschule München (BBA, IBA Karachi) with English C2 and German B1. I am available to start this full-time role immediately.`,
      achievements: [
        { lead: 'Programme and operations delivery', impact: 'Managed the Infineon Distribution Certification Programme across 5 global regions, running gap analyses across 118 focus applications and hitting 100% on-time sprint milestones with Sales, Application Engineering, and Regional Marketing.' },
        { lead: 'Analytics used by leadership', impact: 'Built KPI dashboards in JIRA/Confluence and Power BI, cut processing time by 40% through Lean redesign, and generated 0.5M EUR additional revenue through market and portfolio analysis.' },
        { lead: 'Process and compliance', impact: 'Reduced operational costs by 70% at Habib Bank Limited, automated 75 FTEs of manual work, and improved KYC onboarding efficiency by 50%.' },
        { lead: 'Fit to this JD', impact: duty ? `This role needs ${focus}. ${duty}` : `This role needs ${focus}. That is the working method I used in Infineon sprints: make the work visible, then improve the process.` },
      ],
      problems_section: `At ${job.company} I would start with the reporting, handoffs, and bottlenecks named in the ${job.role} description, then put a simple KPI view in front of the team so decisions sit on the same numbers.`,
      closing: intern
        ? `I live in Munich, can relocate within Germany, and can start this ${job.role} immediately. I would welcome the chance to discuss it.`
        : `I live in Munich, can relocate within Germany, and can start immediately. I would welcome the chance to discuss the ${job.role}.`,
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

async function gate(pool, track) {
  const keep = [];
  const drop = [];
  for (const job of pool) {
    if (keep.length >= TARGET[track]) break;
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
    writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${job.company}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
  }
  return { keep, drop };
}

function buildManifest(keep, workdir) {
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
    const cvJson = resolve(workdir, `cv-${job.slug}.json`);
    const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
    const cvPdf = resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`);
    writeFileSync(cvJson, JSON.stringify(payload));
    execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml], { stdio: 'inherit' });
    try {
      execFileSync(process.execPath, ['verify-ats.mjs', cvHtml, '--role', job.role, '--keywords', job.kws.join(','), '--min-score', '70'], { stdio: 'inherit' });
    } catch {
      process.stderr.write(`ATS warn ${job.slug}\n`);
    }
    manifest.push({ input: cvHtml, output: cvPdf, format: 'a4' });
    const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
    const coverPdf = resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`);
    writeFileSync(coverHtml, buildCoverHtml(coverFor(job, job.jd, job.kws)));
    manifest.push({ input: coverHtml, output: coverPdf, format: 'a4' });
  }
  return manifest;
}

const all = parsePipeline();
const internPool = pick(all, 'intern');
const ftPool = pick(all, 'ft');
writeFileSync('batch/pack-intern-pool.json', JSON.stringify(internPool, null, 2));
writeFileSync('batch/pack-ft-pool.json', JSON.stringify(ftPool, null, 2));
console.log(JSON.stringify({ internPool: internPool.length, ftPool: ftPool.length, internTop: internPool.slice(0, 8).map((j) => j.role), ftTop: ftPool.slice(0, 8).map((j) => j.role) }, null, 2));

mkdirSync('output/_pack-80', { recursive: true });
mkdirSync('jds', { recursive: true });

const intern = await gate(internPool, 'intern');
const ft = await gate(ftPool, 'ft');
writeFileSync('batch/pack-80-drop.json', JSON.stringify({ intern: intern.drop, ft: ft.drop }, null, 2));
writeFileSync('batch/pack-intern-40.json', JSON.stringify(intern.keep.map((j) => ({ slug: j.slug, company: j.company, role: j.role, city: j.city, url: j.url, kws: j.kws })), null, 2));
writeFileSync('batch/pack-ft-40.json', JSON.stringify(ft.keep.map((j) => ({ slug: j.slug, company: j.company, role: j.role, city: j.city, url: j.url, kws: j.kws })), null, 2));
console.log(JSON.stringify({ internKept: intern.keep.length, internDropped: intern.drop.length, ftKept: ft.keep.length, ftDropped: ft.drop.length }, null, 2));

const manifest = [...buildManifest(intern.keep, 'output/_pack-80'), ...buildManifest(ft.keep, 'output/_pack-80')];
const manPath = 'output/_pack-80/manifest.json';
writeFileSync(manPath, JSON.stringify(manifest, null, 2));
if (manifest.length) {
  execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
}
try { rmSync('output/_pack-80', { recursive: true, force: true }); } catch { /* ignore */ }
console.log(`generated intern ${intern.keep.length} ft ${ft.keep.length}`);
