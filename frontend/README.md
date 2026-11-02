# 2Cool4School

Application personnelle d'apprentissage ludique, dans l'esprit de Duolingo, mais orientée **pratique et maîtrise réelle** : réviser l'algorithmique, la logique, les réseaux et les bases de données.

Fonctionne sur PC et sur téléphone.

## Philosophie

- **Tu progresses parce que tu maîtrises**, pas parce que tu as cliqué jusqu'au bout.
- **Une question, plusieurs formats** : la même notion peut être un QCM, un vrai/faux, une flashcard, un texte à trous, une remise en ordre ou une association.
- **Parcours par compétence** : chaque matière est un chemin de compétences avec prérequis. Une compétence se débloque quand ses prérequis atteignent 50 % de maîtrise.
- **Répétition espacée** (inspirée de SM-2) : les questions ratées reviennent plus tôt, les réussies plus tard.
- **Erreur = nouvelle chance** : une mauvaise réponse remet la question en fin de session.

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
frontend/src/
├── data/
│   ├── subject_index.json        # liste des matières (chemins vers leurs fichiers)
│   ├── subjectLoader.js          # charge les matières, compétences et questions
│   └── subjects/
│       └── <matiere>/
│           ├── subject.json      # nom, code, emoji, couleur, description
│           ├── skills.json       # compétences et prérequis (le parcours)
│           └── questions/        # une question par fichier de compétence
│               └── <competence>.json
├── engine/
│   ├── formats.js                # transforme une question en exercice
│   ├── progress.js               # sauvegarde, XP, maîtrise, série, statistiques
│   ├── random.js                 # mélange et tirage pondéré
│   ├── selection.js              # ordre des questions et révisions dues
│   └── srs.js                    # répétition espacée (SM-2 simplifié)
├── App.jsx                       # en-tête, navigation entre écrans
├── components/
│   ├── Mascot.jsx                # hibou SVG animé (stretch & squash)
│   ├── SkillTree.jsx             # parcours des compétences, par matière
│   ├── LessonSheet.jsx           # fiche d'une compétence et réglages
│   ├── Session.jsx               # session d'exercices, retour, bilan
│   └── Activity.jsx              # rendu de chaque format d'exercice
└── styles.css                    # thème Duolingo et animations
```

## Matières actuelles

| Code | Matière | Compétences |
|---|---|---|
| LIFAPC | Algorithmique & C++ | complexité, dichotomie, tris, listes chaînées, sentinelles, copie, templates |
| LIFLC | Logique classique | propositions, tables de vérité, implications, prédicats |
| RES | Réseaux | introduction, normes, modèles OSI/TCP-IP, adressage IP, TCP |
| BDD | Bases de données & SQL | modèle relationnel, clés, normalisation, SQL, jointures |

## Ajouter une question

Chaque question est un objet JSON placé dans le fichier de sa compétence, par exemple `src/data/subjects/reseaux/questions/ip.json` :

```json
{
  "id": "reseaux_020",
  "subject": "reseaux",
  "skill": "reseaux.ip",
  "difficulty": 2,
  "prompt": "Combien d'adresses d'hôtes dans un /28 ?",
  "answer": "14",
  "distractors": ["16", "30", "6"],
  "explanation": "Il reste 4 bits pour l'hôte : 2⁴ = 16, moins l'adresse du réseau et celle de diffusion.",
  "tags": ["ip", "masque"],
  "formats": ["single_choice", "true_false", "flashcard", "fill_blank"],
  "cloze": "Un sous-réseau /28 offre {{blank}} adresses d'hôtes."
}
```

Champs :

- `id` : unique dans toute la banque.
- `subject` / `skill` : doivent correspondre à une matière et à une compétence existantes (`skill` s'écrit `matiere.competence`).
- `difficulty` : 1 (facile) à 3 (difficile). Influence les XP gagnés.
- `answer` : la bonne réponse, courte de préférence.
- `distractors` : mauvaises réponses (au moins une), utilisées pour les QCM et les vrai/faux.
- `explanation` : affichée après chaque réponse.
- `formats` : formats que la question sait jouer. Un format dont le champ requis manque est ignoré automatiquement.

Formats disponibles :

| Format | Champs requis | Description |
|---|---|---|
| `single_choice` | `distractors` | QCM, une bonne réponse |
| `true_false` | `distractors` | Vrai ou faux sur une proposition |
| `flashcard` | – | Recto/verso, auto-évaluation (Raté, Moyen, Facile) |
| `fill_blank` | `cloze` | Texte à trous, avec `{{blank}}` à compléter |
| `ordering` | `steps` | Remettre les étapes dans l'ordre |
| `matching` | `pairs` | Associer des éléments de gauche à ceux de droite |

Exemples pour les formats `ordering` et `matching` :

```json
"steps": ["Étape 1", "Étape 2", "Étape 3"]
"pairs": [["O(1)", "Accès par indice"], ["O(n)", "Parcours linéaire"]]
```

Pour ajouter une **compétence**, déclare-la dans `skills.json` de la matière (avec ses `prereq`) et crée le fichier correspondant dans `questions/`. Pour ajouter une **matière**, crée son dossier dans `subjects/` et ajoute-la dans `subject_index.json`.

## Progression

- **XP** : gagnés à chaque bonne réponse, plus la question est difficile, plus ils rapportent.
- **Maîtrise par compétence** : monte avec les bonnes réponses, baisse avec les erreurs. Paliers : Découverte, Compréhension (25 %), Application (50 %), Maîtrise (80 %).
- **Déblocage** : une compétence s'ouvre quand ses prérequis atteignent 50 %.
- **Série** : nombre de jours consécutifs d'activité. Dans une session, la série de bonnes réponses (combo) s'affiche aussi.
- **Révisions** : le bouton « Réviser » regroupe les questions dont la date de rappel est dépassée, toutes matières confondues.

Dans la fiche d'une compétence, tu choisis le nombre de questions (3, 5 ou 10) et l'ordre :

- **Pondéré** : les lacunes et les questions dues reviennent davantage.
- **Aléatoire** : tirage complet.
- **Jamais vues** : d'abord les questions que tu n'as pas encore rencontrées.
- **Croissante** : tirage aléatoire, puis tri du plus facile au plus difficile.

Les données sont sauvegardées dans le `localStorage` du navigateur (clé `2cool4school:v1`). Elles restent donc sur l'appareil où tu travailles.

## Feuille de route

- **Fait** : parcours de compétences façon Duolingo, six formats d'exercice, répétition espacée, révisions globales, combo, statistiques de session, mascotte animée.
- **Prochaine étape** : boss de compétence (session multi-phases), quêtes quotidiennes, examens blancs.
- **Ensuite** : simulateur SQL avec SQLite embarqué, visualiseur d'algorithmes, mode hors-ligne (PWA), import/export des questions.
