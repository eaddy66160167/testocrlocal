FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements-runtime-lock.txt ./
RUN pip install --no-cache-dir -r requirements-runtime-lock.txt && pip check
COPY app ./app
COPY alembic_shared ./alembic_shared
COPY alembic-shared.ini ./
RUN useradd --create-home --uid 10001 benchmark && chown -R benchmark:benchmark /app
USER benchmark
EXPOSE 8000
# Migrate shared configuration with a separate controlled pre-deploy command.
# Shell expansion respects Railway PORT; exec forwards shutdown signals.
CMD ["sh", "-c", "exec python -m uvicorn app.local_first.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
