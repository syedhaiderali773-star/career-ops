#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const TMP = join(ROOT, 'data', '.xlsx-tmp');
const OUT = join(ROOT, 'data', 'excel-legitimacy.md');

const SHEETS = [
  ['International', 'sheet1.xml'],
  ['National Big', 'sheet2.xml'],
  ['Mid Size', 'sheet3.xml'],
  ['Small Size', 'sheet4.xml'],
];

const NEW50 = [
  ['Deltia', 'https://deltia.ai', 'Berlin, Series A Jun 2026, industrial AI'],
  ['STARK', 'https://stark-defence.com', 'Berlin, defence, funded 2026'],
  ['VARM', 'https://varm.earth', 'Berlin, energy/construction, Series A Jun 2026'],
  ['Kyrok', 'https://kyrok.com', 'Berlin, supply-chain AI, pre-seed Jun 2026'],
  ['LiveEO', 'https://live-eo.com', 'Berlin, satellite analytics'],
  ['SPREAD', 'https://spread.ai', 'Berlin, manufacturing AI, Series B May 2026'],
  ['Qdrant', 'https://qdrant.tech', 'Berlin, vector search, Series B Mar 2026'],
  ['finperks', 'https://finperks.com', 'Berlin, prepaid infrastructure, pre-seed 2026'],
  ['Andercore', 'https://andercore.com', 'Berlin, procurement AI, Series B Feb 2026'],
  ['Metiundo', 'https://metiundo.io', 'Berlin, energy analytics'],
  ['Kombo', 'https://kombo.dev', 'Berlin, HR integrations'],
  ['heyData', 'https://heydata.eu', 'Berlin, legal tech'],
  ['AMBOSS', 'https://www.amboss.com', 'Berlin, medical learning'],
  ['Pliant', 'https://www.getpliant.com', 'Berlin, corporate cards'],
  ['Aignostics', 'https://www.aignostics.com', 'Berlin, AI pathology'],
  ['Payrails', 'https://payrails.com', 'Berlin, payments OS'],
  ['Ostrom', 'https://www.ostrom.de', 'Berlin, green electricity'],
  ['Talon.One', 'https://www.talon.one', 'Berlin, promotions platform'],
  ['Sennder', 'https://www.sennder.com', 'Berlin, freight'],
  ['Proxima Fusion', 'https://www.proximafusion.com', 'Munich, fusion, hiring 2026'],
  ['Sitegeist', 'https://sitegeist-robotics.com', 'Munich, construction robotics, pre-seed Feb 2026'],
  ['Invertix', 'https://invertix.ai', 'Munich, energy AI, seed 2026'],
  ['microagi', 'https://www.microagi.com', 'Munich, factory robotics, seed Jul 2026'],
  ['Reflex Aerospace', 'https://www.reflexaerospace.com', 'Munich, space'],
  ['voize', 'https://voize.de', 'Berlin, healthcare voice AI'],
  ['NetBird', 'https://netbird.io', 'Berlin, security'],
  ['Diligent Robotics AI', 'https://godiligent.ai', 'Berlin, fintech AI'],
  ['Tower.dev', 'https://tower.dev', 'Berlin, data platform'],
  ['Bounti', 'https://bounti.co', 'Berlin, HR AI'],
  ['Recare', 'https://recaresolutions.com', 'Berlin, healthcare'],
  ['Logistica OS', 'https://logistica-os.com', 'Berlin, logistics AI'],
  ['Scavenger AI', 'https://scavenger-ai.com', 'Berlin, analytics'],
  ['revel8', 'https://revel8.ai', 'Berlin, cyber'],
  ['Forgent AI', 'https://forgent.ai', 'Berlin, govtech'],
  ['Tilla', 'https://tilla.tech', 'Berlin, transport'],
  ['trawa', 'https://www.trawa.de', 'Berlin, energy'],
  ['Mirelo', 'https://www.mirelo.ai', 'Berlin, AI audio'],
  ['Isar Aerospace', 'https://www.isaraerospace.com', 'Munich, launch'],
  ['Quantica', 'https://quantica.io', 'Berlin, 3D manufacturing'],
  ['Cellbricks', 'https://cellbricks.com', 'Berlin, biotech'],
  ['Patronus Group', 'https://patronus-group.com', 'Berlin, healthcare'],
  ['Circle Health', 'https://circle.health', 'Berlin, healthcare'],
  ['GeneralMind', 'https://generalmind.com', 'Berlin, AI'],
  ['enclaive', 'https://enclaive.io', 'Berlin, cyber'],
  ['Level Nine', 'https://levelninelabs.com', 'Berlin, materials'],
  ['Watergenics', 'https://watergenics.tech', 'Berlin, environment'],
  ['Optimeleon', 'https://optimeleon.com', 'Berlin, marketing AI'],
  ['Konvo AI', 'https://konvoai.com', 'Berlin, ecommerce AI'],
  ['FION Energy', 'https://fion-energy.com', 'Berlin, energy'],
  ['Pitlane Ops', 'https://pitlaneops.com', 'Berlin, robotics'],
];

function parseSst() {
  const xml = readFileSync(join(TMP, 'xl', 'sharedStrings.xml'), 'utf8');
  const strings = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) =>
      x[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
    );
    strings.push(texts.join(''));
  }
  return strings;
}

function parseRels(sheetFile) {
  const rels = join(TMP, 'xl', 'worksheets', '_rels', `${sheetFile}.rels`);
  const map = {};
  if (!existsSync(rels)) return map;
  const xml = readFileSync(rels, 'utf8');
  for (const m of xml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

function parseSheet(sheetFile, sst) {
  const xml = readFileSync(join(TMP, 'xl', 'worksheets', sheetFile), 'utf8');
  const rels = parseRels(sheetFile);
  const names = {};
  for (const m of xml.matchAll(/<c r="A(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v>/g)) {
    names[m[1]] = sst[Number(m[2])] || '';
  }
  const rows = [];
  for (const m of xml.matchAll(/<hyperlink ref="B(\d+)" r:id="([^"]+)"/g)) {
    const row = m[1];
    const name = names[row];
    if (!name || name === 'Company') continue;
    rows.push({ name, url: rels[m[2]] || '' });
  }
  return rows;
}

async function checkUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return { status: 'no-url', http: 0 };
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status >= 200 && r.status < 400) return { status: 'live', http: r.status, final: r.url };
    return { status: 'dead', http: r.status, final: r.url };
  } catch (e) {
    const msg = String(e.message || e);
    if (/ENOTFOUND|getaddrinfo|ERR_NAME/i.test(msg)) return { status: 'does-not-exist', http: 0 };
    return { status: 'dead', http: 0 };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

function verdict(row) {
  if (row.status === 'live') return 'legitimate, career page responds';
  if (row.status === 'does-not-exist') return 'career URL does not exist';
  if (row.status === 'no-url') return 'no career URL in Excel';
  return 'career URL dead or blocked';
}

async function main() {
  writeFileSync(OUT, '# Excel legitimacy check\n\nStatus: running\n');
  const sst = parseSst();
  const all = [];
  for (const [sheet, file] of SHEETS) {
    for (const row of parseSheet(file, sst)) all.push({ sheet, ...row });
  }
  const checked = await pool(all, 8, async (row, idx) => {
    if (idx && idx % 40 === 0) {
      writeFileSync(OUT, `# Excel legitimacy check\n\nStatus: running ${idx}/${all.length}\n`);
    }
    const c = await checkUrl(row.url);
    return { ...row, ...c };
  });

  const extra = await pool(NEW50, 5, async ([name, url, note]) => {
    const c = await checkUrl(url);
    return { name, url, note, ...c };
  });

  const by = { live: [], dead: [], missing: [], nous: [] };
  for (const r of checked) {
    if (r.status === 'live') by.live.push(r);
    else if (r.status === 'does-not-exist') by.missing.push(r);
    else if (r.status === 'no-url') by.nous.push(r);
    else by.dead.push(r);
  }

  const line = (r) => `| ${r.sheet} | ${r.name} | ${verdict(r)} | ${r.url || '—'} |`;
  const md = [
    '# Excel company + career page check',
    '',
    `Checked: ${checked.length} names across 4 sheets.`,
    '',
    `| Result | Count |`,
    `|---|---|`,
    `| Legitimate, career page responds | ${by.live.length} |`,
    `| Career URL dead or blocked | ${by.dead.length} |`,
    `| Career URL does not exist | ${by.missing.length} |`,
    `| No career URL in Excel | ${by.nous.length} |`,
    '',
    '## Career page live',
    '',
    '| Sheet | Company | Result | URL |',
    '|---|---|---|---|',
    ...by.live.map(line),
    '',
    '## Career URL does not exist',
    '',
    '| Sheet | Company | Result | URL |',
    '|---|---|---|---|',
    ...by.missing.map(line),
    '',
    '## Career URL dead or blocked',
    '',
    '| Sheet | Company | Result | URL |',
    '|---|---|---|---|',
    ...by.dead.map(line),
    '',
    '## 50 startups not already in this search (recent / funded)',
    '',
    '| Company | Site | Status | Why |',
    '|---|---|---|---|',
    ...extra.map((r) => `| ${r.name} | ${r.url} | ${r.status === 'live' ? 'site live' : r.status} | ${r.note} |`),
    '',
  ];
  writeFileSync(OUT, md.join('\n'));
}

main().catch((e) => {
  writeFileSync(OUT, `# Failed\n\n${e.stack || e.message}\n`);
  process.exit(1);
});
