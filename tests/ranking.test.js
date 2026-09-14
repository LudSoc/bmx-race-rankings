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
  block('function isoFr(iso) {'),
  block('function catSexe(code, label) {'),
  block('function isCruiserCat(code, label) {'),
  block('function catInfo(code, label) {'),
  block('function pilotAge(r, seasonYear) {'),
  block('function matchPilotAge(a, sel) {'),
  block('function pilotSuggestions(rows, q, limit = 8) {'),
  block('function locateHits(rows, q) {'),
  block('function applyFilters(rows, f) {'),
  block('function stdRanks(rows) {'),
  block('function rankFmt(n) {'),
  block('function trendLabel(t) {'),
].join('\n') + '\nreturn { normStr, clubKey, isoFr, catSexe, isCruiserCat, catInfo, pilotAge, matchPilotAge, pilotSuggestions, locateHits, applyFilters, stdRanks, rankFmt, trendLabel };';
const H = new Function(harness)();
const H2src = [
  block('function catSexe(code, label) {'),
  block('function isCruiserCat(code, label) {'),
  block('function catInfo(code, label) {'),
  block('function pilotAge(r, seasonYear) {'),
  block('function matchPilotAge(a, sel) {'),
].join('\n') + '\nreturn { catSexe, isCruiserCat, catInfo, pilotAge, matchPilotAge };';
const H2 = new Function(H2src)();

const ROWS = [
  { n: 'Léa Martin', club: 'BESANC', cat: 'U17', e: 42, score: 788, trend: 3 },
  { n: 'Max Dupont', club: 'JOUE-T', cat: 'U17', e: 12, score: 788, trend: 0 },
  { n: 'Anna Petit', club: 'BEYNOS', cat: 'U15', e: 4, score: 650, trend: 'N' },
  { n: 'Tom Moreau', club: '', cat: 'U15', e: 30, score: 500, trend: -12 },
];
const noFav = { q: '', cat: '', clubQ: '', min: 3, favKeys: null, clubNameOf: () => '' };

test('isoFr : ISO → JJ/MM/AAAA sans Date (pas de fuseau)', () => {
  assert.equal(H.isoFr('2025-09-06'), '06/09/2025');
  assert.equal(H.isoFr('2026-09-06'), '06/09/2026');
  assert.equal(H.isoFr('2026-09-06T00:00:00Z'), '06/09/2026', 'préfixe ISO OK');
  assert.equal(H.isoFr(''), '—');
  assert.equal(H.isoFr(null), '—');
});

test('stdRanks : standard 1,2,2,4 (tri score, e, nom)', () => {
  const m = H.stdRanks(ROWS);
  assert.equal(m.get('Léa Martin'), 1);
  assert.equal(m.get('Max Dupont'), 1);
  assert.equal(m.get('Anna Petit'), 3);
  assert.equal(m.get('Tom Moreau'), 4);
});

test('applyFilters : min, cat, club (code ou nom), favoris — q ne filtre plus', () => {
  assert.equal(H.applyFilters(ROWS, { ...noFav, min: 5 }).length, 3);
  assert.deepEqual(H.applyFilters(ROWS, { ...noFav, cat: 'U15' }).map(r => r.n), ['Anna Petit', 'Tom Moreau']);
  assert.equal(H.applyFilters(ROWS, { ...noFav, q: 'léa' }).length, 4, 'q = localisation, pas filtre');
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

test('locateHits : indices des correspondances, insensible accents/casse', () => {
  assert.deepEqual(H.locateHits(ROWS, ''), [], 'vide = rien');
  assert.deepEqual(H.locateHits(ROWS, 'léa'), [0]);
  assert.deepEqual(H.locateHits(ROWS, 'LEA'), [0], 'casse + accent');
  assert.deepEqual(H.locateHits(ROWS, 'moreau'), [3]);
  assert.deepEqual(H.locateHits(ROWS, 'a'), [0, 1, 2, 3], 'sous-chaîne partout');
  assert.deepEqual(H.locateHits(ROWS, 'zzz'), [], 'aucune');
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  const hits = H.locateHits(j.rows, 'martin');
  assert.ok(hits.length > 5, `plusieurs Martin (${hits.length}) — Entrée les parcourt`);
  assert.ok(hits.every((v, i, a) => i === 0 || a[i - 1] < v), 'indices croissants');
});

test('pilotSuggestions : top N dans l\'ordre du classement, insensible accents', () => {
  assert.deepEqual(H.pilotSuggestions(ROWS, ''), [], 'vide = rien');
  assert.deepEqual(H.pilotSuggestions(ROWS, 'zzz'), [], 'aucune');
  assert.deepEqual(H.pilotSuggestions(ROWS, 'léa').map(r => r.n), ['Léa Martin']);
  assert.deepEqual(H.pilotSuggestions(ROWS, 'LEA').map(r => r.n), ['Léa Martin'], 'casse + accent');
  assert.deepEqual(
    H.pilotSuggestions(ROWS, 'a').map(r => r.n),
    ['Léa Martin', 'Max Dupont', 'Anna Petit', 'Tom Moreau'], 'ordre du tableau conservé');
  const many = Array.from({ length: 12 }, (_, i) => ({ n: 'Test Pilote' + i, e: 5, score: 600 - i }));
  assert.equal(H.pilotSuggestions(many, 'pilote').length, 8, 'plafond défaut 8');
  assert.equal(H.pilotSuggestions(many, 'pilote', 3).length, 3, 'limite paramétrable');
  assert.equal(H.pilotSuggestions(many, 'pilote')[0].n, 'Test Pilote0', 'meilleur classé d\'abord');
});

test('catSexe : F / H / X (mixte)', () => {
  assert.equal(H2.catSexe('U11GR', 'U11 GARÇON'), 'H');
  assert.equal(H2.catSexe('U11FR', 'U11 FILLE'), 'F');
  assert.equal(H2.catSexe('H1724R', 'HOMME 17/24'), 'H');
  assert.equal(H2.catSexe('F17+R', ' FEMME 17+'), 'F');
  assert.equal(H2.catSexe('EH', 'Elite Homme'), 'H');
  assert.equal(H2.catSexe('EF', 'Elite Femme'), 'F');
  assert.equal(H2.catSexe('U13', 'U13'), 'X');
  assert.equal(H2.catSexe('U13GNR', 'U13 NOVICE GARÇON + FILLE'), 'X');
  assert.equal(H2.catSexe('CRU15GR', 'CRUISER U15/U17'), 'X');
  assert.equal(H2.catSexe('CRH4044R', 'CRUISER 40 ANS ET +'), 'H');
  assert.equal(H2.catSexe('CRF1729R', 'CRUISER FEMME '), 'F');
  assert.equal(H2.catSexe('MA30+', 'Masters 30+'), 'X');
  assert.equal(H2.catSexe('B15', 'Boys 15/16'), 'H', 'UEC Boys');
  assert.equal(H2.catSexe('G13', 'Girls 13/14'), 'F', 'UEC Girls (≠ Garçon)');
  assert.equal(H2.catSexe('ME', 'Men Elite'), 'H');
  assert.equal(H2.catSexe('WE', 'Women Elite'), 'F');
  assert.equal(H2.catSexe('WJ', 'Women Junior'), 'F');
  assert.equal(H2.catSexe('C17', 'Cruisers 17-29'), 'X', 'cruiser mixte');
  assert.equal(H2.catSexe('D17', 'Cruiser Women 17-29 year'), 'F');
  assert.equal(H2.catSexe('U17-24M_CR', 'Cruiser Men 17-24'), 'H');
  assert.equal(H2.catSexe('U30+M_20_M', 'Masters Men 30 +'), 'H');
  assert.equal(H2.catSexe('B15', 'Boys 15/16 year'), 'H', 'code repli inutile, libellé suffit');
});

test('isCruiserCat : code CR* ou libellé', () => {
  assert.equal(H2.isCruiserCat('CRU15F', 'Cruiser U15 Fille'), true);
  assert.equal(H2.isCruiserCat('CRH4044R', 'CRUISER 40 ANS ET +'), true);
  assert.equal(H2.isCruiserCat('U13GR', 'U13 GARÇON'), false);
  assert.equal(H2.isCruiserCat('MA30+', 'Masters 30+'), false);
});

test('perf-rankings.json : champ by (année de naissance) complet', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  assert.ok(j.rows.every(r => Number.isInteger(r.by)), 'by présent sur toutes les lignes (pool français renseigné)');
  const bys = j.rows.map(r => r.by);
  assert.ok(Math.min(...bys) >= 1930 && Math.max(...bys) <= 2030, `plage by plausible (${Math.min(...bys)}–${Math.max(...bys)})`);
});

test('pilotAge / matchPilotAge : âge sportif réel', () => {
  assert.equal(H2.pilotAge({ by: 2015 }, 2026), 11);
  assert.equal(H2.pilotAge({ by: 2015 }, null), null);
  assert.equal(H2.pilotAge({}, 2026), null, 'sans by = exclu du filtre âge');
  assert.equal(H2.matchPilotAge(11, '11'), true);
  assert.equal(H2.matchPilotAge(12, '11'), false, 'la catégorie ne compte plus');
  assert.equal(H2.matchPilotAge(6, '6-'), true);
  assert.equal(H2.matchPilotAge(7, '6-'), false);
  assert.equal(H2.matchPilotAge(24, '17+'), true);
  assert.equal(H2.matchPilotAge(16, '17+'), false);
  assert.equal(H2.matchPilotAge(null, '11'), false);
  assert.equal(H2.matchPilotAge(11, ''), true, 'pas de filtre = passe');
});

test('applyFilters : sexe + âge réel combinables', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  const infoOf = code => H2.catInfo(code, j.cats[code] || '');
  const base = { q: '', cat: '', clubQ: '', min: 3, sexe: '', age: '', seasonYear: 2026, favKeys: null, clubNameOf: () => '', catInfoOf: infoOf };
  const rows2 = [
    { n: 'A', club: '', cat: 'U13GR', e: 5, score: 600, trend: 0, by: 2014 }, // 12 ans
    { n: 'B', club: '', cat: 'U13FR', e: 5, score: 600, trend: 0, by: 2014 },
    { n: 'C', club: '', cat: 'U13', e: 5, score: 600, trend: 0, by: 2014 },
    { n: 'D', club: '', cat: 'H1724', e: 5, score: 600, trend: 0, by: 2000 }, // 26 ans
    { n: 'E', club: '', cat: 'U13GR', e: 5, score: 600, trend: 0, by: 2015 }, // 11 ans en U13 !
  ];
  assert.deepEqual(H.applyFilters(rows2, { ...base, sexe: 'F' }).map(r => r.n), ['B'], 'F exclut mixtes');
  assert.deepEqual(H.applyFilters(rows2, { ...base, sexe: 'H' }).map(r => r.n), ['A', 'D', 'E']);
  assert.deepEqual(H.applyFilters(rows2, { ...base, age: '12' }).map(r => r.n), ['A', 'B', 'C']);
  assert.deepEqual(H.applyFilters(rows2, { ...base, age: '11' }).map(r => r.n), ['E'], '11 ans en U13 retrouvé');
  assert.deepEqual(H.applyFilters(rows2, { ...base, age: '17+' }).map(r => r.n), ['D']);
  assert.deepEqual(H.applyFilters(rows2, { ...base, sexe: 'H', age: '11' }).map(r => r.n), ['E']);
  // volume réel : 11 ans ~430, femmes ~1000 (FR + internationales)
  const y11 = H.applyFilters(j.rows, { ...base, min: 5, age: '11' });
  assert.ok(y11.length > 350 && y11.length < 550, `11 ans volume plausible (${y11.length})`);
  const f = H.applyFilters(j.rows, { ...base, min: 5, sexe: 'F' });
  assert.ok(f.length > 750 && f.length < 1050, `F volume plausible (${f.length})`);
});
test('applyFilters : âge réel par année', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  const infoOf = code => H2.catInfo(code, j.cats[code] || '');
  const base = { q: '', cat: '', clubQ: '', min: 3, sexe: '', age: '', seasonYear: 2026, favKeys: null, clubNameOf: () => '', catInfoOf: infoOf };
  const rows = [
    { n: 'A', club: '', cat: 'U7GR', e: 5, score: 600, trend: 0, by: 2020 },   // 6 ans
    { n: 'B', club: '', cat: 'U13GR', e: 5, score: 600, trend: 0, by: 2015 },  // 11 ans en U13
    { n: 'C', club: '', cat: 'U9GR', e: 5, score: 600, trend: 0, by: 2018 },   // 8 ans
    { n: 'D', club: '', cat: 'G9', e: 5, score: 600, trend: 0, by: 2017 },     // 9 ans
    { n: 'F', club: '', cat: 'H1724', e: 5, score: 600, trend: 0, by: 2002 },  // 24 ans
    { n: 'G', club: '', cat: 'U13GR', e: 6, score: 600, trend: 0, cr: 2, by: 2014 },   // 12 ans, mixte 20"+cruiser
    { n: 'H', club: '', cat: 'CRU15F', e: 6, score: 600, trend: 0, cr: 4, by: 2012 },  // 14 ans, mixte
  ];
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '6-' }).map(r => r.n), ['A']);
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '11' }).map(r => r.n), ['B']);
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '8' }).map(r => r.n), ['C']);
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '12' }).map(r => r.n), ['G']);
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '14' }).map(r => r.n), ['H']);
  assert.deepEqual(H.applyFilters(rows, { ...base, age: '17+' }).map(r => r.n), ['F']);
  // volumes réels (min 5) : distribution lisse par âge réel
  const n6 = H.applyFilters(j.rows, { ...base, min: 5, age: '6-' }).length;
  const n8 = H.applyFilters(j.rows, { ...base, min: 5, age: '8' }).length;
  const n11 = H.applyFilters(j.rows, { ...base, min: 5, age: '11' }).length;
  const n17 = H.applyFilters(j.rows, { ...base, min: 5, age: '17+' }).length;
  assert.ok(n6 > 120 && n6 < 260, `6- plausible (${n6})`);
  assert.ok(n8 > 320 && n8 < 500, `8 ans plausible (${n8})`);
  assert.ok(n11 > 350 && n11 < 550, `11 ans plausible (${n11})`);
  assert.ok(n17 > 1500 && n17 < 2200, `17+ plausible (${n17})`);
});

test('rankFmt : ordinal français', () => {
  assert.equal(H.rankFmt(1), '1er');
  assert.equal(H.rankFmt(2), '2e');
  assert.equal(H.rankFmt(45), '45e');
});

test('rangs filtrés : recalculés sur la vue, rappel = seuil engagements seul', () => {
  const global = H.stdRanks(ROWS);
  assert.equal(global.get('Anna Petit'), 3, 'global : Anna 3e');
  const sub = ROWS.slice(2); // filtre fictif : Anna 650, Tom 500 (ordre trié conservé)
  const franks = H.stdRanks(sub);
  assert.equal(franks.get('Anna Petit'), 1, 'filtré : Anna 1re de la vue');
  assert.equal(franks.get('Tom Moreau'), 2, 'filtré : Tom 2e de la vue');
  // cas réel : 12 ans — le 1er de la vue n'est pas forcément le 1er du classement
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  const infoOf = code => H.catInfo(code, j.cats[code] || '');
  const base = { q: '', cat: '', clubQ: '', min: 5, sexe: '', age: '12', seasonYear: 2026, favKeys: null, clubNameOf: () => '', catInfoOf: infoOf };
  const vue = H.applyFilters(j.rows, base);
  const fvue = H.stdRanks(vue), gnational = H.stdRanks(j.rows);
  assert.equal(fvue.get(vue[0].n), 1, '1er de la vue 12 ans = rang filtré 1');
  const decales = vue.filter(r => gnational.get(r.n) > fvue.get(r.n));
  assert.ok(decales.length > vue.length / 2, `la plupart des lignes ont un rappel global > rang filtré (${decales.length}/${vue.length})`);
});

test('rappel gris : référence = seuil engagements min (pas de gris par défaut)', () => {
  // ROWS : Anna (e=4) exclue par le seuil min 5 par défaut.
  const tous = H.stdRanks(ROWS);                          // fichier complet (e≥3)
  const ref = H.stdRanks(ROWS.filter(r => r.e >= 5));     // référence app (min 5)
  assert.equal(tous.get('Tom Moreau'), 4, 'fichier complet : Tom 4e derrière Anna');
  assert.equal(ref.get('Tom Moreau'), 3, 'référence min 5 : Tom 3e');
  assert.equal(ref.get('Léa Martin'), tous.get('Léa Martin'), 'tête inchangée → pas de gris');
  assert.equal(ref.get('Max Dupont'), tous.get('Max Dupont'));
});

test('trendLabel : ▲ ▼ • N', () => {
  assert.ok(H.trendLabel(3).includes('▲3'), 'hausse');
  assert.ok(H.trendLabel(-12).includes('▼12'), 'baisse');
  assert.ok(H.trendLabel(0).includes('•'), 'stable');
  assert.ok(H.trendLabel('N').includes('>N<'), 'entrant');
});

test('perf-rankings.json vendu : pool français toutes courses, trié, spot checks', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  assert.ok(j._meta && j._meta.pool === 'FR+' && j.rows.length >= 8000, `pool FR+ (${j._meta.pool}, ${j.rows.length} lignes)`);
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

test('pool français : club FR réel, mais toutes les courses comptent', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf-rankings.json'), 'utf8'));
  const sy = parseInt(j._meta.windowTo.slice(0, 4), 10);
  const infoOf = code => H.catInfo(code, j.cats[code] || '');
  const base = { q: '', cat: '', clubQ: '', min: 3, sexe: '', age: '', seasonYear: sy, favKeys: null, clubNameOf: () => '', catInfoOf: infoOf };
  const ragot = j.rows.find(r => r.n === 'Mathis RAGOT RICHARD');
  assert.ok(ragot, 'Ragot présent');
  assert.equal(ragot.e, 29, '12 FR + 11 UEC + 6 Coupe du monde fusionnés');
  assert.ok(ragot.score > 800 && ragot.score < 900, `WC dilue (mid-pack mondial) : ${ragot.score}`);
  for (const absent of ['Jules KASPER', 'Evi BLOK', 'James CLITHEROE']) {
    assert.ok(!j.rows.some(r => r.n === absent), `étranger exclu (${absent})`);
  }
  assert.ok(j.rows.every(r => r.club), 'club toujours renseigné (pool = club FR)');
  assert.ok(H.applyFilters(j.rows, { ...base, min: 5, sexe: 'H', age: '28' }).some(r => r.n === 'Mathis RAGOT RICHARD'), 'Ragot (1998) : 28 ans');
});
