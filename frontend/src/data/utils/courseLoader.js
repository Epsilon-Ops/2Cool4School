
const modules = import.meta.glob('../courses/**/*.json', {
  eager: true,
  import: 'default'
});

export const courses = Object.entries(modules)
  .filter(([path, data]) => {
    // Un cours doit avoir un identifiant et un titre.
    return (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      typeof data.id === 'string' &&
      typeof data.title === 'string' &&
      Array.isArray(data.sections)
    );
  })
  .map(([path, data]) => ({
    ...data,
    _path: path
  }))
  .sort((a, b) => {
    const subjectCompare = a.subject.localeCompare(b.subject);
    if (subjectCompare !== 0) return subjectCompare;

    return (a.order ?? 0) - (b.order ?? 0);
  });

export function getCourses(subjectId) {
  return courses.filter(course => course.subject === subjectId);
}

export function getCourse(courseId) {
  return courses.find(course => course.id === courseId);
}
