import type {PipelineRun, TestCase} from "@/types";

export const validCer = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export function minimumCer(values: (number | null | undefined)[]) {
  const eligible = values.filter(validCer);
  const minimum = eligible.length ? Math.min(...eligible) : null;
  return {minimum, tied: minimum !== null && eligible.filter(v => Math.abs(v - minimum) <= 1e-10).length > 1};
}
export const latestTestRun = (test: TestCase, id: string): PipelineRun | undefined => [...test.runs].reverse().find(run => run.pipeline_id === id);
export function testMinimumCer(test: TestCase, ids: string[]) {
  return minimumCer(ids.map(id => {const run = latestTestRun(test, id); return run?.status === "success" ? run.metrics?.cer : null;}));
}
export const isMinimumCer = (value: number | null | undefined, minimum: number | null) => validCer(value) && minimum !== null && Math.abs(value - minimum) <= 1e-10;
export function BestCerBadge({tied, type = false}: {tied: boolean; type?: boolean}) {
  return <span className="comparison-best-badge">{tied ? type ? "ร่วมต่ำสุด" : "ร่วมดีที่สุด" : type ? "CER ต่ำสุด" : "ดีที่สุดในเอกสารนี้"}</span>;
}
