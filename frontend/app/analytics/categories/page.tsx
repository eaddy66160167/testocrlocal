import { redirect } from "next/navigation";

export default async function LegacyAnalysis({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const search = await searchParams;
  const params = new URLSearchParams({view:"by-type"});
  for (const key of ["document_type_id","pipeline","date_from","date_to","include_archived"]) {
    const value = search[key];
    if (typeof value === "string" && value) params.set(key,value);
  }
  redirect(`/matrix?${params}`);
}
