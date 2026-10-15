/** Shared options and field lists for the Academics admin forms. */
export const NG_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];export const INST_TYPES = [["Degree", "University (degree)"], ["ND", "Polytechnic / monotechnic (ND)"], ["NCE", "College of education (NCE)"], ["Other", "Other"]];
export const OWNERSHIP = ["Federal", "State", "Private"];

export const institutionFields = [
  { name: "name", label: "Official name", required: true, minLength: 3, maxLength: 200, wide: true, placeholder: "University of Abuja" },
  { name: "displayName", label: "Short display name", maxLength: 200, placeholder: "UniAbuja" },
  { name: "abbreviation", label: "JAMB abbreviation", maxLength: 40, placeholder: "ABUJA" },
  { name: "type", label: "Type", type: "select", options: INST_TYPES, required: true },
  { name: "ownership", label: "Ownership", type: "select", options: OWNERSHIP },
  { name: "state", label: "State", type: "select", options: NG_STATES },
  { name: "category", label: "Category", maxLength: 120, placeholder: "FEDERAL UNIVERSITIES" },
];

export const courseFields = [
  { name: "code", label: "Code", required: true, maxLength: 12, placeholder: "CSC 201", pattern: /^[A-Za-z]{2,5}\s?-?\d{3}[A-Za-z]?$/, patternMessage: "Use a code like CSC 201" },
  { name: "title", label: "Title", required: true, minLength: 3, maxLength: 200, placeholder: "Computer Programming I" },
  { name: "units", label: "Units", type: "number", min: 0, max: 30, placeholder: "3" },
  { name: "level", label: "Level", maxLength: 30, placeholder: "200 Level" },
  { name: "semester", label: "Semester", type: "select", options: [["1st", "First"], ["2nd", "Second"]] },
  { name: "category", label: "Tier", type: "select", options: [["Degree", "Degree"], ["ND", "ND / HND"], ["NCE", "NCE"]] },
  { name: "description", label: "Description", type: "textarea", maxLength: 2000 },
];
