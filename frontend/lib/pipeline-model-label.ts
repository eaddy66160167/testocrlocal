import type {OCRModel} from "@/types";

export const versionLabel = (version: string, kind: OCRModel["kind"], source: OCRModel["source"]) => {
  if(source === "official") return kind === "det" && version === "6" ? "PP-OCRv6_medium_det" : kind === "rec" && version === "5" ? "th_PP-OCRv5_mobile_rec" : `PPOCR${version}_${kind}`;
  return version === "5" && kind === "det" ? "PPOCR5_server_det" : `PPOCR${version}_${kind}`;
};
