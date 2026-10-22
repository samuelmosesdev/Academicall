import { useCallback, useEffect, useState } from "react";
import { defaultAcademicCatalog } from "../data/academicCatalog";
import { institutionsApi, settingsApi } from "../lib/api";

const UOFA_ID = "uofa";
const treeCatalogCache = new Map();

function catalogFromTree(tree) {
  return {
    faculties: (tree?.faculties || []).map((faculty) => ({
      name: faculty.name,
      departments: (faculty.departments || []).map((department) => ({
        name: department.name,
        programs: (department.programs || []).map((program) => program.name),
      })),
    })),
  };
}

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

export function useAcademicCatalog(institutionId) {
  const instId = institutionId && institutionId !== UOFA_ID ? String(institutionId) : UOFA_ID;
  const [state, setState] = useState(() => ({
    catalog: instId === UOFA_ID ? defaultAcademicCatalog() : treeCatalogCache.get(instId) || { faculties: [] },
    loading: instId !== UOFA_ID && !treeCatalogCache.has(instId),
    error: "",
  }));

  useEffect(() => {
    let alive = true;
    if (instId === UOFA_ID) {
      setState({ catalog: defaultAcademicCatalog(), loading: true, error: "" });
      settingsApi.get("academicCatalog").then(({ value }) => {
        if (alive) setState({
          catalog: value?.faculties?.length ? mergeCatalog(value) : defaultAcademicCatalog(),
          loading: false,
          error: "",
        });
      }).catch((err) => {
        if (alive) setState({ catalog: defaultAcademicCatalog(), loading: false, error: err.message || "Couldn't load the academic catalog." });
      });
    } else if (treeCatalogCache.has(instId)) {
      setState({ catalog: treeCatalogCache.get(instId), loading: false, error: "" });
    } else {
      setState({ catalog: { faculties: [] }, loading: true, error: "" });
      institutionsApi.tree(instId).then((tree) => {
        const catalog = catalogFromTree(tree);
        treeCatalogCache.set(instId, catalog);
        if (alive) setState({ catalog, loading: false, error: "" });
      }).catch((err) => {
        if (alive) setState({ catalog: { faculties: [] }, loading: false, error: err.message || "Couldn't load this institution's academic catalog." });
      });
    }
    return () => { alive = false; };
  }, [instId]);

  const { catalog, loading, error } = state;
  const faculties = catalog.faculties;
  const departmentsFor = useCallback(
    (facultyName) => faculties.find((faculty) => faculty.name === facultyName)?.departments?.map((department) => department.name) || [],
    [faculties]
  );
  const programsFor = useCallback(
    (departmentName, facultyName) => (facultyName ? faculties.filter((faculty) => faculty.name === facultyName) : faculties)
      .flatMap((faculty) => faculty.departments || [])
      .find((department) => department.name === departmentName)?.programs || [],
    [faculties]
  );
  const programsForFaculty = useCallback((facultyName) => {
    const faculty = faculties.find((item) => item.name === facultyName);
    return [...new Set((faculty?.departments || []).flatMap((department) => department.programs || []))].sort();
  }, [faculties]);
  const departmentForProgram = useCallback((programName, facultyName) => {
    const facultyList = facultyName
      ? faculties.filter((faculty) => faculty.name === facultyName)
      : faculties;
    return facultyList
      .flatMap((faculty) => faculty.departments || [])
      .find((department) => (department.programs || []).includes(programName))?.name || "";
  }, [faculties]);
  return { faculties, departmentsFor, programsFor, programsForFaculty, departmentForProgram, loading, error };
}
