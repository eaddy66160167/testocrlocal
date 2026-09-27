"use client";
import { useEffect, useState } from "react";
import { getTestCase } from "@/lib/api";
import type { TestCase } from "@/types";
import LegacyTestingWorkspace from "./LegacyTestingWorkspace";
import WorkflowUpload from "./WorkflowUpload";
import {useRouter} from "next/navigation";
import {resumeStage,workflowUrl} from "./WorkflowSteps";

export default function TestingWorkspace({initialTestCaseId}: {initialTestCaseId?: string}) {
  const router=useRouter();
  const [saved,setSaved]=useState<TestCase | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;const id=initialTestCaseId ?? new URLSearchParams(window.location.search).get("testCase");
    (id ? getTestCase(id) : Promise.resolve(null)).then(c=>{if(active){setSaved(c);if(c?.workflow==="global")router.replace(workflowUrl(c.id,resumeStage(c)));}}).catch(()=>{if(active)setError("โหลดชุดทดสอบไม่ได้ กรุณาลองเปิดอีกครั้ง");}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[initialTestCaseId,router]);
  if(loading)return <p role="status">กำลังโหลดชุดทดสอบ…</p>;
  if(error)return <p role="alert">{error}</p>;
  if(saved && saved.workflow!=="global")return <><div className="notice-banner">ประวัติแบบเดิม — คง ROI, ข้อความ และผลประเมินตามที่บันทึกไว้</div><LegacyTestingWorkspace initialTestCaseId={initialTestCaseId}/></>;
  if(saved)return <p role="status">กำลังเปิดขั้นตอนที่บันทึกไว้…</p>;
  return <WorkflowUpload/>;
}
