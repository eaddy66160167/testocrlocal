"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { QueryFilters } from "@/types";

const keys = ["document_type_id", "category", "pipeline", "date_from", "date_to"] as const;
const paths = ["/history", "/matrix", "/analytics/categories"];
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
  return Object.fromEntries([...keys, "document"].flatMap(key => params.get(key) ? [[key, params.get(key)!]] : []));
}
export function analyticsHref(path: string, filters: QueryFilters): string {
  const params = new URLSearchParams();
  for (const key of keys) if (filters[key]) params.set(key, filters[key]!);
  return params.size ? `${path}?${params}` : path;
}
export function useAnalyticsFilters(): [QueryFilters, Dispatch<SetStateAction<QueryFilters>>] {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const filters = useMemo(() => read(search), [search]);
  const setFilters = useCallback((next: SetStateAction<QueryFilters>) => {
    const value = typeof next === "function" ? next(read(window.location.search)) : next;
    const params = new URLSearchParams(window.location.search);
    for (const key of [...keys, "document"] as const) {
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
