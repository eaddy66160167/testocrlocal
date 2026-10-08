from fastapi import APIRouter, Request, Response
from uuid import UUID

from app.api.dependencies import RepoDep, SessionDep
from app.schemas.contracts import PipelineConfigUpdate
from app.services.pipeline_config_service import PipelineConfigService
from app.services.serializers import config_json
from app.schemas.dynamic_pipelines import DynamicPipelineInput, OCRModelInput
from app.services.dynamic_pipeline_service import DynamicPipelineService, model_json

router = APIRouter(prefix="/pipelines")


@router.delete("/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: str, repository: RepoDep, session: SessionDep):
    # Runs retain their own pipeline ID/name, predictions and metrics.
    config = repository.config(pipeline_id)
    session.delete(config)
    session.commit()
    return Response(status_code=204)


@router.get("/models")
def models(session: SessionDep):
    return [model_json(model) for model in DynamicPipelineService(session).models()]


@router.post("/models", status_code=201)
def create_model(data: OCRModelInput, session: SessionDep):
    return model_json(DynamicPipelineService(session).save_model(data))


@router.put("/models/{model_id}")
def update_model(model_id: UUID, data: OCRModelInput, session: SessionDep):
    return model_json(DynamicPipelineService(session).save_model(data, model_id))


@router.post("", status_code=201)
def create_pipeline(data: DynamicPipelineInput, request: Request, session: SessionDep):
    return config_json(DynamicPipelineService(session).save_pipeline(data), request.app.state.settings)


@router.put("/{pipeline_id}/definition")
def update_definition(pipeline_id: str, data: DynamicPipelineInput, request: Request, session: SessionDep):
    return config_json(DynamicPipelineService(session).save_pipeline(data, pipeline_id), request.app.state.settings)


@router.get("")
def pipelines(request: Request, repository: RepoDep):
    return [config_json(config, request.app.state.settings) for config in repository.configs()]


@router.get("/{pipeline_id}")
def get_pipeline(pipeline_id: str, request: Request, repository: RepoDep):
    return config_json(repository.config(pipeline_id), request.app.state.settings)


@router.put("/{pipeline_id}")
def update_pipeline(
    pipeline_id: str, data: PipelineConfigUpdate, request: Request, session: SessionDep
):
    return config_json(
        PipelineConfigService(session, request.app.state.settings).update(pipeline_id, data),
        request.app.state.settings,
    )


@router.post("/{pipeline_id}/test-connection")
async def test_connection(pipeline_id: str, request: Request, session: SessionDep):
    return await PipelineConfigService(session, request.app.state.settings).test_connection(
        pipeline_id
    )
