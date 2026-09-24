import { useEffect, useState } from "react";
import { defaultAcademicCatalog } from "../data/academicCatalog";
import { settingsApi } from "../lib/api";

function mergeCatalog(remoteCatalog) {
  const fallback = defaultAcademicCatalog();
  const remoteFaculties = Array.isArray(remoteCatalog?.faculties) ? remoteCatalog.faculties : [];

  return {
    faculties: remoteFaculties.map((remoteFaculty) => {
      const fallbackFaculty = fallback.faculties.find((item) => item.name === remoteFaculty.name);
      return {
        ...remoteFaculty,
        departments: (remoteFaculty.departments || []).map((remoteDepartment) => {
          const fallbackDepartment = fallbackFaculty?.departments.find(
            (item) => item.name === remoteDepartment.name
          );
          const programs = Array.isArray(remoteDepartment.programs)
            ? remoteDepartment.programs
            : fallbackDepartment?.programs || [];
          return { ...remoteDepartment, programs };
        }),
      };
    }),
  };
}

export function useAcademicCatalog() {
  const [catalog, setCatalog] = useState(defaultAcademicCatalog);

  useEffect(() => {
    let alive = true;
    settingsApi.get("academicCatalog").then(({ value }) => {
      if (alive && value?.faculties?.length) setCatalog(mergeCatalog(value));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const faculties = catalog.faculties || [];
  const departmentsFor = (facultyName) => faculties.find((faculty) => faculty.name === facultyName)?.departments?.map((department) => department.name) || [];
  const programsFor = (departmentName) => faculties.flatMap((faculty) => faculty.departments || []).find((department) => department.name === departmentName)?.programs || [];
  const programsForFaculty = (facultyName) => {
    const faculty = faculties.find((item) => item.name === facultyName);
    return [...new Set((faculty?.departments || []).flatMap((department) => department.programs || []))].sort();
  };
  const departmentForProgram = (programName, facultyName) => {
    const facultyList = facultyName
      ? faculties.filter((faculty) => faculty.name === facultyName)
      : faculties;
    return facultyList
      .flatMap((faculty) => faculty.departments || [])
      .find((department) => (department.programs || []).includes(programName))?.name || "";
  };
  return { faculties, departmentsFor, programsFor, programsForFaculty, departmentForProgram };
}
