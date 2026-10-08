import type { GlobalField } from "@/types";

// Preview of backend global_order.reading_order. Server reorders on every save.
export function previewFieldOrder(fields: GlobalField[]): GlobalField[] {
  const rows: GlobalField[][] = [];
  const seeds = [...fields].sort((a, b) => a.roi.y1 - b.roi.y1 || a.roi.x1 - b.roi.x1 || a.roi.y2 - b.roi.y2 || a.roi.x2 - b.roi.x2 || a.id.localeCompare(b.id));
  for (const field of seeds) {
    const box = field.roi;
    const row = rows.find(([first]) => Math.min(box.y2, first.roi.y2) - Math.max(box.y1, first.roi.y1) >= Math.min(box.y2 - box.y1, first.roi.y2 - first.roi.y1) * 0.5);
    if (row) row.push(field); else rows.push([field]);
  }
  return rows.flatMap(row => row.sort((a, b) => a.roi.x1 - b.roi.x1 || a.roi.y1 - b.roi.y1 || a.roi.x2 - b.roi.x2 || a.roi.y2 - b.roi.y2 || a.id.localeCompare(b.id))).map((field, i) => ({ ...field, field_index: i + 1 }));
}
