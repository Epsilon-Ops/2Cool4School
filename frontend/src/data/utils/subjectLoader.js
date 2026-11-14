
import subjectIndex from "./subject_index.json";

const subjectFiles = import.meta.glob(
  "../subjects/*/*/subject.json",
  {
    eager: true,
    import: "default"
  }
);

const skillFiles = import.meta.glob(
  "../subjects/*/*/skills.json",
  {
    eager: true,
    import: "default"
  }
);

const questionFiles = import.meta.glob(
  "../subjects/**/*.json",
  {
    eager: true,
    import: "default"
  }
);

export const subjects = subjectIndex.subjects.map((entry) => {
  const metadata = subjectFiles[entry.path];
  const skillsData = skillFiles[entry.skillsPath];

  const questions = Object.entries(questionFiles)
    .filter(([path]) => {
      return (
        path.startsWith(entry.questionDirectory) &&
        !path.endsWith("/subject.json") &&
        !path.endsWith("/skills.json")
      );
    })
    .flatMap(([, data]) => {
      // Accepte un tableau de questions ou un objet { questions: [] }
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.questions)) return data.questions;
      return [];
    });

  // Les brouillons (« draft: true ») restent dans les fichiers mais ne sont jamais proposés.
  return {
    ...entry,
    ...metadata,
    skills: skillsData?.skills ?? [],
    questions: questions.filter((q) => q.draft !== true)
  };
});

// Banque globale de questions
export const questionBank = subjects.flatMap((subject) =>
  subject.questions.map((question) => ({
    ...question,
    subjectId: subject.id
  }))
);

export function getSubject(subjectId) {
  return subjects.find((subject) => subject.id === subjectId);
}

export function getQuestions(subjectId) {
  return getSubject(subjectId)?.questions ?? [];
}

export function getSkills(subjectId) {
  return getSubject(subjectId)?.skills ?? [];
}
