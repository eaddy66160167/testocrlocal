from app.pipelines.hutch_crop import HutchCropPipelineAdapter


class HutchFullPipelineAdapter(HutchCropPipelineAdapter):
    """Same canonical field PNG as every pipeline; historical traces stay unchanged."""

    def build_request(self, crop, request_id):
        return self.gateway.build_request(
            png=crop.png, endpoint=self.config.endpoint, query_params={"engine": "paddle"},
            fields=self.model_parameters(), request_id=request_id, request_format=self.config.request_format,
        )
