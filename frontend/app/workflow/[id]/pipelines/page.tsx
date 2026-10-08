import WorkflowPage from "@/components/WorkflowPage";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <WorkflowPage key={id+"pipelines"} id={id} stage="pipelines"/>;
}
