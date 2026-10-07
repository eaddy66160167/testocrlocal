"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { QueryFilters } from "@/types";

const keys = ["document_type_id", "pipeline", "date_from", "date_to"] as const;
const paths = ["/history", "/analytics/categories"];
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("analytics-scope", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("analytics-scope", listener);
  };
}
function snapshot() { return window.location.search; }
function serverSnapshot() { return ""; }
function read(search: string): QueryFilters {
  const params = new URLSearchParams(search);
  return Object.fromEntries(keys.flatMap(key => params.get(key) ? [[key, params.get(key)!]] : []));
}
export function removeInternalUserFilters() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("category") && !params.has("document")) return;
  params.delete("category");
  params.delete("document");
  window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  window.dispatchEvent(new Event("analytics-scope"));
}
export function analyticsHref(path: string, filters: QueryFilters): string {
  const params = new URLSearchParams();
  for (const key of keys) if (filters[key]) params.set(key, filters[key]!);
  return params.size ? `${path}?${params}` : path;
}
export function useAnalyticsFilters(): [QueryFilters, Dispatch<SetStateAction<QueryFilters>>] {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const filters = useMemo(() => read(search), [search]);
  useEffect(() => { removeInternalUserFilters(); }, [search]);
  const setFilters = useCallback((next: SetStateAction<QueryFilters>) => {
    const value = typeof next === "function" ? next(read(window.location.search)) : next;
    const params = new URLSearchParams(window.location.search);
    params.delete("category");
    params.delete("document");
    for (const key of keys) {
      if (value[key]) params.set(key, String(value[key])); else params.delete(key);
    }
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    window.dispatchEvent(new Event("analytics-scope"));
  }, []);
  return [filters, setFilters];
}
export function useAnalyticsNavigation() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return (path: string, current: string) => paths.includes(path) && paths.includes(current)
    ? analyticsHref(path, read(search)) : path;
}

export function useComparisonDisplay() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const params = new URLSearchParams(search);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    let changed = false;
    for (const key of [...keys, "category", "document", "include_archived", "search"]) {
      if (next.has(key)) { next.delete(key); changed = true; }
    }
    if (changed) {
      window.history.replaceState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}`);
      window.dispatchEvent(new Event("analytics-scope"));
    }
  }, [search]);
  return {
    view: params.get("view") === "by-type" ? "by-type" : "overall",
    includeArchived: params.get("include_archived") === "1",
    update: (key: "view" | "include_archived", value: string) => {
      const next = new URLSearchParams(window.location.search);
      if (value) next.set(key, value); else next.delete(key);
      window.history.replaceState(null, "", `${window.location.pathname}?${next}`);
      window.dispatchEvent(new Event("analytics-scope"));
    },
  };
}
