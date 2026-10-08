import {test,expect} from "@playwright/test";
import {splitDocumentGT,joinFieldGT,completeGT,fieldLineCounts} from "../lib/ground-truth-sync";
import type {GlobalField} from "../types";
const fields=[1,2,3].map(n=>({id:String(n),field_index:n,ground_truth_raw:"",roi:{x1:0,y1:0,x2:100,y2:100},source:"manual",confirmed_at:null})) as GlobalField[];
test("single full-image ROI preserves all lines and blank lines",()=>{
 const text="one\n\ntwo\nthree\n";
 const result=splitDocumentGT(text,fields.slice(0,1),[1]);
 expect(result[0].ground_truth_raw).toBe(text);
 expect(joinFieldGT(result)).toBe(text);
 expect(completeGT(result,text)).toBe(true);
});
test("ordered multiline mapping is lossless and incomplete fields block calculation",()=>{
 const text="A\r\nB\r\nC\r\nD\r\nE";
 const result=splitDocumentGT(text,[fields[2],fields[0],fields[1]],[2,1,1]);
 expect(result.map(f=>f.ground_truth_raw)).toEqual(["A\nB","C","D\nE"]);
 expect(fieldLineCounts(result)).toEqual([2,1,2]);
 expect(completeGT(result,text)).toBe(true);
 expect(completeGT(splitDocumentGT("A",fields,[2,1,1]),"A")).toBe(false);
 expect(completeGT(splitDocumentGT("A\n \nC",fields,[1,1,1]),"A\n \nC")).toBe(false);
 expect(completeGT(result,"different")).toBe(false);
 expect(completeGT([],"text")).toBe(false);
});
