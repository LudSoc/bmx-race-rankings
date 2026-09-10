# Spec — Sqorz · Classements (`ranking_stats` / `sqorz-rankings`)

Classement national des pilotes BMX Race par indice de performance.
Statut : **décisions prises le 2026-09-10 — prête à coder.**
Décisions : fenêtre **365 j glissants** · **aucun plancher d'âge** · rangs **standard (1,2,2,4)** ·
`sync-data.sh` unique · aide **courte + lien fiche**.

## 1. Vision

Répondre à « qui domine le plus son monde », pas « qui est le meilleur dans l'absolu ».
L'indice mesure une domination **relative au plateau, ajustée de sa force** (formule
inchangée de `sqorz_stats`, cf. aide « Comment est-il calculé ? »). L'intitulé de
l'app doit le dire explicitement, sous le titre.

## 2. Non-objectifs (V1)

- Pas de temps réel : rebuild hebdo comme tout l'écosystème, date de calcul affichée.
- Pas d'UEC/UCI : périmètre FR uniquement (régional + national).
- Pas de prédiction ni de simulation (voir idées « prédicteur » / « simulateur », hors scope).
- Pas de comptes : favoris éventuels via l'état partagé `sqorz.*` existant, rien de plus.

## 3. Données — `perf-rankings.json` (build-time, jamais au runtime)

Calculer l'indice de 17k pilotes côté navigateur coûterait plusieurs minutes :
le classement est pré-calculé par le build hebdo, là où vit déjà la force de plateau.

- **Script** : `sqorz_stats/tools/build-perf-rankings.cjs` (à créer).
- **Entrées** : `pilots-index.json` + `field-strength-fr.json` (+ `clubs.json` canonique
  pour figer `club` et `clubName` par pilote).
- **Calcul** : même pipeline que la partie Global de `sqorz_stats` (rang z-score
  exposant 2,5 · constance ×0,97–1,05 · chrono 0,3/1,3 · niveau ×0,93/×1,0 ·
  plateau +0,3×écart · DNF 250/400/550/700 · shrinkage +2 · clamp 5–1000),
  **sans les séries** (décision actée : courses uniquement).
- **Fenêtre** : 365 j glissants — **ACTÉ le 2026-09-10.** Recalculée à chaque build,
  affichée explicitement (« calculé du … au … »).
- **Sortie** (`sqorz_stats/perf-rankings.json`, ~660 Ko pour ~8k lignes e≥3) :
  ```json
  { "_meta": { "generated": "2026-09-10", "windowFrom": "2025-09-06", "windowTo": "2026-09-06", "pool": "FR", "count": 8254 },
    "cats": { "U17": "U17 Garçon", "...": "..." },
    "rows": [{ "n": "Prénom NOM", "club": "BESANC", "cat": "U17", "e": 42, "score": 788, "trend": 3 }] }
  ```
  `cat` = code de catégorie dominant (+ légende `cats`) ; `club` = code Sqorz
  (nom complet via `clubs.json` vendu, pas dupliqué ici) ; rangs standard
  recalculés côté app (lignes triées) ; `trend` = delta de rang vs build N−1
  (`"N"` si entrant — requiert l'artefact précédent, conservé par le build).
- **Synchro** : copie versionnée vers `ranking_stats/` (pattern `clubs.json` :
  pas de dépendance runtime croisée) via **`sync-data.sh` unique** (clubs.json +
  perf-rankings.json) — **ACTÉ le 2026-09-10.**

## 4. Règles de classement

- **Pool** : pilotes FR avec ≥ **5 engagements** sur la fenêtre (défaut, modifiable
  3–20 par filtre). En dessous, le shrinkage tasse tout vers 500 : le bas du
  classement ne voudrait rien dire.
- **Plancher d'âge** : aucun — **ACTÉ le 2026-09-10** (toutes catégories, comme en course).
- **Tri** : score desc, ex-aequo → engagements desc, puis nom (déterministe).
  Rangs **standard (1,2,2,4)** — **ACTÉ le 2026-09-10.**

## 5. UI (une vue, bien faite)

- **Tableau** : rang, pilote (lien fiche `sqorz-stats/?name=`), club (lien
  `sqorz-club/?club=` + nom complet via `clubs.json` vendu), catégorie, engagements,
  indice, tendance. 100 lignes/page + « charger plus ».
- **Filtres** (état dans l'URL : `?cat=&club=&q=&min=`) : catégorie (liste), club
  (recherche avec suggestions `Nom (CODE)`), engagements min (3–20), recherche nom
  (sous-chaîne insensible accents, réutiliser `hubNorm`-like local).
- **Ligne « toi »** : si un favori `sqorz.favs.pilots` est dans le pool, bouton
  « retrouver mes suivis » qui filtre/scrolle jusqu'à eux (seul usageole de l'état
  partagé en V1).
- **En-tête** : intitulé honnête + fenêtre (« calculé sur 2026 au 10/09/2026 ») +
  lien « comment est calculé l'indice » (version courte inline + lien fiche —
  **ACTÉ le 2026-09-10**, pas de duplication intégrale).
- **Vide** : filtres sans résultat → état vide explicite + bouton reset.

## 6. Conventions écosystème (obligatoires)

- `theme.css` vendu (couleurs/ombres/focus/reduced-motion uniques).
- `common.js` via CDN `sqorz-stats` + repli local, avec gardes `typeof` (jamais de
  page blanche sur décalage de déploiement).
- `clubs.json` vendu (noms complets).
- Footer « Données issues de Sqorz » seul (pas d'UEC dans le pool).
- `tests/` colocalisés, pattern extractionNode (`node --test`), suites vertes exigées.
- Hub : ajouter `sqorz-rankings` à `DISPLAY_NAMES` + `STATIC_PROJECTS`
  (+ branche `main`) pour détection, cartes et recherche universelle.
- Pousser `sqorz_stats` (artefact) avant `ranking_stats` ; pas d'autre contrainte d'ordre.

## 7. Décisions (prises le 2026-09-10, voir annotations ACTÉ ci-dessus)

1. Fenêtre 365 j glissants · 2. Aucun plancher d'âge · 3. Rangs standard (1,2,2,4) ·
4. `sync-data.sh` unique · 5. Aide courte + lien fiche.

## 8. Effort estimé

~1–1,5 jour : build + spec §3 (3 h), app + filtres + liens (5 h), hub 2 lignes +
tests + recette (3 h). Zéro infra, zéro coût (R2 + Pages existants).
