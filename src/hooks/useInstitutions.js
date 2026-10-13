import { useEffect, useState } from "react";
import { institutionsApi } from "../lib/api";

const treeCache = new Map();

/** Title-case the official ALL-CAPS JAMB names for display (stored values stay official). */
export function prettyName(name = "") {
  const s = String(name || "");
  if (!s || s !== s.toUpperCase()) return s;
  const small = new Set(["and", "of", "the", "in", "for", "to", "&", "on", "at"]);
  const keep = /^(FCT|ND|NCE|HND|ICT|UNN|ABU|UTME|II|III|IV|B\.?SC|B\.?ED|LL\.?B|OND|USA|UK|AFF|AFFL|AFFIL)\.?,?$/i;
  return s
    .toLowerCase()
    .split(/(\s+|\/|-|\()/)
    .map((w, i) => {
      if (!w.trim() || /^[\s/(-]$/.test(w)) return w;
      if (keep.test(w)) return w.toUpperCase();
      if (i > 0 && small.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

export function institutionLabel(inst) {
  if (!inst) return "";
  return inst.displayName || prettyName(inst.name);
}

export function useInstitutionSearch(query, { enabled = true } = {}) {
  const [state, setState] = useState({ results: [], loading: false, error: "" });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const t = setTimeout(() => {
      institutionsApi
        .search({ q: query.trim(), limit: 30 })
        .then((r) => alive && setState({ results: r.institutions || [], loading: false, error: "" }))
        .catch((err) => alive && setState({ results: [], loading: false, error: err.message || "Couldn't load institutions" }));
    }, query ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, enabled]);
  return state;
}

export function useInstitutionTree(institutionId) {
  const [state, setState] = useState(() => ({ tree: treeCache.get(institutionId) || null, loading: Boolean(institutionId && !treeCache.has(institutionId)), error: "" }));
  useEffect(() => {
    if (!institutionId) {
      setState({ tree: null, loading: false, error: "" });
      return undefined;
    }
    if (treeCache.has(institutionId)) {
      setState({ tree: treeCache.get(institutionId), loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    setState({ tree: null, loading: true, error: "" });
    institutionsApi
      .tree(institutionId)
      .then((tree) => {
        treeCache.set(institutionId, tree);
        if (alive) setState({ tree, loading: false, error: "" });
      })
      .catch((err) => alive && setState({ tree: null, loading: false, error: err.message || "Couldn't load faculties" }));
    return () => {
      alive = false;
    };
  }, [institutionId]);
  return state;
}
