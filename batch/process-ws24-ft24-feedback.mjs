#!/usr/bin/env node
/**
 * Apply user chart feedback: delete flagged PDFs, tracker Applied/Discarded, update packs.
 */
import { unlinkSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { localToday } from '../lib/local-today.mjs';
import { isMainModule } from '../lib/is-main-module.mjs';

const DATE = '2026-09-22';

export const REMOVE = [
  { slug: 'ws24-urbansportsclub-product-design-intern-de', company: 'Urban Sports Club', role: 'Product Design Intern, Design System', url: 'https://job-boards.greenhouse.io/urbansportsclub/jobs/8816095002', status: 'Discarded', note: 'Design/UI degree focus — not business fit' },
  { slug: 'ws24-doctolib-medical-data-intern-x-f-m', company: 'Doctolib', role: 'Medical Data Intern (x/f/m)', url: 'https://job-boards.greenhouse.io/doctolib/jobs/7996918003', status: 'Discarded', note: 'Doctolib German-first; medical title deprioritized' },
  { slug: 'ft24-b-o-s-engergieberatung-junior-performanc', company: 'B:O:S', role: '(Junior) Performance Marketing Manager', url: 'https://www.arbeitnow.com/jobs/companies/bos-engergieberatung/junior-performance-marketing-manger-augsburg-491964', status: 'Discarded', note: 'JD in German' },
  { slug: 'ft24-puma-retail-sales-associate', company: 'PUMA', role: 'Retail Sales Associate', url: 'https://puma.wd502.myworkdayjobs.com/jobs_at_puma/job/Outlet-Berlin-Wustermark/Retail-Sales-Associate_R43427', status: 'Discarded', note: 'JD in German — Berlin Wustermark' },
  { slug: 'ft24-puma-nuremberg', company: 'PUMA', role: 'Retail Sales Associate', url: 'https://puma.wd502.myworkdayjobs.com/jobs_at_puma/job/Outlet-Nuremberg-Klingenhofstrasse/Retail-Sales-Associate_R43428', status: 'Discarded', note: 'JD in German — Nuremberg' },
  { slug: 'ft24-paypal-business-development-representati', company: 'PayPal', role: 'Business Development Representative - Large Enterprise', url: 'https://paypal.wd1.myworkdayjobs.com/jobs/job/Berlin-Berlin-Germany/Business-Development-Representative---Large-Enterprise_R0137428', status: 'Discarded', note: 'Apply link dead' },
  { slug: 'ft24-ger-erac-management-trainee-in-ingolstad', company: 'Enterprise Mobility', role: 'Management Trainee (m/w/d)', url: 'https://ger-erac.icims.com/jobs/567308/management-trainee-in-ingolstadt-%28m_w_d%29/job', status: 'Discarded', note: 'German JD + fluent German required — Ingolstadt' },
  { slug: 'ft24-ger-erac-management-trainee-in-kassel-m-', company: 'Enterprise Mobility', role: 'Management Trainee (m/w/d)', url: 'https://ger-erac.icims.com/jobs/567305/management-trainee-in-kassel-%28m_w_d%29/job', status: 'Discarded', note: 'German JD + fluent German required — Kassel' },
  { slug: 'ft24-zalando-junior-risk-manager-all-genders-', company: 'Zalando', role: 'Junior Risk Manager (all genders) - 6 months', url: 'https://zalando.wd3.myworkdayjobs.com/ZalandoSiteWD/job/Berlin/Junior-Risk-Manager--all-genders---6-months-contract_2725532', status: 'Discarded', note: 'FT limited contract under 12 months' },
];

export const APPLIED = [
  { slug: 'ws24-navvis-working-student-legal-operations-', company: 'NavVis', role: 'Working Student – Legal Operations (F/M/D)', url: 'https://job-boards.eu.greenhouse.io/navvis/jobs/4972247101' },
  { slug: 'ws24-telli-yc-f24-internship-strategy-bizops', company: 'Telli (Yc F24)', role: 'Internship - Strategy & BizOps', url: 'https://jobs.ashbyhq.com/telli/a80c4a4a-2183-4150-a001-9459cb657958' },
  { slug: 'ws24-telli-yc-f24-internship-founders-office', company: 'Telli (Yc F24)', role: "Internship - Founders' Office", url: 'https://jobs.ashbyhq.com/telli/ba847073-b9b7-4d9a-b9b8-50a45444003a' },
  { slug: 'ws24-onefootball-sales-intern-m-f-d', company: 'OneFootball', role: 'Sales Intern (m/f/d)', url: 'https://onefootball.applytojob.com/apply/qyIE27coWR/Sales-Intern-mfd' },
  { slug: 'ws24-idealo-internet-gmbh-b2b-marketing-worki', company: 'idealo internet GmbH', role: 'B2B Marketing Working Student (m|w|d)', url: 'https://www.arbeitnow.com/jobs/companies/idealo-internet-gmbh/b2b-marketing-working-student-mwd-berlin-191269' },
  { slug: 'ws24-lovehoney-group-working-student-talent-a', company: 'Lovehoney Group', role: 'Working Student Talent Acquisition', url: 'https://www.arbeitnow.com/jobs/companies/lovehoney-group/working-student-talent-acquisition-berlin-83680' },
  { slug: 'ws24-auto1-intern-financial-planning-analytics', company: 'AUTO1', role: 'Intern Financial Planning & Analytics (f/m/x)', url: 'https://jobs.smartrecruiters.com/Auto1/744000151054139-intern-financial-planning-analytics-f-m-x' },
  { slug: 'ft24-sphaira-founder-s-associate', company: 'Sphaira', role: "Founder's Associate", url: 'https://www.arbeitnow.com/jobs/companies/sphaira/founders-associate-berlin-351479' },
  { slug: 'ft24-justplay-gmbh-founders-associate-engagem', company: 'JustPlay GmbH', role: 'Founders Associate - Engagement Innovation (all genders)', url: 'https://www.arbeitnow.com/jobs/companies/justplay-gmbh/founders-associate-engagement-innovation-all-genders-berlin-421793' },
  { slug: 'ft24-fastretailing-uniqlo-management-candidat', company: 'UNIQLO', role: 'UNIQLO Management Candidate Graduate Programme - Germany 2027', url: 'https://fastretailing.wd3.myworkdayjobs.com/graduates_eu_uniqlo/job/Berlin-Germany/UNIQLO-Management-Candidate-Graduate-Programme---Germany-2027_R00000004177549' },
  { slug: 'ft24-mantro-gmbh-venture-lead-marketing-ecomm', company: 'mantro', role: 'Venture Lead - Marketing / eCommerce (m/w/d)', url: 'https://www.arbeitnow.com/jobs/companies/mantro-gmbh/venture-lead-marketing-ecommerce-munich-288685' },
  { slug: 'ft24-mksinst-pricing-marketing-specialist-w-m', company: 'MKS', role: 'Pricing & Marketing Specialist (w/m/d)', url: 'https://mksinst.wd1.myworkdayjobs.com/mkscareersemea/job/Germany-Feucht/Pricing---Marketing-Specialist--w-m-d-_R21602' },
  { slug: 'ft24-vexcash-ag-systems-analyst-all-genders', company: 'Vexcash', role: 'Systems Analyst (all genders)', url: 'https://www.arbeitnow.com/jobs/companies/vexcash-ag/systems-analyst-all-genders-berlin-403623' },
  { slug: 'ft24-wk-product-marketing-manager-m-f-d', company: 'Wolters Kluwer', role: 'Product Marketing Manager (m/f/d)', url: 'https://wk.wd3.myworkdayjobs.com/external/job/DEU---Berlin/Product-Marketing-Manager_R0058885-1' },
];

function pdfPaths(slug) {
  return [
    `output/cv-syed-haider-ali-${slug}-${DATE}.pdf`,
    `output/cover-syed-haider-ali-${slug}-${DATE}.pdf`,
  ];
}

function main() {
  const TODAY = localToday();
  const deleted = [];
  for (const r of REMOVE) {
    for (const p of pdfPaths(r.slug)) {
      if (existsSync(p)) {
        unlinkSync(p);
        deleted.push(p);
      }
    }
  }

  mkdirSync('batch/tracker-additions', { recursive: true });
  let num = 48;
  const tsvFiles = [];
  for (const row of [...APPLIED.map((r) => ({ ...r, status: 'Applied', note: `Applied ${TODAY}. ws24/ft24 pack.` })), ...REMOVE]) {
    const slug = row.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
    const file = `batch/tracker-additions/${String(num).padStart(3, '0')}-${slug}.tsv`;
    const pdf = row.status === 'Applied' ? '✅' : '❌';
    writeFileSync(file, [
      'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl',
      `${num}\t${TODAY}\t${row.company}\t${row.role}\t${row.status}\tN/A\t${pdf}\t—\t${row.note || `Applied ${TODAY}`}\t${row.url}`,
      '',
    ].join('\n'));
    tsvFiles.push(file);
    num += 1;
  }

  execFileSync(process.execPath, ['merge-tracker.mjs'], { stdio: 'inherit' });

  const removeUrls = new Set(REMOVE.map((r) => r.url));
  const intern = JSON.parse(readFileSync('batch/pack-intern-24h.json', 'utf8')).filter((j) => !removeUrls.has(j.url));
  const ft = JSON.parse(readFileSync('batch/pack-ft-24h.json', 'utf8')).filter((j) => !removeUrls.has(j.url));
  writeFileSync('batch/pack-intern-24h.json', `${JSON.stringify(intern, null, 2)}\n`);
  writeFileSync('batch/pack-ft-24h.json', `${JSON.stringify(ft, null, 2)}\n`);

  console.log(JSON.stringify({
    deletedPdfs: deleted.length,
    applied: APPLIED.length,
    discarded: REMOVE.length,
    trackerRows: tsvFiles.length,
    deletedFiles: deleted,
  }, null, 2));
}

if (isMainModule(import.meta.url)) main();
