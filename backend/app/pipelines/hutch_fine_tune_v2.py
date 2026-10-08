"""Recognition-only V5 fine tune: the canonical field PNG is the complete input."""
from app.pipelines.base import CropInputAdapter
from app.pipelines.benchmark import RECOGNITION_ENDPOINT
from app.pipelines.normalizers import NormalizedOCR, confidence, recognition_items


class HutchFineTuneV2PipelineAdapter(CropInputAdapter):
    engine = "rec_v5_thai_ft_v2"
    detector = ""
    recognizer = "Hutch fine tune v2 REC V5"

    def build_request(self, crop, request_id):
        request = self.gateway.build_batch_request(
            pngs=[crop.png], endpoint=RECOGNITION_ENDPOINT, version=5, request_id=request_id,
        )
        request["params"]["model"] = "thai_ft_v2"
        return request

    def parse_response(self, data, *, offset, crop_size):
        item = recognition_items(data, 1)[0]
        # REC supplies no detected geometry. Global Field identity/ROI comes from the common layer.
        return NormalizedOCR(item["text"], item["text"], confidence(item["rec_score"]))
