import type {Comparison,Decision,Identity} from "@/types/comparison";
import type {PipelineConfig} from "@/types";

// Display-only reconciliation. Preserve the engine's ranking, membership and verdicts.
export function currentComparisonNames(data:Comparison,configs:PipelineConfig[]):Comparison {
  const names=new Map(configs.map(p=>[p.pipeline_id,p.name]));
  const rename=<T extends Identity>(p:T):T=>({...p,pipeline_name:names.get(p.pipeline_id)??p.pipeline_name});
  const decision=(d:Decision):Decision=>({...d,ranking:d.ranking.map(rename),cells:d.cells.map(rename),scatter:{...d.scatter,points:d.scatter.points.map(rename)}});
  return {...data,pipelines:data.pipelines.map(rename),overall:decision(data.overall),by_type:data.by_type.map(g=>({...g,decision:decision(g.decision)}))};
}
