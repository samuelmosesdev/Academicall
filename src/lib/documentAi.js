/** Lightweight document AI helpers (no external API required) */

export function titleFromFilename(fileName = "") {
  let base = String(fileName).replace(/\.[^.]+$/, "");
  base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  // Title Case-ish
  base = base
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
  return base || "Untitled material";
}

export function suggestTags(course) {
  if (!course) return [];
  const tags = [];
  if (course.code) tags.push(course.code);
  if (course.level) tags.push(course.level);
  if (course.faculty) tags.push(course.faculty);
  if (course.department) tags.push(course.department);
  if (course.semester) tags.push(course.semester);
  return tags.filter(Boolean);
}

export function suggestDescription(course, title) {
  const code = course?.code || "this course";
  const t = title || "Material";
  return `${t} for ${code}${course?.title ? ` — ${course.title}` : ""}. Uploaded for student revision on UofA Readers.`;
}
