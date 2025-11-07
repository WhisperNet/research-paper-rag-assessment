FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/embedder-service

# System dependencies (kept minimal; PyMuPDF wheels should suffice)
# If you hit font or rendering issues, consider adding fonts or poppler utils.

COPY embedder-service/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

COPY embedder-service/ ./

EXPOSE 9100

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9100"]


