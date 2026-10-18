import { readFileSync } from 'fs';

const wb = readFileSync('data/.xlsx-tmp/xl/workbook.xml', 'utf8');
const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
console.log('SHEETS', sheets.join(' | '));

const sstXml = readFileSync('data/.xlsx-tmp/xl/sharedStrings.xml', 'utf8');
const strings = [];
const re = /<si>([\s\S]*?)<\/si>/g;
let m;
while ((m = re.exec(sstXml))) {
  const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
  strings.push(texts.join(''));
}
console.log('SST_COUNT', strings.length);
strings.slice(0, 50).forEach((s, i) => console.log(i, JSON.stringify(s).slice(0, 100)));
