// Tests du classement (logique pure extraite de index.html + fichier vendu).
// Usage : node --test tests/ranking.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function block(start, indent = '  ') {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('marqueur introuvable : ' + start);
  const j = src.indexOf('\n' + indent + '}\n', i);
  if (j < 0) throw new Error('fin de bloc introuvable pour : ' + start);
  return src.slice(i, j + ('\n' + indent + '}\n').length);
}
global.window = { location: { protocol: 'https:', hostname: 'test.invalid' } };
const harness = [
  'const norm = s => s;',
  'const escape = s => s;',
  block('function normStr(s) {'),
  block('function clubKey(s) {'),
  block('function applyFilters(rows, f) {'),
  block('function stdRanks(rows) {'),
  block('function trendLabel(t) {'),
].join('\n') + '\nreturn { normStr, clubKey, applyFilters, stdRanks, trendLabel };';
const H = new Function(harness)();

const ROWS = [
  { n: 'Léa Martin', club: 'BESANC', cat: 'U17', e: 42, score: 788, trend: 3 },
  { n: 'Max Dupont', club: 'JOUE-T', cat: 'U17', e: 12, score: 788, trend: 0 },
  { n: 'Anna Petit', club: 'BEYNOS', cat: 'U15', e: 4, score: 650, trend: 'N' },
  { n: 'Tom Moreau', club: '', cat: 'U15', e: 30, score: 500, trend: -12 },
];
const noFav = { q: '', cat: '', clubQ: '', min: 3, favKeys: null, clubNameOf: () => '' };

test('stdRanks : standard 1,2,2,4 (tri score, e, nom)', () => {
  const m = H.stdRanks(ROWS);
  assert.equal(m.get('Léa Martin'), 1);
  assert.equal(m.get('Max Dupont'), 1);
  assert.equal(m.get('Anna Petit'), 3);
  assert.equal(m.get('Tom Moreau'), 4);
});

test('applyFilters : min, cat, nom, club (code ou nom), favoris', () => {
  assert.equal(H.applyFilters(ROWS, { ...noFav, min: 5 }).length, 3);
  assert.deepEqual(H.applyFilters(ROWS, { ...noFav, cat: 'U15' }).map(r => r.n), ['Anna Petit', 'Tom Moreau']);
  assert.deepEqual(H.applyFilters(ROWS, { ...noFav, q: 'léa' }).map(r => r.n), ['Léa Martin']);
  assert.deepEqual(H.applyFilters(ROWS, { ...noFav, clubQ: 'besanc' }).map(r => r.n), ['Léa Martin']);
  assert.deepEqual(H.applyFilters(ROWS, { ...noFav, clubQ: 'joue-t' }).map(r => r.n), ['Max Dupont']);
  const clubs = { 'JOUE-T': 'JOUE LES TOURS BMX' };
  assert.deepEqual(
    H.applyFilters(ROWS, { ...noFav, clubQ: 'tours', clubNameOf: c => (clubs[c] || '') }).map(r => r.n),
    ['Max Dupont']);
  assert.deepEqual(
    H.applyFilters(ROWS, { ...noFav, favKeys: new Set(['tom moreau']) }).map(r => r.n),
    ['Tom Moreau']);
});

test('trendLabel : ▲ ▼ • N', () => {
  assert.ok(H.trendLabel(3).includes('▲3'), 'hausse');
  assert.ok(H.trendLabel(-12).includes('▼12'), 'baisse');
  assert.ok(H.trendLabel(0).includes('•'), 'stable');
  assert.ok(H.trendLabel('N').includes('>N<'), 'entrant');
});

test('perf-rankings.json vendu : trié, rangs recalculables, spot checks', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  assert.ok(j._meta && j._meta.pool === 'FR' && j.rows.length >= 5000, 'volume');
  assert.ok(j._meta.windowFrom < j._meta.windowTo, 'fenêtre 365 j');
  for (let i = 1; i < j.rows.length; i++) {
    const a = j.rows[i - 1], b = j.rows[i];
    assert.ok(b.score < a.score || (b.score === a.score && (b.e < a.e || (b.e === a.e && a.n <= b.n))), `tri rompu en ${i}`);
  }
  const m = H.stdRanks(j.rows.slice(0, 500));
  assert.equal(m.get(j.rows[0].n), 1, '1er → rang 1');
  const withClub = j.rows.find(r => r.club === 'BESANC');
  assert.ok(withClub, 'BESANC présent');
  assert.deepEqual(H.applyFilters(j.rows, { ...noFav, min: 5, clubQ: 'besanc' }).length > 0, true);
});
