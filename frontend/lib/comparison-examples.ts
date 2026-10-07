import type { FieldComparison, PipelineRun, ROI, TestCase } from "@/types";

export type ComparisonExample = { key: string; testCase: TestCase; roi: ROI | null; gt: string; a: PipelineRun; b: PipelineRun; textA: string; textB: string; evaluationA: FieldComparison | null; evaluationB: FieldComparison | null; cerA: number; cerB: number; fieldId?: string };
const latest = (c: TestCase, id: string) => c.runs.filter(r => r.pipeline_id === id).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];

// Compare the same confirmed GT unit. Never pair unrelated detected fields by array position.
export function comparisonExamples(cases: TestCase[], a: string, b: string): ComparisonExample[] {
  if (!a || !b || a === b) return [];
  return cases.flatMap<ComparisonExample>(c => {
    const ra = latest(c,a), rb = latest(c,b);
    if (ra?.status !== "success" || rb?.status !== "success") return [];
    if (c.evaluation_mode !== "per_field" && c.ground_truth_raw !== null && (c.document_gt_confirmed_at || c.status === "confirmed")) {
      const ea = ra.document_evaluation ?? null, eb = rb.document_evaluation ?? null;
      const ca = ea?.cer ?? ra.metrics?.cer, cb = eb?.cer ?? rb.metrics?.cer;
      if (ca == null || cb == null) return [];
      return [{key:c.id,testCase:c,roi:c.roi,gt:c.ground_truth_raw,a:ra,b:rb,textA:ea?.prediction ?? ra.final_text ?? ra.text ?? "",textB:eb?.prediction ?? rb.final_text ?? rb.text ?? "",evaluationA:ea,evaluationB:eb,cerA:ca,cerB:cb}];
    }
    return (c.global_fields ?? []).flatMap(f => {
      if (!f.confirmed_at || f.ground_truth_raw === null) return [];
      const fa = ra.fields?.find(x => x.global_field_id === f.id), fb = rb.fields?.find(x => x.global_field_id === f.id);
      if (!fa || !fb || fa.status === "error" || fb.status === "error" || fa.evaluation?.cer == null || fb.evaluation?.cer == null) return [];
      return [{key:`${c.id}:${f.id}`,fieldId:f.id,testCase:c,roi:f.roi,gt:f.ground_truth_raw,a:ra,b:rb,textA:fa.ocr_text,textB:fb.ocr_text,evaluationA:fa.evaluation,evaluationB:fb.evaluation,cerA:fa.evaluation.cer,cerB:fb.evaluation.cer}];
    });
  });
}
