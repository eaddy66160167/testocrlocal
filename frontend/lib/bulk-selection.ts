"use client";
import {useState} from "react";

export function useManagedSelection<T>(scope:string,key:(value:T)=>string) {
 const [state,setState]=useState<{scope:string;items:T[]}>({scope,items:[]});
 if(state.scope!==scope) setState({scope,items:[]});
 const items=state.scope===scope?state.items:[];
 const update=(next:T[]|((old:T[])=>T[]))=>setState(old=>({scope,items:typeof next==="function"?next(old.scope===scope?old.items:[]):next}));
 const toggle=(value:T)=>update(old=>old.some(v=>key(v)===key(value))?old.filter(v=>key(v)!==key(value)):old.length<200?[...old,value]:old);
 const page=(visible:T[])=>update(old=>visible.length&&visible.every(v=>old.some(o=>key(o)===key(v)))?old.filter(o=>!visible.some(v=>key(v)===key(o))):Array.from(new Map([...old,...visible].map(v=>[key(v),v])).values()).slice(0,200));
 return {items,toggle,page,clear:()=>update([]),has:(v:T)=>items.some(o=>key(o)===key(v)),all:(vs:T[])=>vs.length>0&&vs.every(v=>items.some(o=>key(o)===key(v)))};
}
