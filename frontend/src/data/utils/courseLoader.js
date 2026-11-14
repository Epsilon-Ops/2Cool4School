// Cours : chaque fichier JSON du dossier data/courses/ est un cours.
const modules = import.meta.glob('../courses/**/*.json', { eager: true, import: 'default' });

export const courses = Object.values(modules);
