// Faculty -> Department mapping used to drive the cascading selects on the
// "Complete your profile" page. Keep this as the single source of truth so
// admin screens / filters can reuse it later if needed.
export const FACULTIES = [
  { name: "Faculty of Agriculture", departments: ["Agricultural Economics", "Agricultural Extension and Rural Sociology", "Animal Science", "Crop Protection / Crop Science / Soil Science", "Fisheries, Aquaculture and Wildlife"] },
  { name: "Faculty of Arts", departments: ["English and Literary Studies", "Linguistics and African Languages", "History and Diplomatic Studies", "Islamic Studies", "Christian Religious Studies", "Arabic Studies", "Theatre Arts", "Philosophy"] },
  { name: "Faculty of Education", departments: ["Arts and Social Science Education", "Science and Environmental Education", "Educational Foundations", "Educational Management"] },
  { name: "Faculty of Engineering", departments: ["Chemical Engineering", "Civil Engineering", "Electrical/Electronic Engineering", "Mechanical Engineering"] },
  { name: "Faculty of Environmental Sciences", departments: ["Geography and Environmental Management", "Estate Management and Urban & Regional Planning", "Architecture"] },
  { name: "Faculty of Law", departments: ["Public Law", "Private and Property Law", "Jurisprudence and International Law"] },
  { name: "Faculty of Management Sciences", departments: ["Accounting", "Business Administration (Management)", "Banking and Finance", "Public Administration"] },
  { name: "Faculty of Science", departments: ["Biological Sciences / Biology", "Biochemistry", "Chemistry", "Computer Science", "Mathematics", "Physics", "Statistics", "Microbiology"] },
  { name: "Faculty of Social Sciences", departments: ["Economics", "Political Science", "Sociology", "Library and Information Science", "Psychology"] },
  { name: "Faculty of Veterinary Medicine", departments: ["Veterinary Medicine"] },
  { name: "College of Health Sciences", departments: ["Human Medicine (Medicine & Surgery)", "Community Medicine", "Internal Medicine", "Human Physiology", "Pharmacology & Therapeutics"] },
  { name: "Faculty of Pharmaceutical Sciences", departments: ["Pharmaceutical Sciences"] },
  { name: "Faculty of Geography and Atmospheric Sciences", departments: ["Geography and Atmospheric Sciences"] },
  { name: "Faculty of Communication and Medical Studies", departments: ["Communication and Medical Studies"] },
];

export function departmentsFor(facultyName) {
  return FACULTIES.find((f) => f.name === facultyName)?.departments ?? [];
}

/** Canonical academic levels — single source of truth for students & Course Reps */
export const LEVELS = [
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500 Level",
  "Postgraduate",
];

