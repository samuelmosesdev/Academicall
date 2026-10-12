import { FACULTIES } from "./facultyData";

/**
 * Department → Program(s) mapping.
 * Keys MUST match department names in facultyData.js exactly.
 * Every department listed under FACULTIES has at least one program.
 */
const PROGRAMS_BY_DEPARTMENT_DATA = {
  // Agriculture
  "Agricultural Economics": ["Agriculture (B.Agric)"],
  "Agricultural Extension and Rural Sociology": [
    "Agriculture (B.Agric)",
    "Agricultural Science & Education",
  ],
  "Animal Science": ["Animal Science"],
  "Crop Protection / Crop Science / Soil Science": ["Agriculture (B.Agric)"],
  "Fisheries, Aquaculture and Wildlife": ["Fisheries, Aquaculture and Wildlife"],

  // Arts
  "English and Literary Studies": [
    "English Language",
    "English Literature/Literature in English",
  ],
  "Linguistics and African Languages": ["Linguistics"],
  "History and Diplomatic Studies": ["History and Diplomatic Studies"],
  "Islamic Studies": ["Islamic Studies"],
  "Christian Religious Studies": ["Christian Religious Studies"],
  "Arabic Studies": ["Arabic Studies"],
  "Theatre Arts": ["Theatre Arts / Drama"],
  Philosophy: ["Philosophy"],

  // Education
  "Arts and Social Science Education": [
    "Education & Arabic",
    "Education & Economics",
    "Education & English Language",
    "Education & English Literature",
    "Education & Geography",
    "Education & History",
    "Education & Islamic Studies",
    "Education & Social Studies",
  ],
  "Science and Environmental Education": [
    "Education & Biology",
    "Education & Chemistry",
    "Education & Integrated Science",
    "Education & Mathematics",
    "Education & Physics",
    "Environmental Education",
  ],
  "Educational Foundations": ["Guidance & Counselling", "Primary Education Studies"],
  "Educational Management": ["Educational Management & Planning"],

  // Engineering
  "Chemical Engineering": ["Chemical Engineering"],
  "Civil Engineering": ["Civil Engineering"],
  "Electrical/Electronic Engineering": ["Electrical/Electronic Engineering"],
  "Mechanical Engineering": ["Mechanical Engineering"],

  // Environmental Sciences
  "Geography and Environmental Management": ["Geography"],
  "Estate Management and Urban & Regional Planning": [
    "Estate Management",
    "Urban & Regional Planning",
  ],
  Architecture: ["Architecture"],

  // Law — each department shares the LL.B programme (correct academically)
  "Public Law": ["Law (LL.B)"],
  "Private and Property Law": ["Law (LL.B)"],
  "Jurisprudence and International Law": ["Law (LL.B)"],

  // Management Sciences
  Accounting: ["Accounting"],
  "Business Administration (Management)": ["Business Administration"],
  "Banking and Finance": ["Banking & Finance"],
  "Public Administration": ["Public Administration"],

  // Science
  "Biological Sciences / Biology": ["Biology (B.Sc.)"],
  Biochemistry: ["Biochemistry (B.Sc.)"],
  Chemistry: ["Chemistry (B.Sc.)"],
  "Computer Science": ["Computer Science (B.Sc.)"],
  Mathematics: ["Mathematics (B.Sc.)"],
  Physics: ["Physics (B.Sc.)"],
  Statistics: ["Statistics (B.Sc.)"],
  Microbiology: ["Microbiology (B.Sc.)"],

  // Social Sciences
  Economics: ["Economics"],
  "Political Science": [
    "Political Science",
    "Political Science & International Relations",
  ],
  Sociology: ["Sociology"],
  "Library and Information Science": ["Library & Information Science"],
  Psychology: ["Psychology"],

  // Veterinary
  "Veterinary Medicine": ["Veterinary Medicine (DVM)"],

  // Health Sciences
  "Human Medicine (Medicine & Surgery)": ["Medicine & Surgery (MBBS)"],
  "Community Medicine": ["Medicine & Surgery (MBBS)"],
  "Internal Medicine": ["Medicine & Surgery (MBBS)"],
  "Human Physiology": ["Medicine & Surgery (MBBS)"],
  "Pharmacology & Therapeutics": ["Medicine & Surgery (MBBS)"],

  // Pharmacy
  "Pharmaceutical Sciences": ["Pharmacy"],

  // Geography & Atmospheric
  "Geography and Atmospheric Sciences": ["Geography", "Atmospheric Sciences"],

  // Communication & Medical Studies
  "Communication and Medical Studies": ["Communication and Medical Studies"],
};

export const PROGRAMS_BY_DEPARTMENT = PROGRAMS_BY_DEPARTMENT_DATA;

export function programsFor(departmentName) {
  return PROGRAMS_BY_DEPARTMENT_DATA[departmentName] || [];
}

/** Full hierarchical catalog: Faculty → Department → Programs */
export function defaultAcademicCatalog() {
  return {
    faculties: FACULTIES.map((faculty) => ({
      name: faculty.name,
      departments: faculty.departments.map((name) => ({
        name,
        programs: programsFor(name),
      })),
    })),
  };
}
