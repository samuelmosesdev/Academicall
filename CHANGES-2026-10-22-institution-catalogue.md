# Institution catalogue fix (2026-10-22)

Complaint: "for UNIJOS, Faculty of Health Sciences is not used, it just says MEDICAL".
Cause: the catalogue came from JAMB IBASS, which groups programmes under JAMB "faculty groups"
(MEDICAL, ADMINISTRATION, ENGINEERING/TECH/ENV …), not real faculties, with ALL-CAPS names, trailing
colons and duplicates. The seeder only inserts, so fixing the data file alone never reached live databases.

## What changed

| File | What |
| --- | --- |
| `Academicall-api/prisma/data/institution-overrides/unijos.json` | Curated University of Jos structure (17 faculties) with sources. Every IBASS programme id is mapped. |
| `Academicall-api/prisma/data/institution-overrides/discipline-rules.json` | The one readable rules table for every other institution: JAMB group → neutral grouping, programme → grouping rules, name clean-up words. |
| `Academicall-api/src/lib/catalogRules.ts` | Pure transform (no DB), shared by the boot pass and the data script. |
| `Academicall-api/src/lib/institutionOverrides.ts` | `applyInstitutionOverrides()` — applies it to the database at boot, keeping every row id. |
| `Academicall-api/scripts/clean-institutions-data.ts` | Rewrites `prisma/data/institutions.json.gz` with the same transform (fresh installs). Already run. |
| `Academicall-api/src/server.ts`, `src/scripts/seedInstitutions.ts` | Call the overrides after `seedInstitutions()` (`--force-overrides` on the script re-applies). |
| `Academicall-api/src/lib/institutionSeed.ts` | `hid()` now lives in catalogRules (re-exported). |
| `Academicall-api/src/lib/curriculumSeed.ts` | Also matches national curricula on the original JAMB programme name / abbreviation (`jamb`, `jambAbbreviation` in the data file, plus the Setting). |
| `Academicall-api/src/controllers/institutions.controller.ts` | Institution search puts an exact abbreviation match first ("UNIJOS" before colleges "affiliated to UNIJOS"). |
| `src/components/AcademicPicker.jsx` | Placeholder departments in a real catalogue (Law, MBBS…) get an accurate hint. |

## How the boot pass behaves
- Versioned: Setting `institutionOverrides` stores a hash of the override files; nothing runs until they change. Editing a JSON file and redeploying re-applies.
- Never deletes. Emptied JAMB groups and placeholder departments are set `active=false` (the public tree already hides inactive rows). Duplicate programmes are deactivated and every reference is pointed at the kept one.
- Carries references: users' faculty/department/programme ids **and** names, course-rep meta, department course assignments, curriculum links, aspirations, general-test audiences, and the name strings on documents, feed posts, class events, department memberships and study groups.
- Leaves alone: the University of Abuja (admin-curated), admin-created institutions and faculties, and departments an admin created or renamed (`derived=false`).

## Adding another curated institution
Copy `unijos.json`, set `institutionId`, list faculties → departments → programmes, and put each existing
programme id in `from` (a second id = a duplicate to merge). Redeploy; then run
`npx ts-node --transpile-only scripts/clean-institutions-data.ts` to refresh the bundled file.
