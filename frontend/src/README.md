# Formats d'exercices

Ce document décrit les types d'exercices que l'application peut proposer, le format de données attendu pour chacun, la façon dont les réponses sont corrigées, et l'architecture qui les fait fonctionner.

- [1. Vue d'ensemble](#1-vue-densemble)
- [2. Ajouter des exercices à une question](#2-ajouter-des-exercices-à-une-question)
- [3. Catalogue des formats](#3-catalogue-des-formats)
- [4. Règles de correction](#4-règles-de-correction)
- [5. Architecture](#5-architecture)
- [6. Tests](#6-tests)
- [7. Limites connues](#7-limites-connues)
- [8. Journal des modifications](#8-journal-des-modifications)

---

## 1. Vue d'ensemble

Une **question** (dans `data/subjects/**/questions/*.json`) peut lister plusieurs **formats** dans son champ `formats`. À chaque tirage, l'application :

1. ne garde que les formats dont la question possède les données nécessaires (un format sans ses données n'est jamais proposé) ;
2. tire au hasard l'un de ces formats ;
3. construit l'exercice, puis l'affiche avec la **vue** correspondante ;
4. corrige la réponse et affiche l'explication.

Chaque format appartient à l'une des deux **catégories**, qui pilotent la maîtrise et la certification :

| Catégorie | Ce que fait l'élève | Exemples |
|---|---|---|
| `theory` | reconnaître, choisir, relier, ordonner | QCM, vrai/faux, association, ordre des étapes |
| `practice` | calculer, saisir, rédiger, coder | calcul, texte à trous, preuve, code, dictée |

Seule la catégorie `practice` compte pour la validation de la pratique (score de pratique requis pour la certification). La liste est construite automatiquement à partir du registre (`engine/formats.js`).

Les formats sont **déclarés une seule fois** dans le registre `engine/formats.js`. Aucune question existante n'utilise les nouveaux formats : ils apparaissent dès qu'une question les liste dans `formats` et possède les données requises.

---

## 2. Ajouter des exercices à une question

Exemple minimal : une question peut proposer un QCM, une flashcard et un calcul, à condition de fournir les champs correspondants.

```json
{
  "id": "maths_algebre_001",
  "skill": "maths.algebre",
  "difficulty": 2,
  "prompt": "Quelle est la forme développée de (x + 3)² ?",
  "answer": "x² + 6x + 9",
  "distractors": ["x² + 9", "x² + 3x + 9", "x² + 6x + 3"],
  "explanation": "(a + b)² = a² + 2ab + b², donc (x + 3)² = x² + 6x + 9.",
  "formats": ["single_choice", "flashcard", "equation_solver"]
}
```

Règles générales :

- `formats` : liste d'identifiants (section 3). Un identifiant inconnu est ignoré sans erreur.
- `prompt` : l'énoncé. Certaines vues ont des valeurs par défaut quand il est absent.
- `explanation`, ou `explanations: { simple, deep }` pour trois niveaux de détail.
- Formules : `$…$` en ligne, `$$…$$` en bloc (KaTeX). Dans les réponses saisies, on écrit en texte brut : `x^2`, `2*x`, `sqrt` n'est pas géré, utiliser `^(1/2)`.
- Nombres : virgule ou point acceptés. Fractions acceptées pour les probabilités et les calculs (`1/4`).
- Gabarit (`template`) : pour les formats numériques (`numeric`, `numeric_answer`, `estimate_answer`, `scientific_calculation`, `single_choice`), les valeurs sont tirées à chaque affichage. Voir `engine/template.js`.
- `draft: true` : la question n'est jamais proposée (utile pour les brouillons).

Un fichier d'exemples complet, avec un exercice pour chacun des 63 formats, se trouve dans `docs/exemples_formats.json`. Ce fichier est **hors** de `data/`, il n'est donc jamais chargé par l'application : il sert de modèle et de jeu de test.

---

## 2bis. Champs de correction avancés

### Grille de notions (`evaluation`)

Une réponse libre est évaluée par **notions** plutôt que par comparaison exacte. Format identique à celui des questions `stability` :

```json
"evaluation": {
  "type": "semantic",
  "required": [["bout en bout", "entre processus"], ["flux", "contrôle du flux"]],
  "labels": ["Communication de bout en bout", "Contrôle de flux"],
  "optional": [["fiable", "fiabilité"], ["tcp"]],
  "forbidden": ["couche réseau"],
  "minWords": 8
}
```

- `required` : une liste de groupes. Chaque groupe est satisfait si l'un de ses termes apparaît. Tous les groupes sont obligatoires.
- `labels` : le nom affiché de chaque groupe (sinon le premier terme).
- `optional` : précisions utiles. Elles sont signalées mais n'empêchent jamais la réussite.
- `forbidden` : termes qui invalident la réponse (ex. une affirmation fausse).
- `atLeast` : `{ "count": 2, "groups": […], "labels": […] }`, au moins `count` groupes parmi `groups`.
- `minWords` : nombre de mots minimum.

Les termes sont comparés **en mots entiers**, sans accents ni casse, avec tolérance au pluriel et au féminin (`vitesse` ~ `vitesses`). Ainsi `forbidden: ["et"]` ne rejette pas « étendu ».

Quand une grille est fournie, l'élève voit les notions trouvées et celles qui manquent. Sans grille, l'appli compare les notions clés du corrigé (mots longs et non courants) et indique lesquelles reviennent dans la réponse.

Pour une rédaction auto-évaluée (`long_answer`, `proof`, `source_analysis`…), la grille devient la **liste de contrôle** : chaque notion est cochée automatiquement sur le brouillon (bouton « Vérifier mes notions »), l'élève peut corriger à la main, et une note est suggérée (tout coché : Compris ; la moitié : Presque ; sinon : Raté).

### Gabarit de calcul (`variables`, `expected`, `steps`)

Pour un calcul dont les valeurs changent à chaque affichage (format `math_expression`) :

```json
"prompt": "Développer et réduire l'expression suivante : {a}(x + {b}) + {c}x.",
"variables": { "a": { "range": [2, 8], "integer": true }, "b": { "range": [1, 9], "integer": true }, "c": { "range": [2, 8], "integer": true } },
"expected": "{a+c}*x+{a*b}",
"steps": ["{a}x+{a*b}+{c}x", "{a+c}x+{a*b}"],
"requireSteps": true,
"answerMode": "expression"
```

- Chaque `{…}` est remplacé par la valeur de l'expression (`{a+c}` → `10`). Les nombres négatifs sont mis entre parenthèses.
- Avec `requireSteps: true`, l'élève écrit les étapes dans l'ordre, une par ligne. Chaque étape doit reprendre **la forme écrite attendue** : `8x+32+8x` et `16x+32` sont deux étapes différentes, et écrire deux fois la même ligne ne suffit pas. Les termes peuvent être dans un ordre différent (`32+8x+8x` est accepté).
- Sans `requireSteps`, seule la réponse finale compte, comparée par équivalence (`2x+3` = `3+2x`).
- Un calcul numérique intermédiaire (`3+4` → `7`) est accepté par sa valeur.
- L'ancien schéma `calculation` (avec `range` et `steps` en objets) reste pris en charge.

### Unités et chiffres significatifs

Quand `unit` est défini, l'élève doit donner l'unité : « 13 » est refusé pour « 13 cm » avec le message « N’oublie pas l’unité ». Les conversions sont faites automatiquement entre unités de même grandeur (`125 mm` = `12,5 cm`). Unités reconnues : longueurs, surfaces, volumes, masses, temps, énergies, puissances, forces, pressions, vitesses, tensions, intensités, masses volumiques (`g/cm3`), quantités de matière et concentrations.

`sigfigs: 3` exige exactement 3 chiffres significatifs (`2,70` oui, `2,7` non). `requireUnit: false` tolère l'absence d'unité.

Les pourcentages sont lus partout où une valeur est attendue : `30 %` vaut `0,3`.

### Contre-exemples vérifiés

Un contre-exemple est vérifié automatiquement :

```json
"hypothesis": "x^2 > 4",
"conclusion": "x > 2",
"variable": "x"
```

Le nombre saisi doit vérifier l'hypothèse et **violer** la conclusion. Les expressions sont des comparaisons (`<`, `<=`, `>`, `>=`, `==`, `!=`).

### Logique

- `mode` absent (ou `"table"`) : l'élève complète la table de vérité de `expression`, case par case (0 ou 1).
- `mode: "write"` : l'élève écrit une expression dont la table est celle de `target`. La comparaison se fait sur la table de vérité, donc `!(!A | B)` est accepté pour `A & !B`. Les lignes où la réponse diffère sont signalées.

Syntaxe : variables (lettres), `0`, `1`, `!` ou `¬` (non), `&` ou `∧` (et), `|` ou `∨` (ou), `^` ou `⊕` (ou exclusif). Priorités : `¬` puis `∧`, puis `∨` et `⊕` de gauche à droite. Utiliser des parenthèses pour lever tout doute.

### Équations

Avec `equation` (ex. `"x^2 + x - 6 = 0"`), chaque solution proposée est remplacée dans l'équation et le résultat est affiché (« x = 2 vérifie l’équation »). Les solutions manquantes sont comptées.

### Explications par choix

Pour les QCM, `why` associe à chaque mauvais choix une explication, affichée quand l'élève le choisit :

```json
"why": { "Bonsoir": "« Bonsoir » est la formule du soir." }
```

Pour les dialogues, `notes` joue le même rôle, réplique par réplique.

### Justification (`justify_answer`)

Deux champs : la réponse, puis la justification. La réponse est comparée au corrigé, la justification à la grille `evaluation` (ou, à défaut, aux notions clés de `justification`).

### Code

- `mustDefine: "somme"` : vérifie qu'une fonction `somme` est bien définie.
- Les parenthèses et crochets sont contrôlés (équilibre).
- Le code n'est pas exécuté : la correction reste une auto-évaluation accompagnée de ces contrôles.

---

## 3. Catalogue des formats

Légende des vues : `choice` (un choix), `multi` (plusieurs choix), `matching` (association), `ordering` (ordre), `cloze` (trous), `text` (saisie), `numeric` (nombre), `parts` (plusieurs réponses courtes), `table` (tableau à compléter), `self` (rédaction puis auto-évaluation), `speak` (oral), `turns` (dialogue).

Données : **obligatoire** en gras quand elle manque, le format n'est pas proposé. Les champs optionnels sont indiqués entre parenthèses.

### 3.1 Formats de base

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `single_choice` | QCM | théorie | choice | `answer`, `distractors` (≥ 1) — ou `template` |
| `multi_choice` | QCM à réponses multiples | théorie | multi | `answers` (≥ 2), `distractors` |
| `true_false` | Vrai ou faux | théorie | choice | `answer`, `distractors` (≥ 1) : la proposition fausse |
| `flashcard` | Flashcard | théorie | self | `answer` (recto/verso, auto-évaluation) |
| `fill_blank` | Texte à trous | pratique | cloze | `cloze` avec `{{blank}}`, `answer` ou `answers` |
| `ordering` | Remettre dans l'ordre | théorie | ordering | `steps` (≥ 2, dans l'ordre correct) |
| `matching` | Association | théorie | matching | `pairs` (≥ 2) : `[[gauche, droite], …]` |
| `numeric` | Calcul | pratique | numeric | `answer` numérique — ou `template` |

### 3.2 Réponses ouvertes

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `short_answer` | Réponse courte | pratique | text | `answer`, (`accepts`), (`evaluation`: notions attendues), (`placeholder`) |
| `long_answer` | Réponse développée | pratique | text | `answer` (corrigé) ou `evaluation` (notions attendues, voir §2bis), (`minWords`), (`placeholder`) |
| `math_expression` | Expression mathématique | pratique | text | `answer` (expression ou équation), (`accepts`) — ou un gabarit `variables` + `expected` + `steps` + `requireSteps` (voir §2bis) |
| `code_answer` | Réponse en code | pratique | self | `answer` (code solution), (`lang`), (`mustDefine`: nom de fonction à définir), (`criteria`) |
| `proof` | Preuve libre | pratique | self | `answer` (démonstration modèle), (`criteria`) |
| `guided_proof` | Preuve guidée | pratique | cloze | `cloze` multi-lignes avec `{{blank}}`, `answers` |
| `proof_completion` | Preuve à trous | pratique | cloze | `cloze` avec `{{blank}}`, `answers` |
| `proof_reordering` | Preuve à ordonner | théorie | ordering | `steps` (≥ 2, ordre correct) |
| `proof_error_detection` | Preuve à erreur | théorie | choice | `steps` (≥ 2), `error` (indice de l'étape fausse, à partir de 0), (`explanation`) |
| `justify_answer` | Réponse avec justification | pratique | justify | `answer`, (`accepts`), (`justification`: corrigé de la justification), (`evaluation`: notions attendues dans la justification), (`answerLabel`, `justifyLabel`) |

### 3.3 Calcul et raisonnement mathématique

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `numeric_answer` | Réponse numérique | pratique | numeric | `answer` ou `range: [min, max]` ; (`unit`, avec conversion), (`sigfigs`: chiffres significatifs), (`requireUnit`: `false` pour tolérer l'absence d'unité), (`tolerance`: `{abs}` ou `{rel}`), (`decimals`) |
| `equation_solver` | Résolution d'équation | pratique | text | `answer` (ex. `S = {2 ; -3}`) ou `solutions` (liste), (`equation`: vérification de chaque solution), (`hint`) |
| `logic_circuit` | Circuit logique | pratique | parts (ou text) | `expression` (table à compléter) ; ou `mode: "write"` + `target` (écrire l'expression correspondant à la table) |
| `induction_proof` | Démonstration par récurrence | pratique | self | `sections: [{label, answer}]` ou `answer` |
| `expression_simplification` | Simplification d'expression | pratique | text | `answer` (forme simplifiée), (`hint`) |
| `matrix_operation` | Opération de matrice | pratique | table | `table` (grille, cases `"?"` à compléter), `answer` (grille complète) |
| `confusion_matrix` | Matrice de confusion | pratique | table | idem `matrix_operation` ; affiche l'exactitude, la précision et le rappel une fois complétée |
| `probability_tree` | Arbre de probabilité | pratique | parts | `paths: [{label, answer}]` (réponses en décimal, fraction `1/4` ou pourcentage `25 %`) |
| `sequence_completion` | Complétion de séquence | pratique | parts | `parts: [{label, answer}]`, (`formula`) |
| `multi_step_calculation` | Calcul à plusieurs étapes | pratique | parts | `parts: [{label, answer}]` (une valeur par étape), (`hint`) |
| `function_analysis` | Analyse de fonction | pratique | parts | `parts: [{label, answer, kind}]` ; `kind` = `text`, `interval`, `expression`, `number` |
| `coordinate_answer` | Réponse en coordonnées | pratique | text | `answer` : `(x ; y)` |
| `interval_answer` | Réponse en intervalle | pratique | text | `answer` : `]-∞;2] ∪ [5;+∞[` |
| `vector_operation` | Opération sur des vecteurs | pratique | text | `answer` : `(x ; y)` ou `(x ; y ; z)` |
| `counterexample` | Contre-exemple | pratique | text (ou self) | `hypothesis` + `conclusion` (vérification automatique), (`variable`), ou `answer` + `criteria` (rédaction) |
| `case_analysis` | Analyse de cas | pratique | parts | `parts: [{label: "cas", answer}]` |
| `estimate_answer` | Ordre de grandeur | pratique | numeric | `answer` (valeur de référence) : accepté si même ordre de grandeur |
| `recursive_trace` | Trace récursive | pratique | parts | `parts: [{label: "f(n)", answer}]`, (`code`) |

### 3.4 Programmation

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `code_completion` | Complétion de code | pratique | cloze | `code` avec `{{blank}}`, `answers` (variantes : listes) |
| `debugging` | Débogage | pratique | self | `code` (programme défectueux), `answer` (version corrigée) ; affiche les lignes modifiées |
| `code_output` | Résultat de code | pratique | text | `code`, `answer` (sortie attendue) |
| `execution_trace` | Trace d'exécution | pratique | table | `code` (affiché), `table` avec `"?"`, `answer` |
| `refactoring` | Amélioration de code | pratique | self | `code` (avant), `answer` (après) ; contrôle la longueur et l'équilibre des parenthèses |
| `complexity_analysis` | Analyse de complexité | pratique | parts | `parts: [{label: "pire cas", answer: "O(n²)", accepts}]` |

### 3.5 Langues

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `translation` | Traduction | pratique | text | `answer`, (`accepts`), (`source`: texte à traduire) |
| `speaking` | Expression orale | pratique | speak | `answer` (phrase à dire), (`lang`, ex. `en-US`) |
| `pronunciation` | Prononciation | pratique | speak | `answer` (mot à prononcer), (`lang`) |
| `listening` | Compréhension orale | pratique | text | `audio` (texte lu à voix haute), `answer`, (`accepts`), (`lang`) |
| `reading_comprehension` | Compréhension écrite | théorie | choice | `passage`, `answer`, `distractors` (≥ 1), (`why`) |
| `conjugation` | Conjugaison | pratique | parts | `parts: [{label: "je", answer: "suis"}]` |
| `dialogue_completion` | Complétion de dialogue | pratique | cloze | `cloze` multi-lignes avec `{{blank}}`, `answers` |
| `dictation` | Dictée | pratique | text | `audio` (texte lu), (`answer`, sinon = `audio`) ; retour mot à mot |
| `vocabulary_matching` | Association de vocabulaire | théorie | matching | `pairs` (≥ 2) |
| `contextual_vocabulary` | Mot en contexte | théorie | choice | `context` (phrase), `answer`, `distractors` (≥ 1), (`why`) |
| `word_order` | Ordre des mots | pratique | ordering | `steps` (mots dans l'ordre de la phrase, ou `words`) |
| `conversation_roleplay` | Jeu de rôle | théorie | turns | `turns: [{speaker, say, choices, correct, notes}]`, `correct` = indice (à partir de 0), `notes` = explication de chaque mauvais choix |

### 3.6 Sciences humaines et analyse

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `source_analysis` | Analyse de document | pratique | self | `source` (texte du document), `sections: [{label, answer, evaluation?, criteria?}]` ou `answer` |
| `historical_comparison` | Comparaison historique | pratique | self | `sections: [{label, answer}]` ou `answer` |
| `scientific_calculation` | Calcul scientifique | pratique | numeric | `answer` ou `template`, (`unit`), (`sigfigs`), (`requireUnit`), (`formula`), (`tolerance`) : défaut 0,5 % |
| `data_analysis` | Interprétation de données | pratique | self | `data` (tableau affiché), `sections` ou `answer` |

### 3.7 Dessin, graphes et divers

| Identifiant | Libellé | Cat. | Vue | Données |
|---|---|---|---|---|
| `graph_builder` | Graphe à construire | pratique | text | `answer` : arêtes `A-B, B-C` ; (`directed: true` pour `A>B`), (`vertices`) |
| `geometry_canvas` | Dessin géométrique | pratique | parts | `vertices: {A: [x, y], …}` ; la figure s'affiche après correction |
| `block_programming` | Programme par blocs | théorie | ordering | `blocks` (ou `steps`) dans l'ordre d'exécution |
| `odd_one_out` | Intrus | théorie | choice | `answer` (l'intrus), `distractors` (≥ 2), (`why`: explication par mauvais choix) |
| `table_completion` | Tableau à compléter | pratique | table | `table` avec `"?"`, `answer` (tableau complet) |

---

## 4. Règles de correction

### Correction automatique

- **Réponse courte, traduction, texte à trous** : comparaison insensible à la casse, aux accents et aux espaces. Plusieurs variantes possibles : `accepts`, ou une liste de variantes pour un trou (`answers: [["x * x", "x**2"]]`).
- **Dictée** : comparaison plus souple, sans ponctuation ni majuscules.
- **Expressions mathématiques** : deux expressions sont égales si elles prennent les mêmes valeurs pour toutes les variables (testé en plusieurs points). Donc `3+2x` = `2x+3`. La multiplication implicite est acceptée (`2x`). Pour une équation, les deux membres sont comparés (`x=4` = `4=x`).
- **Calcul numérique** : tolérance d'une unité de la dernière décimale par défaut, ou `tolerance: {abs}` / `{rel}`. Pour `range`, toute valeur de l'intervalle est acceptée.
- **Ordre de grandeur** : accepté si la valeur a le même ordre de grandeur (à un facteur 3 près).
- **Intervalles** : `[a;b[`, `]a;b[`, `(a;b)`, `]-∞;2]`, union avec `∪` ou `U`, `ℝ` acceptés. L'ordre des intervalles n'importe pas.
- **Équations** : l'ensemble des solutions est comparé, sans ordre. Séparateurs : `;`, `ou`, `|`, ou la virgule si aucun point-virgule.
- **Coordonnées et vecteurs** : `(x ; y)`. Le point-virgule est le séparateur préféré (évite la confusion avec la virgule décimale). Sans lui, la virgule ne sépare que si elle donne exactement le bon nombre de composantes.
- **Circuits logiques** : table de vérité complète. Syntaxe : variables, `0`, `1`, `!` ou `¬` (non), `&` ou `∧` (et), `|` ou `∨` (ou), `^` ou `⊕` (ou exclusif). Priorité : `¬` puis `∧`, puis `∨` et `⊕` de gauche à droite. Des parenthèses lèvent tout doute.
- **Graphes** : ensemble des arêtes, sans ordre (sauf si `directed`).
- **Tableaux** : chaque case `"?"` est comparée à la valeur attendue (nombre ou texte).
- **Résultat de code** : sortie comparée ligne à ligne, espaces superflus et lignes vides ignorés.
- **Notions (grille `evaluation`)** : voir §2bis.
- **Mots et lignes** : la dictée et les traductions signalent les mots manquants ou en trop. La dictée n'ignore que la casse, les accents et la ponctuation : une faute d'orthographe est une erreur.
- **Prononciation et expression orale** : voir section 7.

### Auto-évaluation

Pour les rédactions, le code et les cartes, l'application ne peut pas juger le fond. L'élève écrit (si l'exercice le demande), peut lancer « Vérifier mes notions » pour cocher la grille automatiquement, révèle le corrigé, puis se note : **Raté**, **Presque** ou **Compris**. La note suggérée (en surbrillance) vient de la grille. Une réponse « Presque » compte comme réussie pour l'espacement des révisions, « Raté » comme échec.

### Une seule tentative

Une bonne réponse valide l'exercice. Une mauvaise réponse est affichée avec la bonne réponse et l'explication, puis la question revient en fin de session, comme pour les autres formats.

---

## 5. Architecture

```
engine/
  grading.js      Fonctions de correction pures (sans React) : expressions, intervalles,
                  n-uplets, équations, graphes, logique, tableaux, similarité orale.
  formats.js      Registre des formats : label, catégorie, vue, données requises, constructeur.
  template.js     Gabarits numériques (valeurs tirées à chaque affichage), évaluation d'expressions.
  mastery.js      Maîtrise et certification. PRACTICE_FORMATS vient du registre.
  selection.js    Choix des questions.
components/
  Activity.jsx    Une vue par type d'interaction (choice, cloze, parts, table, self, speak…).
  Session.jsx     Déroulement d'une session : tirage du format, correction, explication.
docs/
  exemples_formats.json   Un exercice par format, hors de data/ (modèle et jeu de test).
```

### Ajouter un format

1. Ajouter une entrée dans `SPECS` (`engine/formats.js`) : `label`, `kind`, `view`, `needs(q)`, `build(q, base, ctx)`.
2. Si aucune vue existante ne convient, ajouter un `case` dans `components/Activity.jsx` et un composant.
3. Ajouter un exemple dans `docs/exemples_formats.json` et un cas dans `tests/`.
4. Documenter les données dans ce README.

`needs(q)` doit renvoyer `false` plutôt que lever une erreur : une question incomplète doit simplement ne pas proposer le format.

### Vues

Chaque vue reçoit l'exercice construit et appelle `onResult(ok, qualité)` une seule fois. La qualité suit l'échelle SM-2 utilisée partout : 4 pour une bonne réponse, 1 pour une mauvaise, 3 et 5 pour les auto-évaluations « Presque » et « Compris ».

---

## 6. Tests

Les règles de correction et le registre sont testés sans navigateur, depuis la racine du projet :

```bash
node --experimental-default-type=module tests/formats.test.mjs
```

Le jeu de test vérifie, pour chaque format : la construction de l'exercice, l'acceptation d'une bonne réponse, le refus d'une mauvaise, et la présence d'un exemple. Il contrôle aussi que les formats sans données ne sont pas proposés.

Le rendu de toutes les vues est vérifié en rendu serveur (React `renderToStaticMarkup`) sur les 63 exemples, à l'état initial et corrigé.

---

## 7. Limites connues

- **Correction par notions** : elle repère la présence de termes, pas leur justesse. Une phrase qui reprend les bons mots sans raisonnement passera. Les notions `forbidden` aident à écarter les affirmations fausses courantes.
- **Étapes de calcul** : la forme écrite est exigée. Un élève qui écrit correctement mais dans une forme différente de celle du corrigé sera refusé ; le retour indique l’étape concernée.
- **Parenthèses dans les étapes** : `5(x+6)` et `5x+30` sont des formes différentes. Les étapes doivent être écrites dans la même forme que le corrigé.
- **Code** : non exécuté. Seules des règles simples sont contrôlées (équilibre, nom de fonction, longueur).
- **Contre-exemples** : seules les hypothèses et conclusions qui s'écrivent en comparaisons numériques sont vérifiées automatiquement.

Ces formats sont fonctionnels, mais leur forme est volontairement simple. Une version plus riche demanderait un vrai éditeur graphique ou un service externe.

- **Dessin géométrique** : l'élève saisit les coordonnées des sommets, il ne trace pas la figure. La figure correcte s'affiche après correction.
- **Graphe à construire** : saisie textuelle des arêtes, pas de dessin interactif.
- **Circuit logique** : l'élève complète la table de vérité, il ne construit pas le schéma des portes.
- **Arbre de probabilité** : les chemins sont saisis un par un, sans schéma en arbre.
- **Programme par blocs** : ordre de blocs à remettre en place, sans glisser-déposer libre.
- **Expression orale et prononciation** : utilisent la reconnaissance vocale du navigateur (Chrome, Edge, Safari récents). Sans elle, l'exercice devient une auto-évaluation face au modèle. La correspondance est une similarité de texte, pas une analyse phonétique.
- **Compréhension orale et dictée** : utilisent la synthèse vocale du navigateur. Le son dépend des voix installées sur l'appareil.
- **Jeu de rôle** : dialogue scripté avec des réponses à choisir. Il n'y a pas de conversation libre.
- **Vecteurs** : saisie des coordonnées, pas de représentation graphique.
- **Multiplication implicite** : `2x` est lu `2*x`, mais `xy` est une seule variable. Écrire `x*y`.
- **Réponses ouvertes** (rédaction, code, démonstration) : auto-évaluées, jamais corrigées automatiquement.

---

## 8. Journal des modifications

### Nouveaux formats

Ajout de 55 formats à la liste existante, soit 63 au total. Voir le catalogue en section 3.

Libellés corrigés par rapport à la liste de départ : « Trace executive » devient **Trace d'exécution** ; « Réponse en intervale » devient **Réponse en intervalle** ; « Matrice de Confusion » devient **Matrice de confusion** ; « Déboggage » devient **Débogage**. Les formats `data_analysis` et `block_programming` n'avaient pas de libellé : **Interprétation de données** et **Programme par blocs** leur ont été attribués.

### Changements techniques

- `engine/formats.js` : remplacé par un registre. `FORMAT_LABELS`, `availableFormats`, `buildExercise`, `explainOf`, `EXPLAIN_LEVELS` et `explanationFor` restent exportés avec la même signature.
- `engine/grading.js` : nouveau, fonctions de correction pures.
- `components/Activity.jsx` : réécrit autour des vues. `normalize` reste exporté.
- `components/Session.jsx` : la bonne réponse affichée vient de `ex.reveal`, préparé par chaque format.
- `engine/mastery.js` : `PRACTICE_FORMATS` est désormais calculé à partir du registre, et non plus fixé à `fill_blank`, `ordering`, `numeric`.
- `ordering` : la correction travaille avec les indices, ce qui permet des étapes identiques.
- `numeric` : la tolérance tient compte du nombre de décimales de la réponse. Pour `3,25`, la tolérance est de 0,001 (un dixième de la dernière décimale), donc `3,3` est refusé. Auparavant, toute réponse était comparée avec une tolérance de 0,1, quel que soit le nombre de décimales.

### Version 3 : corrections détaillées

- Tous les formats renvoient une correction détaillée (`check(valeur)` → `{ ok, items }`) : notions manquantes, étapes justes, cases fausses, unités, différences mot à mot ou ligne à ligne, explication de chaque mauvais choix.
- Grille de notions (`evaluation`) : correction en mots entiers, avec pluriel et féminin, et groupes facultatifs (`optional`). Remplace la recherche de sous-chaînes.
- Auto-évaluation : grille cochée automatiquement, note suggérée, diff de la correction (débogage, amélioration de code).
- Nouvelle vue `justify` pour les réponses avec justification.
- Gabarits de calcul (`variables`, `expected`, `steps`, `requireSteps`), avec comparaison de la forme écrite pour les étapes.
- Unités avec conversion, chiffres significatifs, pourcentages.
- Contre-exemples vérifiés, équations vérifiées, logique en mode « écrire l’expression ».
- Correction du bug des parenthèses dans les valeurs négatives (`x^2` avec x = -3 devenait `-3^2`).
- Retirée : la fonction `generateCalculation`, non utilisée, remplacée par `buildCalculation`.

### Points à décider

- **Badge « Polyvalent »** (`formats_all`) : il exige désormais les 63 formats. Il est pratiquement inatteignable. Les badges `formats_1` à `formats_5` ne posent pas de problème. Il faudrait peut-être compter seulement les formats présents dans les données.
- **Catégorie des formats** : `kind` est mon choix (section 1). Un format passé en `practice` rend la certification plus exigeante pour les questions qui le proposent.
- **Aucune question n'utilise encore les nouveaux formats** : ils ne seront visibles qu'après ajout dans `formats` des questions concernées.

---

## 9. Progression, niveau, Streaks et cours (version 4)

### Règles de réussite (pourcentages honnêtes)

- Une réponse **vérifiée** par le système compte selon sa qualité (`valueOfAnswer`).
- Une **auto-évaluation** est plafonnée : « Compris » vaut 0,6 et « Presque » 0,3. Elle ne compte ni pour un jour réussi (certification) ni pour un cours, et rapporte 40 % des XP.
- Un **cours** est acquis à hauteur de ses questions : une question est acquise après deux réussites vérifiées récentes (score ≥ 80 %). Le pourcentage est « questions acquises / questions du cours ».
- Les notions consultées (« Lue ») ne changent plus le pourcentage.
- Les données antérieures sont migrées une fois (`migrateIntegrity`) : notions lues effacées, auto-évaluations passées plafonnées. Les réponses vérifiées sont conservées.

### Niveau logarithmique

Le niveau global suit `T(L) = 100 × (1,3^(L−1) − 1) / 0,3` XP totaux (`engine/levels.js`). Chaque niveau coûte 30 % de plus que le précédent. L'en-tête affiche le niveau, le pourcentage parcouru dans le niveau et les XP restants avant le suivant.

### Rubrique Streaks

- Série de jours consécutifs, record, semaines régulières, jours actifs.
- Grille des 12 dernières semaines : une ligne par matière, une case par jour, colorée selon le nombre de réponses.
- Tableau par période (semaine, mois, année, depuis le début) : nombre de questions, taux de réussite et **progression** (gain moyen de maîtrise sur les compétences travaillées pendant la période, depuis son début). Le journal par matière (`progress.journal`) est reconstruit depuis l'historique pour les données anciennes.

### Réinitialisation

Succès → « Reset total » (double confirmation, saisie de `RESET`). Efface connaissances, récompenses, XP, niveau, historique, profil et réglages.

### Contenus de cours (12 onglets)

Chaque section peut porter un objet `lenses` :

```json
"lenses": {
  "summary": ["paragraphe…"],
  "examples": [{ "title": "…", "text": "…", "solution": "…" }],
  "visual": { "caption": "…", "svg": "<svg …>…</svg>", "text": "schéma en texte" },
  "step_by_step": [{ "title": "…", "text": "…" }],
  "simplified": "…",
  "detailed": ["…"],
  "comparison": { "headers": ["…"], "rows": [["…", "…"]] },
  "mnemonics": [{ "trick": "…", "text": "…" }],
  "case_studies": [{ "title": "…", "situation": "…", "question": "…", "solution": "…" }],
  "teach_back": { "prompt": "…", "model": "…" },
  "mistakes": [{ "wrong": "…", "right": "…", "why": "…" }]
}
```

Sans `lenses`, l'onglet affiche un repli honnête : le résumé reprend les notions, l'explication détaillée le texte du cours, la version simplifiée les analogies ; les autres onglets indiquent que le contenu n'est pas encore rédigé. Le texte accepte `[[notion]]` (mis en gras). La section « Dire bonjour et au revoir » du cours d'anglais sert d'exemple complet.

### Limites

- Une auto-évaluation complète ne valide jamais un cours : pour les rédactions, la réussite vérifiée passe par la grille automatique (notions, unités, étapes…).
- Les données antérieures aux règles v4 restent en l'état pour les réponses vérifiées : un élève qui a beaucoup répondu avant la migration conserve ces réponses.
- Les progressions de la rubrique Streaks sont approximatives pour les compétences dont l'historique dépasse 40 points (ancien historique tronqué).
