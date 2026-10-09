FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Node is only used by the Prisma CLI to generate/manage the Python client.
# The application server is Python/uvicorn.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 aitutor \
    && useradd --uid 1001 --gid aitutor --create-home aitutor \
    && python -m venv /opt/venv \
    && mkdir -p /app/uploads \
    && chown -R aitutor:aitutor /app /opt/venv

WORKDIR /app
USER aitutor

COPY --chown=aitutor:aitutor requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=aitutor:aitutor schema.prisma ./
RUN python -m nodeenv --node=22.22.2 /home/aitutor/.cache/prisma-python/nodeenv \
    && prisma generate --schema schema.prisma

COPY --chown=aitutor:aitutor app ./app
COPY --chown=aitutor:aitutor scripts ./scripts
COPY --chown=aitutor:aitutor run.py ./

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:4000/health', timeout=3)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
