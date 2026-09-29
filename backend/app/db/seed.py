from sqlalchemy import select

from app.core.config import Settings
from app.db.models import Category, DocumentType, PipelineConfig
from app.services.document_type_service import DEFAULT_TYPES, normalized_name

CATEGORIES = {
    "thai_text": "Thai text",
    "thai_digit": "Thai digits",
    "arabic_digit": "Arabic digits",
    "english_text": "English text",
    "mixed_language": "Mixed language",
    "sentence": "Sentence",
    "handwriting": "Handwriting",
    "strikethrough": "Strikethrough",
    "stamp": "Stamp",
    "table_text": "Table text",
    "low_quality": "Low quality",
    "blur": "Blur",
    "skew": "Skew",
    "small_text": "Small text",
}


def seed_database(session, settings: Settings):
    names = set(session.scalars(select(DocumentType.normalized_name)))
    session.add_all(DocumentType(name=name, normalized_name=normalized_name(name), system=True)
                    for name in DEFAULT_TYPES if normalized_name(name) not in names)
    existing = set(session.scalars(select(Category.code)))
    session.add_all(
        Category(code=code, display_name=name)
        for code, name in CATEGORIES.items()
        if code not in existing
    )
    configs = [
        dict(
            pipeline_id="mint",
            name="Mint Custom",
            base_url=settings.model_gateway_base_url,
            endpoint=settings.mint_ocr_endpoint,
            engine="custom",
            query_params={"engine": "custom"},
        ),
        dict(
            pipeline_id="hutch_crop",
            name="Hutch Crop",
            base_url=settings.model_gateway_base_url,
            endpoint=settings.hutch_crop_endpoint,
            engine="paddle",
            query_params={"engine": "paddle"},
        ),
        dict(
            pipeline_id="hutch_full",
            name="Hutch Full",
            base_url=settings.model_gateway_base_url,
            endpoint=settings.hutch_full_endpoint or "/api/v1/ocr-results",
            engine="paddle",
            query_params={"engine": "paddle"},
        ),
    ]
    existing_pipelines = set(session.scalars(select(PipelineConfig.pipeline_id)))
    configs.append(dict(pipeline_id="benchmark", name="Benchmark", base_url=settings.model_gateway_base_url,
                        endpoint="/api/v1/text-detection-batches", engine="det_v6_rec_v5",
                        query_params={"version": "6"}, request_format="multipart", file_field_name="images"))
    session.add_all(
        PipelineConfig(**item) for item in configs if item["pipeline_id"] not in existing_pipelines
    )
    if "thai_ft_v2" not in existing_pipelines:
        session.add(PipelineConfig(
            pipeline_id="thai_ft_v2", name="Thai FT v2", base_url=settings.model_gateway_base_url,
            endpoint="/api/v1/text-detection-batches", engine="det_v6_rec_v6_thai_ft_v2",
            query_params={"version": "6", "model": "thai_ft_v2"},
            request_format="multipart", file_field_name="images",
        ))
    if "hutch_fine_tune_v2" not in existing_pipelines:
        session.add(PipelineConfig(
            pipeline_id="hutch_fine_tune_v2", name="Hutch fine tune v2",
            base_url=settings.model_gateway_base_url,
            endpoint="/api/v1/text-recognition-batches", engine="rec_v5_thai_ft_v2",
            query_params={"version": "5", "model": "thai_ft_v2"},
            request_format="multipart", file_field_name="images",
        ))
    session.commit()
