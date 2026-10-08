"use client";
import {Label, Tag, Text} from "react-konva";

/** Keep the badge legible at every zoom level without changing ROI geometry. */
export default function FieldLabel({x,y,scale,text,color="#4f46e5"}:{x:number;y:number;scale:number;text:string;color?:string}){
 return <Label x={x} y={Math.max(0,y-24/scale)} scaleX={1/scale} scaleY={1/scale} listening={false}>
  <Tag fill="white" stroke="#c7d2fe" strokeWidth={1} cornerRadius={5} shadowColor="#0f172a" shadowOpacity={0.12} shadowBlur={4} shadowOffsetY={2}/>
  <Text text={text} fontFamily="Tahoma, sans-serif" fontSize={10} fontStyle="bold" padding={6} fill={color}/>
 </Label>;
}
