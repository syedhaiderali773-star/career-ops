import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';

const DATE = '2026-09-21';
const jobs = JSON.parse(readFileSync(new URL('./pack-40-jobs.json', import.meta.url), 'utf8'));

const FOCUS = {
  analyst: {
    summary: (role, company) =>
      `Business analyst targeting ${role} at ${company}. Completed three Infineon working-student rotations in Munich through August 2026 in global product management, SAP roles and authorisation, and Global Distribution Operations. Built KPI dashboards, gap analyses, and portfolio work used by leadership. English C2; German B1. Available immediately.`,
    competencies: ['KPI reporting', 'Gap analysis', 'Power BI', 'Market analysis', 'Stakeholder management', 'JIRA', 'Process optimisation', 'Excel'],
  },
  ops: {
    summary: (role, company) =>
      `Operations professional targeting ${role} at ${company}. Three Infineon working-student rotations through August 2026 covered distribution programme delivery, SAP process work, and Lean cycle-time cuts. Earlier banking work automated compliance monitoring and reduced operational cost. English C2; German B1. Available immediately.`,
    competencies: ['Operations', 'Programme management', 'Lean process improvement', 'Cross-functional coordination', 'Compliance', 'JIRA', 'Gap analysis', 'Stakeholder management'],
  },
  marketing: {
    summary: (role, company) =>
      `Commercial analyst targeting ${role} at ${company}. Infineon product-management work included market analysis, portfolio optimisation, and regional marketing coordination. Bank Alfalah campaigns lifted digital product registrations by 40% and a Power BI dashboard automated management reporting. English C2; German B1. Available immediately.`,
    competencies: ['Marketing analytics', 'Campaign management', 'Consumer insights', 'Power BI', 'Market analysis', 'Stakeholder management', 'CRM', 'Excel'],
  },
  finance: {
    summary: (role, company) =>
      `Analyst targeting ${role} at ${company}. Infineon product-management work generated €0.5M additional revenue through market and portfolio analysis. Habib Bank Limited automation cut operational costs by 70%. Built a Power BI dashboard consolidating transactions, KPIs, and pricing. English C2; German B1. Available immediately.`,
    competencies: ['Financial analysis', 'KPI reporting', 'Power BI', 'Excel', 'Process automation', 'Stakeholder management', 'Market analysis', 'SAP'],
  },
  hr: {
    summary: (role, company) =>
      `People-operations candidate targeting ${role} at ${company}. Infineon SAP Roles & Authorisation work sat inside a transformation programme for 58,000+ employees. Bank Alfalah training reached 70+ staff; K-Electric training covered 5 business units. English C2; German B1. Available immediately.`,
    competencies: ['SAP SuccessFactors', 'Training & development', 'Stakeholder management', 'Change management', 'KPI reporting', 'Process optimisation', 'JIRA', 'Excel'],
  },
  strategy: {
    summary: (role, company) =>
      `Strategy and operations candidate targeting ${role} at ${company}. Wrote a 5-year digital transformation roadmap at K-Electric and delivered Infineon distribution execution roadmaps across 5 regions. Academic BMW change case set KPI frameworks with 85% adoption. English C2; German B1. Available immediately.`,
    competencies: ['Strategic planning', 'Business development', 'Change management', 'Stakeholder management', 'Gap analysis', 'KPI reporting', 'Market analysis', 'Programme management'],
  },
};

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

const projects = [
  {
    name: 'Munich RE — Product Development Analyst (academic project)',
    description: 'Led consumer segmentation and competitive benchmarking across 5 global initiatives for a 2.2M-unit target market — producing executive-level investment-grade product differentiation strategies (04.2024 – 07.2024).',
  },
  {
    name: 'BMW Group — Agile Scrum Analyst (academic case study)',
    description: 'Developed a transformation roadmap addressing 15+ operational challenges — established KPI frameworks and achieved 85% adoption rate through structured change management (10.2023 – 02.2024).',
  },
];

const education = [
  { title: 'M.Sc. Digital Technology Management', org: 'Hochschule München University of Applied Sciences', location: 'Munich, Germany', year: '09.2023 – Present' },
  { title: 'Bachelor of Business Administration (BBA)', org: 'Institute of Business Administration (IBA)', location: 'Karachi, Pakistan', year: '04.2014 – 09.2018', description: 'Top-ranked South Asian business school' },
];

const certifications = [
  { title: 'Career Essentials in Generative AI', org: 'Microsoft' },
  { title: 'Introduction to Statistics', org: 'DataCamp' },
  { title: 'Intermediate SQL', org: 'DataCamp' },
  { title: 'Data Visualizations', org: 'DataCamp' },
];

const skills = [
  { category: 'Strategy & Analytics', items: ['Strategic Planning', 'Market Analysis', 'Portfolio Management', 'Competitive Intelligence', 'Financial Analysis', 'KPI Reporting'] },
  { category: 'Operations & Process', items: ['Operations Management', 'Lean Management', 'Change Management', 'Gap Analysis', 'Business Process Optimisation'] },
  { category: 'Project Management', items: ['Programme Management', 'Agile/Scrum', 'Stakeholder Management', 'JIRA', 'Confluence'] },
  { category: 'Data & Systems', items: ['Power BI', 'Advanced Excel', 'SQL', 'QlikSense', 'SAP', 'RPA'] },
  { category: 'Languages', items: ['English C2', 'German B1', 'Urdu native'] },
];

function cvPayload(job) {
  const f = FOCUS[job.focus] || FOCUS.ops;
  return {
    lang: 'en',
    page_format: 'a4',
    candidate: {
      name: 'Syed Haider Ali',
      email: 'syedhaiderali773@gmail.com',
      phone: '+49 157 341 47861',
      location: 'Munich, Germany',
      linkedin: { url: 'https://linkedin.com/in/syedhaiderali08', display: 'linkedin.com/in/syedhaiderali08' },
    },
    summary: f.summary(job.role, job.company),
    competencies: f.competencies,
    experience,
    projects,
    education,
    certifications,
    awards: [],
    skills,
  };
}

function coverPayload(job) {
  const track = job.track === 'ft' ? 'full-time' : 'internship / working-student';
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
      opening: `I am applying for the ${job.role} in ${job.city}. I recently completed three Infineon working-student rotations in Munich and I am available to start this ${track} role immediately.`,
      profile_intro: `I am an M.Sc. Digital Technology Management student at Hochschule München with English C2 and German B1. My Infineon work covered global product management, SAP roles and authorisation, and Global Distribution Operations. Before that I delivered process automation at Habib Bank Limited and a five-year transformation roadmap at K-Electric.`,
      achievements: [
        { lead: 'Distribution programme delivery', impact: 'Managed the Infineon Distribution Certification Programme across 5 global regions, running gap analyses across 118 focus applications and hitting 100% on-time sprint milestones with Sales, Application Engineering, and Regional Marketing.' },
        { lead: 'Measured operations impact', impact: 'Cut processing time by 40% through Lean lifecycle redesign and reduced compliance monitoring violations by 98.5% while coordinating Supply Chain, Customer Logistics, and Regional Marketing.' },
        { lead: 'Commercial proof', impact: 'Generated €0.5M additional revenue through market analysis and portfolio work at Infineon, and increased digital product registrations by 40% at Bank Alfalah with a Power BI dashboard that automated management reporting.' },
        { lead: 'Automation and scale', impact: 'Reduced operational costs by 70% at Habib Bank Limited, automated 75 FTEs of manual workload, and improved KYC onboarding efficiency by 50%.' },
      ],
      problems_section: `At ${job.company} I would start by mapping the role's current reporting, handoffs, and bottlenecks, then put a simple KPI view in front of the team so decisions sit on the same numbers. That is the working method I used in Infineon sprints and in the Bank Alfalah dashboard: make the work visible, then improve the process.`,
      closing: `I live in Munich, can relocate within Germany, and can start immediately. I would welcome the chance to discuss the ${job.role} with you.`,
    },
  };
}

mkdirSync('output/_pack40', { recursive: true });
mkdirSync('jds', { recursive: true });
const manifest = [];

for (const job of jobs) {
  writeFileSync(`jds/${job.slug}.md`, `Posted: not visible in source\n\n# ${job.role}\n\nCompany: ${job.company}\nLocation: ${job.city}, Germany\nURL: ${job.url}\nTrack: ${job.track}\n`);
  const cvJson = resolve('output/_pack40', `cv-${job.slug}.json`);
  const cvHtml = resolve('output/_pack40', `cv-${job.slug}.html`);
  const cvPdf = resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(cvJson, JSON.stringify(cvPayload(job)));
  execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml], { stdio: 'inherit' });
  manifest.push({ input: cvHtml, output: cvPdf, format: 'a4' });

  const coverHtml = resolve('output/_pack40', `cover-${job.slug}.html`);
  const coverPdf = resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`);
  writeFileSync(coverHtml, buildCoverHtml(coverPayload(job)));
  manifest.push({ input: coverHtml, output: coverPdf, format: 'a4' });
}

const manPath = 'output/_pack40/manifest.json';
writeFileSync(manPath, JSON.stringify(manifest, null, 2));
execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
console.log(`generated ${jobs.length} packs`);
