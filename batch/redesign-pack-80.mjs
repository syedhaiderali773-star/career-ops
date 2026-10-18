#!/usr/bin/env node
/**
 * Rebuild intern/WS + FT packs: DACH layout, JD keywords, group-specific wording.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { makeHttpCtx } from '../providers/_http.mjs';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import { resolveTemplate } from '../cv-templates.mjs';

const DATE = '2026-09-22';
const ctx = { ...makeHttpCtx(), includeUndated: true };
const CV_TEXT = readFileSync('cv.md', 'utf8').toLowerCase();
const CV_TPL = resolveTemplate('cv', 'dach');

const DROP = new Set([
  'ft-due-product-operations-analyst-associate',
  'ft-humana-associate-vp-clinical-program-and-p',
  'ft-cr-dit-agricole-cib-international-business',
  'ws-cargo-one-working-student-partner-operatio',
]);

const DISPLAY = {
  solarisbank: 'Solaris', xometryeurope: 'Xometry', 'Trusteq Gmbh': 'Trusteq',
  ag: 'Airbus', dnb: 'Dun & Bradstreet', lightspeedhq: 'Lightspeed',
  marvelfusion: 'Marvel Fusion', 'emma-sleep': 'emma', 'HelloFresh SE': 'HelloFresh',
  Applovin: 'AppLovin', peec: 'Peec AI', rhe: 'Rheinmetall', hitachi: 'Hitachi',
  salesforce: 'Salesforce', thermofisher: 'Thermo Fisher', hiscox: 'Hiscox',
  mmc: 'Marsh McLennan', getec: 'GETEC', iqvia: 'IQVIA',
  '1 & 1 Mail & Media Applications SE': '1&1',
  'Amazon EU SARL (Germany Branch) - D70': 'Amazon',
  'AERO HighProfessionals GmbH': 'Airbus (via AERO)',
  'Siemens Energy Global GmbH & Co. KG': 'Siemens Energy',
  'Weflow / getweflow.com': 'Weflow', 'Lemon Markets': 'lemon.markets',
  'JustPlay GmbH': 'JustPlay', 'KNIME AG': 'KNIME', 'Checkmk GmbH': 'Checkmk',
  'Odonnell Moonshine': "O'Donnell Moonshine", 'Flink Food': 'Flink',
  airup: 'air up', isaraerospace: 'Isar Aerospace', Autarcenergy: 'Autarc',
  navvis: 'NavVis', phlair: 'Phlair', 'Volkswagen Group': 'Volkswagen Group',
};

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

function companyName(job) {
  return DISPLAY[job.company] || job.company;
}

function classify(job) {
  const t = `${job.role} ${job.slug}`.toLowerCase();
  if (/procur|supply chain|logistik|einkauf|fulfillment|distribution|beschaffung|scm|planning & procurement/.test(t)) return 'supplychain';
  if (/financ|account|controll|fp&a|underwrit|bill|treasury|m&a|corporate finance/.test(t)) return 'finance';
  if (/hr|people|talent|personal|workplace|chro/.test(t)) return 'people';
  if (/legal|compliance|kyc|governance|aml/.test(t)) return 'legal';
  if (/sales|account executive|business development analyst|gtm|outbound|partner/.test(t) && !/analyst/.test(t)) return 'sales';
  if (/market|growth|gtm|campaign|brand|communications/.test(t) && /analyst|intelligence|data/.test(t)) return 'analyst';
  if (/market|growth|campaign|brand|communications|field marketing/.test(t)) return 'marketing';
  if (/analyst|analytics|business intelligence|reporting|data operations/.test(t)) return 'analyst';
  if (/trainee|graduate|berufseinsteiger/.test(t)) return 'trainee';
  if (/strateg|founder|transformation|product owner|product lead|ceo office|coo/.test(t)) return 'strategy';
  return 'ops';
}

function keywordsFrom(text, extras = []) {
  const t = String(text || '').toLowerCase();
  const hits = [];
  for (const k of extras.concat(ALLOWED)) {
    if (t.includes(k) && CV_TEXT.includes(k.split(' ')[0]) && !hits.includes(k)) hits.push(k);
  }
  for (const k of ['stakeholder management', 'excel', 'operations', 'kpi reporting', 'gap analysis', 'power bi']) {
    if (hits.length >= 8) break;
    if (!hits.includes(k)) hits.push(k);
  }
  return hits.slice(0, 8);
}

function dutySnippet(jd) {
  const m = String(jd || '').match(/(?:you will|you will be|responsibilities|what you.?ll do|your impact|we expect|aufgaben|your role)[:\s]+(.{40,240})/i);
  const raw = (m?.[1] || '').replace(/\s+/g, ' ').replace(/[—–]/g, '-').trim();
  const sentence = raw.split(/(?<=[.!?])\s+/)[0] || raw;
  if (sentence.length <= 160) return sentence;
  return sentence.slice(0, 160).replace(/\s+\S*$/, '');
}

function pickModules(group) {
  const map = {
    analyst: 'Big Data and Artificial Intelligence 1.0; Financial Strategies for Digital Technology Management 1.0; Research Methods: Digital Products, Processes and Systems 2.8',
    supplychain: 'Research Methods: Digital Products, Processes and Systems 2.8; Agile Management Practices 3.0; Financial Strategies for Digital Technology Management 1.0',
    finance: 'Financial Strategies for Digital Technology Management 1.0; Economics of Digitization 2.0; Big Data and Artificial Intelligence 1.0',
    people: 'Cross-cultural Communication and Management 1.7; Digital Technology: Leadership and Ethics 2.0; Agile Management Practices 3.0',
    marketing: 'Digital Commerce and Technology Marketing 2.3; Cross-cultural Communication and Management 1.7; Economics of Digitization 2.0',
    sales: 'Digital Commerce and Technology Marketing 2.3; Cross-cultural Communication and Management 1.7; Financial Strategies for Digital Technology Management 1.0',
    ops: 'Agile Management Practices 3.0; Research Methods: Digital Products, Processes and Systems 2.8; Design Thinking for Digital Technology Development 1.7',
    strategy: 'Design Thinking for Digital Technology Development 1.7; Research Project: Digital Business Development 3.0; Economics of Digitization 2.0',
    legal: 'Legal Issues for Data-driven Business 2.3; Digital Technology: Intellectual Property Rights 2.0; Cross-cultural Communication and Management 1.7',
    trainee: 'Cross-cultural Communication and Management 1.7; Agile Management Practices 3.0; Financial Strategies for Digital Technology Management 1.0',
  };
  return map[group] || map.ops;
}

function summaryFor(job, group, kws) {
  const co = companyName(job);
  const intern = job.track === 'intern';
  const kind = intern ? 'working-student / internship' : 'full-time';
  const lead = kws.slice(0, 4).join(', ');
  const byGroup = {
    analyst: `Business analyst targeting the ${kind} ${job.role} at ${co}. Three Infineon working-student rotations in Munich through August 2026 covered gap analysis, KPI dashboards, and market/portfolio work. Strengths: ${lead}. M.Sc. Digital Technology Management (modules completed; Big Data and AI 1.0). English C2; German B1. Available immediately.`,
    supplychain: `Operations professional targeting the ${kind} ${job.role} at ${co}. Infineon Global Product Management worked with Supply Chain and Customer Logistics; Global Distribution Operations ran a certification programme across 5 regions. Strengths: ${lead}. English C2; German B1. Available immediately.`,
    finance: `Analyst with cost, revenue, and reporting proof targeting the ${kind} ${job.role} at ${co}. Power BI financial intelligence at Bank Alfalah; 70% cost reduction at Habib Bank; EUR 0.5M additional revenue from Infineon market and portfolio analysis. Strengths: ${lead}. Financial Strategies for Digital Technology Management 1.0. English C2; German B1. Available immediately.`,
    people: `Operations professional targeting the ${kind} ${job.role} at ${co}. Infineon SAP Roles and Authorisation served 58,000+ employees in 40+ countries; training delivered to 70+ staff and 5 business units. Strengths: ${lead}. Cross-cultural Communication and Management 1.7. English C2; German B1. Available immediately.`,
    marketing: `Commercial analyst targeting the ${kind} ${job.role} at ${co}. Bank Alfalah campaigns lifted digital product registrations 40%; Infineon voice-of-customer reports supported 5 regional distributor networks. Strengths: ${lead}. Digital Commerce and Technology Marketing 2.3. English C2; German B1. Available immediately.`,
    sales: `Commercial operator targeting the ${kind} ${job.role} at ${co}. Infineon work sat with Sales and Regional Marketing; portfolio analysis added EUR 0.5M. Strengths: ${lead}. English C2; German B1. Available immediately.`,
    ops: `Operations professional targeting the ${kind} ${job.role} at ${co}. Infineon distribution programme: 5 regions, 118 focus applications, 100% on-time sprints. Earlier process automation cut 75 FTEs of manual work. Strengths: ${lead}. English C2; German B1. Available immediately.`,
    strategy: `Strategy and operations professional targeting the ${kind} ${job.role} at ${co}. Wrote a 5-year digital transformation roadmap across 5 business units; Infineon rotations covered product, SAP, and distribution programmes. Strengths: ${lead}. English C2; German B1. Available immediately.`,
    legal: `Operations professional targeting the ${kind} ${job.role} at ${co}. Habib Bank KYC onboarding improved 50%; Infineon product work cut compliance monitoring violations 98.5%. Strengths: ${lead}. Legal Issues for Data-driven Business 2.3. English C2; German B1. Available immediately.`,
    trainee: `Graduate targeting the ${kind} ${job.role} at ${co}. Three Infineon working-student rotations (product management, SAP roles and authorisation, distribution operations) plus banking and energy delivery. Strengths: ${lead}. English C2; German B1. Available immediately.`,
  };
  return byGroup[group] || byGroup.ops;
}

function bulletsFor(group) {
  const gdo = {
    analyst: [
      'Built voice-of-customer intelligence reports and programme materials for 5 regional distributor networks, giving leadership a shared view of adoption gaps',
      'Ran gap analyses across 118 focus applications in the Distribution Certification Programme across 5 global regions',
      'Delivered 100% on-time sprint milestones with Application Engineering, Sales, and Regional Marketing',
    ],
    supplychain: [
      'Managed the Distribution Certification Programme across 5 global regions, running gap analyses across 118 focus applications and building execution roadmaps',
      'Coordinated Application Engineering, Sales, and Regional Marketing to 100% on-time sprint milestones',
      'Standardised governance and commercial materials for 5 regional distributor networks',
    ],
    finance: [
      'Tracked programme delivery to 100% on-time sprint milestones across 5 regions and 118 focus applications',
      'Produced voice-of-customer reports used for commercial alignment across 5 distributor networks',
      'Built execution roadmaps so regional product adoption could be measured and managed',
    ],
    people: [
      'Coordinated Application Engineering, Sales, and Regional Marketing across 5 regions to 100% on-time sprint milestones',
      'Wrote programme materials that standardised how 5 regional distributor networks worked the same process',
      'Ran gap analyses across 118 focus applications and turned them into execution roadmaps',
    ],
    marketing: [
      'Developed voice-of-customer intelligence reports for 5 regional distributor networks',
      'Aligned Sales and Regional Marketing on a shared certification programme across 5 regions',
      'Ran gap analyses across 118 focus applications to show where product adoption was stalling',
    ],
    sales: [
      'Worked with Sales and Regional Marketing on the Distribution Certification Programme across 5 global regions',
      'Produced voice-of-customer reports and commercial materials for 5 distributor networks',
      'Hit 100% on-time sprint milestones while running gap analyses across 118 focus applications',
    ],
    ops: [
      'Managed the Distribution Certification Programme across 5 global regions: gap analyses across 118 focus applications and execution roadmaps',
      'Delivered 100% on-time sprint milestones with Application Engineering, Sales, and Regional Marketing',
      'Standardised governance materials for 5 regional distributor networks',
    ],
    strategy: [
      'Built execution roadmaps from gap analyses across 118 focus applications in 5 regions',
      'Gave senior stakeholders a single view of programme progress through 100% on-time sprint delivery',
      'Wrote voice-of-customer reports that aligned commercial and regional teams',
    ],
    legal: [
      'Standardised governance materials for 5 regional distributor networks on the Distribution Certification Programme',
      'Ran gap analyses across 118 focus applications so compliance and adoption issues were visible',
      'Delivered 100% on-time sprint milestones with Sales, Application Engineering, and Regional Marketing',
    ],
    trainee: [
      'Managed the Distribution Certification Programme across 5 global regions, including gap analyses across 118 focus applications',
      'Delivered 100% on-time sprint milestones with Application Engineering, Sales, and Regional Marketing',
      'Produced voice-of-customer reports and programme materials for 5 regional distributor networks',
    ],
  };
  const sap = {
    analyst: [
      'Built JIRA/Confluence dashboards tracking 5+ concurrent workstreams for senior leadership',
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Contributed to the IT R&A Process Transformation Programme serving 58,000+ employees across 40+ countries',
    ],
    supplychain: [
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Tracked 5+ concurrent workstreams in JIRA/Confluence so programme status was visible',
      'Supported a transformation programme serving 58,000+ employees across 40+ countries',
    ],
    finance: [
      'Gave senior leadership real-time programme visibility through JIRA/Confluence dashboards on 5+ workstreams',
      'Delivered 7 consecutive monthly sprints at 100% on-time inside structured agile governance',
      'Worked on the IT R&A Process Transformation Programme serving 58,000+ employees',
    ],
    people: [
      'Contributed to the IT R&A Process Transformation Programme serving Infineon\'s global workforce of 58,000+ employees across 40+ countries',
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Built JIRA/Confluence dashboards tracking 5+ concurrent workstreams',
    ],
    marketing: [
      'Built JIRA/Confluence dashboards so programme status was visible to senior leadership',
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Supported a global R&A transformation serving 58,000+ employees',
    ],
    sales: [
      'Kept 5+ concurrent workstreams visible to leadership through JIRA/Confluence dashboards',
      'Delivered 7 consecutive monthly sprints at 100% on-time',
      'Contributed to SAP R&A transformation covering 40+ countries',
    ],
    ops: [
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Built JIRA/Confluence dashboards tracking 5+ concurrent workstreams',
      'Contributed to the IT R&A Process Transformation Programme serving 58,000+ employees across 40+ countries',
    ],
    strategy: [
      'Contributed to an IT R&A transformation serving 58,000+ employees across 40+ countries',
      'Built dashboards that made 5+ workstreams visible to senior leadership',
      'Delivered 7 consecutive monthly sprints at 100% on-time',
    ],
    legal: [
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Supported roles-and-authorisation transformation for 58,000+ employees across 40+ countries',
      'Tracked 5+ workstreams in JIRA/Confluence for programme governance',
    ],
    trainee: [
      'Delivered SAP Security process solutions across 7 consecutive monthly sprints at 100% on-time',
      'Built JIRA/Confluence dashboards tracking 5+ concurrent workstreams',
      'Contributed to the IT R&A Process Transformation Programme serving 58,000+ employees across 40+ countries',
    ],
  };
  const gpm = {
    analyst: [
      'Generated EUR 0.5M additional revenue through market analyses, portfolio optimisation, and market positioning',
      'Cut processing time by 40% through Lean lifecycle management protocol redesign across global product lines',
      'Worked with Supply Chain, Customer Logistics, and Regional Marketing and reduced compliance monitoring violations by 98.5%',
    ],
    supplychain: [
      'Worked with Supply Chain, Customer Logistics, and Regional Marketing and reduced compliance monitoring violations by 98.5%',
      'Cut processing time by 40% through Lean lifecycle management protocol redesign across global product lines',
      'Generated EUR 0.5M additional revenue through market analyses and portfolio optimisation',
    ],
    finance: [
      'Generated EUR 0.5M additional revenue through market analyses, portfolio optimisation, and market positioning',
      'Cut processing time by 40% through Lean lifecycle redesign',
      'Reduced compliance monitoring violations by 98.5% through cross-functional work with Supply Chain and Customer Logistics',
    ],
    people: [
      'Facilitated Supply Chain, Customer Logistics, and Regional Marketing collaboration and reduced compliance monitoring violations by 98.5%',
      'Cut processing time by 40% through Lean protocol redesign',
      'Supported portfolio positioning that generated EUR 0.5M additional revenue',
    ],
    marketing: [
      'Generated EUR 0.5M additional revenue through market analyses, portfolio optimisation, and market positioning',
      'Worked with Regional Marketing, Supply Chain, and Customer Logistics on compliance and lifecycle work',
      'Cut processing time by 40% through Lean protocol redesign',
    ],
    sales: [
      'Generated EUR 0.5M additional revenue through market analyses, portfolio optimisation, and market positioning',
      'Worked with Regional Marketing, Supply Chain, and Customer Logistics across global product lines',
      'Cut processing time by 40% through Lean redesign',
    ],
    ops: [
      'Cut processing time by 40% through Lean lifecycle management protocol redesign across global product lines',
      'Reduced compliance monitoring violations by 98.5% with Supply Chain, Customer Logistics, and Regional Marketing',
      'Generated EUR 0.5M additional revenue through market analyses and portfolio optimisation',
    ],
    strategy: [
      'Generated EUR 0.5M additional revenue through market analyses, portfolio optimisation, and market positioning',
      'Redesigned Lean lifecycle protocols and cut processing time by 40%',
      'Reduced compliance monitoring violations by 98.5% across global product lines',
    ],
    legal: [
      'Reduced compliance monitoring violations by 98.5% through work with Supply Chain, Customer Logistics, and Regional Marketing',
      'Cut processing time by 40% through Lean lifecycle protocol redesign',
      'Supported portfolio and market analyses that generated EUR 0.5M additional revenue',
    ],
    trainee: [
      'Worked with Supply Chain, Customer Logistics, and Regional Marketing and reduced compliance monitoring violations by 98.5%',
      'Cut processing time by 40% through Lean lifecycle management protocol redesign',
      'Generated EUR 0.5M additional revenue through market analyses and portfolio optimisation',
    ],
  };
  const hbl = {
    analyst: [
      'Improved KYC onboarding efficiency by 50% through structured digital process redesign',
      'Automated 75 FTEs of manual workload via RPA bot deployment',
      'Reduced operational costs by 70% by implementing automated compliance and transaction monitoring',
    ],
    supplychain: [
      'Automated 75 FTEs of manual workload via RPA and removed process bottlenecks',
      'Reduced operational costs by 70% with end-to-end automated compliance and transaction monitoring',
      'Improved KYC onboarding efficiency by 50% through digital process redesign',
    ],
    finance: [
      'Reduced operational costs by 70% by implementing automated compliance and transaction monitoring',
      'Automated 75 FTEs of manual workload via RPA bot deployment',
      'Improved KYC onboarding efficiency by 50%',
    ],
    people: [
      'Implemented automated compliance and transaction monitoring that cut operational costs by 70%',
      'Removed 75 FTEs of manual work through RPA so teams could stop repeating the same checks',
      'Improved KYC onboarding efficiency by 50% through process redesign',
    ],
    marketing: [
      'Improved KYC onboarding efficiency by 50% through digital process redesign',
      'Reduced operational costs by 70% with automated compliance monitoring',
      'Automated 75 FTEs of manual workload via RPA',
    ],
    sales: [
      'Improved KYC onboarding efficiency by 50%, shortening the path from application to active customer',
      'Reduced operational costs by 70% with automated compliance and transaction monitoring',
      'Automated 75 FTEs of manual workload via RPA',
    ],
    ops: [
      'Reduced operational costs by 70% by implementing automated compliance and transaction monitoring',
      'Automated 75 FTEs of manual workload via RPA bot deployment',
      'Improved KYC onboarding efficiency by 50% through digital process redesign',
    ],
    strategy: [
      'Implemented end-to-end automated compliance and transaction monitoring and reduced operational costs by 70%',
      'Automated 75 FTEs of manual workload via RPA',
      'Improved KYC onboarding efficiency by 50%',
    ],
    legal: [
      'Improved KYC onboarding efficiency by 50% through a structured regulatory compliance framework',
      'Implemented automated compliance and transaction monitoring and reduced operational costs by 70%',
      'Automated 75 FTEs of manual workload via RPA',
    ],
    trainee: [
      'Reduced operational costs by 70% by implementing automated compliance and transaction monitoring',
      'Automated 75 FTEs of manual workload via RPA bot deployment',
      'Improved KYC onboarding efficiency by 50%',
    ],
  };
  const ke = {
    analyst: [
      'Implemented SAP ISU and QlikSense solutions, digitalised 50+ FTE processes, and improved operational efficiency by 50%',
      'Developed a 5-year digital transformation roadmap for C-suite covering 5 business units',
      'Delivered digital systems training across 5 business units',
    ],
    supplychain: [
      'Digitalised 50+ FTE processes with SAP ISU and QlikSense and improved operational efficiency by 50%',
      'Developed a 5-year digital transformation roadmap covering 5 business units',
      'Trained cross-functional teams across 5 business units on the new operating standards',
    ],
    finance: [
      'Implemented SAP ISU and QlikSense, digitalised 50+ FTE processes, and improved operational efficiency by 50%',
      'Wrote a 5-year digital transformation roadmap for C-suite across 5 business units',
      'Delivered systems training across 5 business units',
    ],
    people: [
      'Delivered digital systems training to cross-functional teams across 5 business units',
      'Implemented SAP ISU and QlikSense and digitalised 50+ FTE processes',
      'Developed a 5-year digital transformation roadmap for C-suite covering 5 business units',
    ],
    marketing: [
      'Developed a 5-year digital transformation roadmap covering 5 business units',
      'Implemented QlikSense and SAP ISU and improved operational efficiency by 50%',
      'Trained teams across 5 business units on the new systems',
    ],
    sales: [
      'Developed a 5-year digital transformation roadmap covering 5 business units',
      'Digitalised 50+ FTE processes with SAP ISU and QlikSense',
      'Trained cross-functional teams across 5 business units',
    ],
    ops: [
      'Developed a 5-year digital transformation roadmap for C-suite covering 5 business units',
      'Implemented SAP ISU and QlikSense, digitalised 50+ FTE processes, and improved operational efficiency by 50%',
      'Delivered digital systems training across 5 business units',
    ],
    strategy: [
      'Developed a 5-year digital transformation roadmap for C-suite covering 5 business units at Pakistan\'s largest private energy utility',
      'Implemented SAP ISU and QlikSense and digitalised 50+ FTE processes',
      'Drove adoption through training across 5 business units',
    ],
    legal: [
      'Developed a 5-year digital transformation roadmap covering 5 business units',
      'Implemented SAP ISU and QlikSense and digitalised 50+ FTE processes',
      'Trained teams across 5 business units on the new operating standards',
    ],
    trainee: [
      'Developed a 5-year digital transformation roadmap for C-suite covering 5 business units',
      'Implemented SAP ISU and QlikSense, digitalised 50+ FTE processes, and improved operational efficiency by 50%',
      'Delivered digital systems training across 5 business units',
    ],
  };
  const alf = {
    analyst: [
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data for 100% automated management reporting',
      'Increased digital product registrations by 40% through targeted B2B/B2C campaigns, segmentation, and competitor analysis',
      'Delivered product training to 70+ staff and coordinated agencies for multi-channel campaigns',
    ],
    supplychain: [
      'Built a Power BI dashboard on daily transactions, KPIs, and pricing for management decisions',
      'Increased digital product registrations by 40% through segmented campaigns',
      'Delivered product training to 70+ staff',
    ],
    finance: [
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data, delivering 100% automated real-time financial intelligence',
      'Increased digital product registrations by 40% through targeted campaigns',
      'Delivered product training to 70+ staff',
    ],
    people: [
      'Delivered product training to 70+ staff',
      'Built a Power BI dashboard on daily transactions, KPIs, and pricing',
      'Increased digital product registrations by 40% through segmented B2B/B2C campaigns',
    ],
    marketing: [
      'Increased digital product registrations by 40% by designing and executing targeted B2B/B2C campaigns with consumer segmentation and competitor analysis',
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data',
      'Delivered product training to 70+ staff and managed agency coordination for multi-channel campaigns',
    ],
    sales: [
      'Increased digital product registrations by 40% through targeted B2B/B2C campaigns and competitor analysis',
      'Built a Power BI dashboard on daily transactions, KPIs, and pricing',
      'Delivered product training to 70+ staff and coordinated agencies',
    ],
    ops: [
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data',
      'Increased digital product registrations by 40% through targeted campaigns',
      'Delivered product training to 70+ staff',
    ],
    strategy: [
      'Increased digital product registrations by 40% through segmentation, competitor analysis, and targeted campaigns',
      'Built a Power BI dashboard that automated management reporting on transactions, KPIs, and pricing',
      'Delivered product training to 70+ staff',
    ],
    legal: [
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data',
      'Increased digital product registrations by 40% through structured campaign work',
      'Delivered product training to 70+ staff',
    ],
    trainee: [
      'Increased digital product registrations by 40% through targeted B2B/B2C campaigns',
      'Built a Power BI dashboard consolidating daily transactions, KPIs, and pricing data',
      'Delivered product training to 70+ staff',
    ],
  };
  const g = group in gdo ? group : 'ops';
  return { gdo: gdo[g], sap: sap[g], gpm: gpm[g], hbl: hbl[g], ke: ke[g], alf: alf[g] };
}

function experienceFor(group) {
  const b = bulletsFor(group);
  return [
    {
      company: 'Infineon Technologies',
      role: 'Working Student',
      location: 'Munich, Germany',
      dates: '09.2023 – 08.2026',
      roles: [
        { role: 'Working Student - Global Distribution Operations Management', dates: '12.2025 – 08.2026', bullets: b.gdo },
        { role: 'Working Student - IT SAP Roles & Authorisation', dates: '04.2025 – 11.2025', bullets: b.sap },
        { role: 'Working Student - Global Product Management', dates: '09.2023 – 03.2025', bullets: b.gpm },
      ],
    },
    {
      company: 'Habib Bank Limited',
      role: 'Manager - System Implementation Analyst',
      location: 'Karachi, Pakistan',
      dates: '01.2022 – 03.2023',
      bullets: b.hbl,
    },
    {
      company: 'K-Electric',
      role: 'Assistant Manager - Enterprise IT Strategy & Business Support',
      location: 'Karachi, Pakistan',
      dates: '01.2020 – 12.2021',
      bullets: b.ke,
    },
    {
      company: 'Bank Alfalah',
      role: 'Assistant Manager - Contextual Marketing',
      location: 'Karachi, Pakistan',
      dates: '01.2019 – 12.2019',
      bullets: b.alf,
    },
  ];
}

function skillsFor(group) {
  const all = {
    'Strategy & Analytics': ['Strategic Planning', 'Market Analysis', 'Portfolio Management', 'Competitive Intelligence', 'Financial Analysis', 'KPI Reporting'],
    'Operations & Process': ['Operations Management', 'Lean Management', 'Change Management', 'Gap Analysis', 'Business Process Optimisation'],
    'Project Management': ['Programme Management', 'Agile/Scrum', 'Stakeholder Management', 'JIRA', 'Confluence'],
    'Data & Systems': ['Power BI', 'Advanced Excel', 'SQL', 'QlikSense', 'SAP', 'RPA'],
    'Marketing & Digital': ['Marketing Analytics', 'Consumer Insights', 'Campaign Management', 'B2B Marketing', 'Digital Transformation'],
    Languages: ['English C2', 'German B1', 'Urdu native'],
  };
  const order = {
    analyst: ['Data & Systems', 'Strategy & Analytics', 'Operations & Process', 'Project Management', 'Marketing & Digital', 'Languages'],
    supplychain: ['Operations & Process', 'Project Management', 'Strategy & Analytics', 'Data & Systems', 'Marketing & Digital', 'Languages'],
    finance: ['Strategy & Analytics', 'Data & Systems', 'Operations & Process', 'Project Management', 'Marketing & Digital', 'Languages'],
    people: ['Project Management', 'Operations & Process', 'Data & Systems', 'Strategy & Analytics', 'Marketing & Digital', 'Languages'],
    marketing: ['Marketing & Digital', 'Strategy & Analytics', 'Data & Systems', 'Project Management', 'Operations & Process', 'Languages'],
    sales: ['Marketing & Digital', 'Strategy & Analytics', 'Project Management', 'Operations & Process', 'Data & Systems', 'Languages'],
    ops: ['Operations & Process', 'Project Management', 'Data & Systems', 'Strategy & Analytics', 'Marketing & Digital', 'Languages'],
    strategy: ['Strategy & Analytics', 'Project Management', 'Operations & Process', 'Data & Systems', 'Marketing & Digital', 'Languages'],
    legal: ['Operations & Process', 'Project Management', 'Strategy & Analytics', 'Data & Systems', 'Marketing & Digital', 'Languages'],
    trainee: ['Operations & Process', 'Strategy & Analytics', 'Project Management', 'Data & Systems', 'Marketing & Digital', 'Languages'],
  };
  return (order[group] || order.ops).map((category) => ({ category, items: all[category] }));
}

function coverFor(job, group, jd, kws) {
  const co = companyName(job);
  const intern = job.track === 'intern';
  const focus = kws.slice(0, 3).join(', ');
  const duty = dutySnippet(jd);
  const city = (job.city || 'Germany').replace(/posted:.*/i, '').split(/[;·]/)[0].trim();

  const openings = {
    analyst: `I am applying for the ${job.role} at ${co} in ${city}. The posting asks for ${focus}. That is the work I did when I turned Infineon programme data into gap analyses and when I built the Power BI dashboard at Bank Alfalah that automated daily KPI and pricing reporting.`,
    supplychain: `I am applying for the ${job.role} at ${co} in ${city}. The role sits in supply chain / operations. At Infineon I worked with Supply Chain and Customer Logistics on global product lines, cut processing time by 40% through Lean redesign, and ran a distribution programme across 5 regions.`,
    finance: `I am applying for the ${job.role} at ${co} in ${city}. You asked for ${focus}. I have done cost, revenue, and reporting work: 70% cost reduction at Habib Bank, EUR 0.5M additional revenue from Infineon portfolio analysis, and a Power BI dashboard that automated financial intelligence for management.`,
    people: `I am applying for the ${job.role} at ${co} in ${city}. The posting is about people, enablement, and how work gets coordinated. I supported Infineon SAP roles and authorisation for 58,000+ employees and delivered training to 70+ staff and 5 business units.`,
    marketing: `I am applying for the ${job.role} at ${co} in ${city}. You asked for ${focus}. At Bank Alfalah I designed B2B/B2C campaigns that increased digital product registrations by 40%. At Infineon I wrote voice-of-customer reports for 5 regional distributor networks.`,
    sales: `I am applying for the ${job.role} at ${co} in ${city}. The posting asks for ${focus}. My Infineon work sat with Sales and Regional Marketing, and market and portfolio analysis generated EUR 0.5M additional revenue.`,
    ops: `I am applying for the ${job.role} at ${co} in ${city}. You asked for ${focus}. I ran Infineon\'s Distribution Certification Programme across 5 regions (118 focus applications, 100% on-time sprints) and earlier automated 75 FTEs of manual work at Habib Bank.`,
    strategy: `I am applying for the ${job.role} at ${co} in ${city}. The role needs someone who can turn a messy operating picture into a plan. I wrote a 5-year digital transformation roadmap across 5 business units and then delivered pieces of it through Infineon product, SAP, and distribution rotations.`,
    legal: `I am applying for the ${job.role} at ${co} in ${city}. The posting asks for ${focus}. I improved KYC onboarding efficiency by 50% at Habib Bank and reduced Infineon compliance monitoring violations by 98.5%.`,
    trainee: `I am applying for the ${job.role} at ${co} in ${city}. I have already rotated through product management, SAP roles and authorisation, and distribution operations at Infineon in Munich, and I can start immediately.`,
  };

  const intro = intern
    ? `I am an M.Sc. Digital Technology Management student at Hochschule München. Modules are completed; the thesis is in progress. Selected grades: ${pickModules(group)}. BBA from IBA Karachi with a technology and operations focus. English C2; German B1. I am looking for a working-student or internship role alongside the degree.`
    : `I hold a BBA from IBA Karachi (technology and operations) and I am completing an M.Sc. Digital Technology Management at Hochschule München. Modules are completed; the thesis is in progress. Selected grades: ${pickModules(group)}. English C2; German B1. I can start this full-time role immediately.`;

  const proofs = {
    analyst: [
      { lead: 'Reporting leadership actually used', impact: 'Power BI dashboard at Bank Alfalah consolidated daily transactions, KPIs, and pricing. JIRA/Confluence dashboards at Infineon tracked 5+ workstreams for senior leadership.' },
      { lead: 'Analysis tied to a commercial result', impact: 'Market and portfolio analysis at Infineon generated EUR 0.5M additional revenue. Munich RE academic project: segmentation across 5 global initiatives for a 2.2M-unit target market.' },
    ],
    supplychain: [
      { lead: 'Supply chain and logistics work', impact: 'Infineon Global Product Management sat with Supply Chain and Customer Logistics and cut compliance monitoring violations by 98.5%. Lean redesign cut processing time by 40%.' },
      { lead: 'Programme delivery across regions', impact: 'Distribution Certification Programme: 5 regions, 118 focus applications, 100% on-time sprint milestones.' },
    ],
    finance: [
      { lead: 'Cost and revenue proof', impact: 'Habib Bank: 70% operational cost reduction and 75 FTEs automated. Infineon: EUR 0.5M additional revenue from market and portfolio analysis.' },
      { lead: 'Financial reporting', impact: 'Bank Alfalah Power BI dashboard delivered 100% automated real-time financial intelligence on transactions, KPIs, and pricing. Hochschule München grade 1.0 in Financial Strategies for Digital Technology Management.' },
    ],
    people: [
      { lead: 'Roles, access, and enablement', impact: 'Infineon SAP Roles and Authorisation transformation served 58,000+ employees in 40+ countries. Seven monthly sprints at 100% on-time.' },
      { lead: 'Training that stuck', impact: 'Product training for 70+ staff at Bank Alfalah. Digital systems training across 5 K-Electric business units. Cross-cultural Communication and Management 1.7.' },
    ],
    marketing: [
      { lead: 'Campaigns with a measured lift', impact: 'Bank Alfalah: 40% increase in digital product registrations through segmentation, competitor analysis, and multi-channel campaigns.' },
      { lead: 'Customer and commercial insight', impact: 'Infineon voice-of-customer reports for 5 regional distributor networks. Digital Commerce and Technology Marketing 2.3.' },
    ],
    sales: [
      { lead: 'Commercial work with Sales', impact: 'Infineon sprints were coordinated with Sales and Regional Marketing. Portfolio and market work generated EUR 0.5M additional revenue.' },
      { lead: 'B2B campaigns and enablement', impact: 'Bank Alfalah B2B/B2C campaigns increased digital product registrations by 40%. Product training for 70+ staff.' },
    ],
    ops: [
      { lead: 'Programme and sprint delivery', impact: 'Infineon Distribution Certification Programme across 5 regions, 118 focus applications, 100% on-time milestones.' },
      { lead: 'Process that removed manual work', impact: 'Habib Bank: 70% cost reduction and 75 FTEs automated via RPA. Infineon: 40% faster processing through Lean redesign.' },
    ],
    strategy: [
      { lead: 'A plan leadership could run', impact: 'K-Electric: 5-year digital transformation roadmap for C-suite across 5 business units. BMW academic case: transformation roadmap for 15+ operational challenges, 85% adoption.' },
      { lead: 'Then the operating work', impact: 'Three Infineon rotations in product, SAP, and distribution. 100% on-time sprints. EUR 0.5M additional revenue from portfolio work.' },
    ],
    legal: [
      { lead: 'KYC and compliance delivery', impact: 'Habib Bank: 50% faster KYC onboarding and automated compliance monitoring with a 70% cost reduction.' },
      { lead: 'Governance in a product setting', impact: 'Infineon: 98.5% fewer compliance monitoring violations. Legal Issues for Data-driven Business 2.3; Intellectual Property Rights 2.0.' },
    ],
    trainee: [
      { lead: 'Already rotated', impact: 'Infineon working-student rotations in Global Product Management, SAP Roles and Authorisation, and Global Distribution Operations (09.2023 to 08.2026).' },
      { lead: 'Delivery before the degree', impact: 'Habib Bank 70% cost reduction. K-Electric 5-year roadmap. Bank Alfalah 40% registration lift. I can start a German Trainee programme without treating the first rotation as my first workplace.' },
    ],
  };

  const start = duty
    ? `At ${co} I would start with the work named in the posting: ${duty} I would put a simple KPI view in front of the team so the first decisions sit on the same numbers.`
    : `At ${co} I would start with the reporting, handoffs, and bottlenecks in the ${job.role} description, then put a simple KPI view in front of the team.`;

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
      company: co,
      city,
      date: DATE,
      greeting: 'Dear Hiring Team,',
      opening: openings[group] || openings.ops,
      profile_intro: intro,
      achievements: proofs[group] || proofs.ops,
      problems_section: start,
      closing: intern
        ? `I live in Munich, can work on-site or hybrid in Germany, and can start this ${job.role} immediately. I would welcome a conversation.`
        : `I live in Munich, can relocate within Germany, and can start immediately. I would welcome a conversation about the ${job.role}.`,
      language_closing: 'Ich spreche Deutsch auf B1-Niveau und arbeite im Berufsalltag sicher auf Englisch.',
      signature: { valediction: 'Kind regards', name: 'Syed Haider Ali' },
    },
  };
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
  const cached = `jds/${job.slug}.md`;
  if (existsSync(cached)) {
    const text = readFileSync(cached, 'utf8');
    const body = text.split('\n').slice(6).join(' ').trim();
    if (body.length > 200) return strip(body);
  }
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

function loadJobs() {
  const intern = JSON.parse(readFileSync('batch/pack-intern-40.json', 'utf8')).map((j) => ({ ...j, track: 'intern' }));
  const ft = JSON.parse(readFileSync('batch/pack-ft-40.json', 'utf8')).map((j) => ({ ...j, track: 'ft' }));
  return [...intern, ...ft].filter((j) => !DROP.has(j.slug));
}

function buildPayload(job, group, kws) {
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
    summary: summaryFor(job, group, kws),
    competencies: kws,
    experience: experienceFor(group),
    projects: [
      { name: 'Munich RE — Product Development Analyst (academic project)', description: 'Consumer segmentation and competitive benchmarking across 5 global initiatives for a 2.2M-unit target market (04.2024 – 07.2024).' },
      { name: 'BMW Group — Agile Scrum Analyst (academic case study)', description: 'Transformation roadmap for 15+ operational challenges, KPI frameworks, 85% adoption (10.2023 – 02.2024).' },
    ],
    education: [
      {
        title: 'M.Sc. Digital Technology Management',
        org: 'Hochschule München University of Applied Sciences',
        location: 'Munich, Germany',
        year: '09.2023 – Present',
        description: `Modules completed; thesis in progress. Selected grades: ${pickModules(group)}.`,
      },
      {
        title: 'Bachelor of Business Administration (BBA)',
        org: 'Institute of Business Administration (IBA)',
        location: 'Karachi, Pakistan',
        year: '04.2014 – 09.2018',
        description: 'Technology and operations focus. Top-ranked South Asian business school.',
      },
    ],
    certifications: [
      { title: 'Career Essentials in Generative AI', org: 'Microsoft' },
      { title: 'Introduction to Statistics', org: 'DataCamp' },
      { title: 'Intermediate SQL', org: 'DataCamp' },
      { title: 'Data Visualizations', org: 'DataCamp' },
    ],
    skills: skillsFor(group),
  };
}

export {
  classify, keywordsFrom, summaryFor, coverFor, buildPayload, fetchJd,
  companyName, experienceFor, skillsFor, pickModules, strip, DATE, CV_TPL,
};

async function main() {
  const jobs = loadJobs();
  mkdirSync('output/_pack-redesign', { recursive: true });
  mkdirSync('jds', { recursive: true });
  const workdir = resolve('output/_pack-redesign');
  const manifest = [];
  const groups = {};

  for (const job of jobs) {
    const group = classify(job);
    groups[group] = (groups[group] || 0) + 1;
    process.stderr.write(`${job.slug} [${group}]\n`);
    let jd = await fetchJd(job);
    if (jd.startsWith('ERROR')) jd = `${job.role} ${job.company} ${(job.kws || []).join(' ')}`;
    if (jd.length > 80) writeFileSync(`jds/${job.slug}.md`, `# ${job.role}\n\nCompany: ${companyName(job)}\nLocation: ${job.city}\nURL: ${job.url}\n\n${jd.slice(0, 12000)}\n`);
    const kws = keywordsFrom(`${jd} ${job.role} ${(job.kws || []).join(' ')}`, job.kws || []);
    const payload = buildPayload(job, group, kws);
    const cvJson = resolve(workdir, `cv-${job.slug}.json`);
    const cvHtml = resolve(workdir, `cv-${job.slug}.html`);
    const cvPdf = resolve('output', `cv-syed-haider-ali-${job.slug}-${DATE}.pdf`);
    writeFileSync(cvJson, JSON.stringify(payload));
    execFileSync(process.execPath, ['build-cv-html.mjs', cvJson, cvHtml, CV_TPL], { stdio: 'inherit' });
    try {
      execFileSync(process.execPath, ['verify-ats.mjs', cvHtml, '--role', job.role, '--keywords', kws.join(','), '--min-score', '70'], { stdio: 'inherit' });
    } catch {
      process.stderr.write(`ATS warn ${job.slug}\n`);
    }
    manifest.push({ input: cvHtml, output: cvPdf, format: 'a4' });
    const coverHtml = resolve(workdir, `cover-${job.slug}.html`);
    const coverPdf = resolve('output', `cover-syed-haider-ali-${job.slug}-${DATE}.pdf`);
    writeFileSync(coverHtml, buildCoverHtml(coverFor(job, group, jd, kws)));
    manifest.push({ input: coverHtml, output: coverPdf, format: 'a4' });
  }

  const manPath = resolve(workdir, 'manifest.json');
  writeFileSync(manPath, JSON.stringify(manifest, null, 2));
  if (manifest.length) {
    execFileSync(process.execPath, ['generate-pdf.mjs', `--batch=${manPath}`, '--format=a4', '--allow-reorder'], { stdio: 'inherit' });
  }
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* ignore */ }
  console.log(JSON.stringify({ rebuilt: jobs.length, pdfs: manifest.length, groups }, null, 2));
}

const { isMainModule } = await import('../lib/is-main-module.mjs');
if (isMainModule(import.meta.url)) await main();
