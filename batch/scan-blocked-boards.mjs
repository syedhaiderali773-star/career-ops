#!/usr/bin/env node
/**
 * Playwright fallback for boards that block unattended HTTP (Henkel, Infineon, DHL).
 * Appends last-seen Germany titles to pipeline + scan-history.
 */
import { chromium } from 'playwright';
import { appendToPipeline, appendToScanHistory, loadSeenUrls } from '../scan.mjs';
import { localToday } from '../lib/local-today.mjs';
import { isMainModule } from '../lib/is-main-module.mjs';

const PHENOM_BODY = {
  lang: 'en_global',
  country: 'global',
  ddoKey: 'refineSearch',
  pageName: 'search-results',
  siteType: 'external',
  jobs: true,
  counts: true,
  from: 0,
  size: 50,
  keywords: '',
  selected_fields: { country: ['Germany'] },
  all_fields: ['category', 'country', 'city'],
};

function germany(loc) {
  return /germany|deutschland|munich|münchen|berlin|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|nuremberg|nürnberg|aachen|garching|deutschlandweit/i.test(loc || '');
}

async function phenomFromPage(page, origin) {
  return page.evaluate(async ({ origin, body }) => {
    const r = await fetch(`${origin}/widgets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, status: r.status, jobs: [] };
    const j = await r.json();
    const jobs = j?.refineSearch?.data?.jobs || [];
    return { ok: true, status: r.status, jobs };
  }, { origin, body: PHENOM_BODY });
}

function mapPhenom(company, origin, jobs) {
  return (jobs || []).map((j) => {
    const loc = [j.city, j.state, j.country].filter(Boolean).join(', ');
    const slug = String(j.title || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    return {
      url: j.applyUrl || `${origin}/job/${j.jobId}/${slug}`,
      company,
      title: j.title || '',
      location: loc,
      source: `${company.toLowerCase()}-playwright`,
      postedAt: j.postedDate ? Date.parse(j.postedDate) : undefined,
    };
  }).filter((o) => o.title && germany(o.location));
}

async function scrapeInfineon(page) {
  await page.goto('https://jobs.infineon.com/careers?domain=infineon.com&query=&location=Germany', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(4000);
  const viaApi = await phenomFromPage(page, 'https://jobs.infineon.com');
  if (viaApi.ok && viaApi.jobs.length) {
    return { via: 'widgets', offers: mapPhenom('Infineon Technologies', 'https://jobs.infineon.com', viaApi.jobs) };
  }
  const cards = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('a[href*="/job/"], a[href*="/careers/job"]')];
    return nodes.slice(0, 80).map((a) => ({
      title: (a.innerText || a.textContent || '').trim().split('\n')[0],
      href: a.href,
      loc: (a.closest('li, article, div')?.innerText || '').slice(0, 200),
    }));
  });
  const offers = cards.filter((c) => c.title && c.href).map((c) => ({
    url: c.href,
    company: 'Infineon Technologies',
    title: c.title,
    location: /germany|deutschland|munich|berlin|hamburg|dresden|regensburg|warstein/i.test(c.loc) ? c.loc.split('\n').find((l) => /germany|munich|berlin|hamburg|dresden/i.test(l)) || 'Germany' : 'Germany',
    source: 'infineon-playwright',
  }));
  return { via: `dom status=${viaApi.status}`, offers };
}

async function scrapeDhl(page) {
  await page.goto('https://careers.dhl.com/global/en/search-results?keywords=&location=Germany', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(4000);
  const viaApi = await phenomFromPage(page, 'https://careers.dhl.com');
  if (viaApi.ok && viaApi.jobs.length) {
    return { via: 'widgets', offers: mapPhenom('DHL', 'https://careers.dhl.com', viaApi.jobs) };
  }
  return { via: `widgets ${viaApi.status}`, offers: [] };
}

async function scrapeHenkel(page) {
  const tried = [];
  for (const url of [
    'https://henkel.wd3.myworkdayjobs.com/wday/cxs/henkel/External/jobs',
    'https://henkel.wd3.myworkdayjobs.com/wday/cxs/henkel/Henkel/jobs',
  ]) {
    try {
      const r = await page.request.post(url, {
        data: { appliedFacets: {}, limit: 50, offset: 0, searchText: '' },
        headers: { 'content-type': 'application/json' },
        timeout: 20000,
      });
      tried.push(`${url} ${r.status()}`);
      if (!r.ok()) continue;
      const j = await r.json();
      const jobs = j.jobPostings || [];
      const origin = 'https://henkel.wd3.myworkdayjobs.com';
      const offers = jobs.map((x) => ({
        url: x.externalPath ? `${origin}${x.externalPath}` : url,
        company: 'Henkel',
        title: x.title || '',
        location: x.locationsText || '',
        source: 'henkel-workday',
      })).filter((o) => o.title && germany(o.location));
      if (offers.length) return { via: url, offers };
    } catch (err) {
      tried.push(`${url} ${err.message}`);
    }
  }

  await page.goto('https://www.henkel.com/careers/find-your-job-apply', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(4000);
  const cards = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('a[href*="job"], a[href*="career"], a[href*="apply"]')];
    return nodes.slice(0, 80).map((a) => ({
      title: (a.innerText || a.textContent || '').trim().split('\n')[0],
      href: a.href,
    }));
  });
  const offers = cards
    .filter((c) => c.title && c.href && /intern|trainee|analyst|associate|working student|operations|marketing|procurement/i.test(c.title))
    .map((c) => ({
      url: c.href,
      company: 'Henkel',
      title: c.title,
      location: 'Germany',
      source: 'henkel-playwright',
    }));
  return { via: `html ${tried.join(' | ')}`, offers };
}

async function main() {
  const { seen } = loadSeenUrls();
  const date = localToday();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'en-GB', timezoneId: 'Europe/Berlin' });
  const summary = [];
  const newOffers = [];

  try {
    for (const [name, fn] of [
      ['Infineon', scrapeInfineon],
      ['DHL', scrapeDhl],
      ['Henkel', scrapeHenkel],
    ]) {
      try {
        const { via, offers } = await fn(page);
        const fresh = offers.filter((o) => o.url && !seen.has(o.url));
        for (const o of fresh) seen.add(o.url);
        newOffers.push(...fresh);
        summary.push({ company: name, via, found: offers.length, new: fresh.length });
        process.stderr.write(`${name}: ${offers.length} found, ${fresh.length} new (${via})\n`);
      } catch (err) {
        summary.push({ company: name, error: err.message });
        process.stderr.write(`${name}: ERROR ${err.message}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  if (newOffers.length) {
    await appendToPipeline(newOffers);
    await appendToScanHistory(newOffers, date, 'added');
  }
  console.log(JSON.stringify({ date, added: newOffers.length, boards: summary }, null, 2));
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
