# 2Cool4School

Application personnelle d'apprentissage ludique (style Duolingo, mais orientée **pratique et maîtrise réelle**) pour réviser l'informatique et les maths : algorithmique, complexité, réseaux, bases de données, SQL, logique, listes chaînées en C++…

Fonctionne sur PC et téléphone (design responsive).

## Philosophie

- **Tu progresses parce que tu maîtrises**, pas parce que tu as cliqué jusqu'au bout.
- **Une question de cours = plusieurs formats** : la même notion peut être QCM, vrai/faux, flashcard, texte à trous, remise en ordre ou association.
- **La banque de questions est centrale** : tu ajoutes une question dans `src/data/questions.json` et elle devient disponible dans toutes les activités compatibles.
- **Progression par compétence** : un arbre de compétences avec prérequis, un niveau de maîtrise par notion (Découverte → Compréhension → Application → Maîtrise).
- **Répétition espacée** (inspirée de SM-2) : les questions ratées reviennent plus tôt, les réussies plus tard.

## Lancer le projet

Prérequis : Node.js 18+ et npm.

```bash
npm install
npm run dev        # mode développement, puis ouvrir l'URL affichée
npm run build      # génère le dossier dist/ pour la production
npm run preview    # prévisualise le build
```

## Structure

```
src/
├── data/
│   ├── questions.json     # banque centrale de questions (ton contenu pédagogique)
│   └── skills.json        # matières, compétences et prérequis (l'arbre)
├── engine/
│   ├── formats.js         # transforme une question en exercice (QCM, flashcard…)
│   ├── progress.js        # sauvegarde, XP, maîtrise, streak
│   ├── random.js          # mélange et tirage pondéré
│   ├── selection.js       # stratégies d'ordre (aléatoire, pondéré, difficulté…)
│   └── srs.js             # répétition espacée (SM-2 simplifié)
├── components/
│   ├── Activity.jsx       # rendu des différents formats d'exercice
│   ├── Mascot.jsx         # mascotte animée (stretch & squash)
│   ├── SkillTree.jsx      # arbre de compétences
│   └── Session.jsx        # session de questions + feedback + bilan
├── App.jsx
├── main.jsx
└── styles.css             # thème flashy et animations
```

## Ajouter une question

Dans `src/data/questions.json` :

```json
{
  "id": "algo_010",
  "subject": "algorithmique",
  "skill": "algo.recherche",
  "difficulty": 2,
  "prompt": "Quelle est la complexité temporelle d'une recherche dichotomique ?",
  "answer": "O(log n)",
  "distractors": ["O(n)", "O(1)", "O(n²)"],
  "explanation": "À chaque étape, on élimine la moitié des éléments restants.",
  "tags": ["recherche", "complexité"],
  "formats": ["single_choice", "true_false", "flashcard", "fill_blank"],
  "cloze": "La complexité d'une recherche dichotomique est {{blank}}."
}
```

Formats disponibles :

| Format | Champs requis | Description |
|---|---|---|
| `single_choice` | `distractors` | QCM, une bonne réponse |
| `true_false` | `distractors` | Vrai ou faux sur une proposition |
| `flashcard` | – | Recto/verso, auto-évaluation |
| `fill_blank` | `cloze` | Texte à trous (`{{blank}}`) |
| `ordering` | `steps` | Remettre les étapes dans l'ordre |
| `matching` | `pairs` | Associer des termes à leurs définitions |

Le format est choisi au hasard parmi ceux que la question supporte. Si un champ requis manque, le format est ignoré automatiquement.

Pour les formats `ordering` et `matching` :

```json
"steps": ["Étape 1", "Étape 2", "Étape 3"]
"pairs": [["O(1)", "Accès par indice"], ["O(n)", "Parcours linéaire"]]
```

## Ordre des questions

Dans l'écran de l'arbre, tu peux choisir :

- **Pondéré (lacunes)** : les questions ratées ou dues pour révision reviennent davantage.
- **Aléatoire** : tirage complet.
- **Jamais vues** : d'abord les questions que tu n'as pas encore rencontrées.
- **Difficulté croissante** : tirage aléatoire, puis tri du plus facile au plus difficile.

## Progression

- **XP** : gagnés à chaque bonne réponse (plus si la question est difficile).
- **Maîtrise par compétence** : monte avec les bonnes réponses, baisse avec les erreurs.
- **Déblocage** : une compétence s'ouvre quand ses prérequis atteignent 50 % de maîtrise.
- **Streak** : nombre de jours consécutifs d'activité.

Les données sont sauvegardées dans le `localStorage` du navigateur (clé `2cool4school:v1`). Elles restent donc sur l'appareil où tu travailles.

## Feuille de route

- **Phase 1 (fait)** : arbre de compétences, banque JSON, six formats, ordre aléatoire configurable, progression sauvegardée.
- **Phase 2** : boss de compétence (sessions multi-phases), statistiques détaillées, quêtes quotidiennes.
- **Phase 3** : répétition espacée complète (file de révision), examens blancs, simulateur SQL avec SQLite embarqué, visualiseur d'algorithmes.
- **Phase 4** : mode hors-ligne (PWA), import/export des questions, synchronisation entre appareils, scénarios immersifs.

## Mettre le projet sur GitHub

```bash
git init
git add .
git commit -m "Initial commit : 2Cool4School"
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/2Cool4School.git
git push -u origin main
```
