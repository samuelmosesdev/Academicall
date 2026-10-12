function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getAcademicProgram(profile) {
  return String(profile?.program || "").trim();
}

export function getCourseRepProgram(profile) {
  return String(profile?.courseRepMeta?.program || "").trim();
}

export function getAcademicDepartment(profile) {
  return String(
    profile?.courseRepMeta?.department ||
      profile?.department ||
      profile?.courseRepDepartment ||
      ""
  ).trim();
}

export function getAcademicScope(profile) {
  return getAcademicProgram(profile);
}

export function academicScopeValues(profile) {
  const program = getAcademicProgram(profile);
  return program ? [program] : [];
}

export function matchesAcademicProgram(value, program) {
  const normalizedValue = normalize(value);
  return Boolean(normalizedValue && normalize(program) === normalizedValue);
}

export function matchesAcademicScope(value, profile) {
  return matchesAcademicProgram(value, getAcademicProgram(profile));
}
