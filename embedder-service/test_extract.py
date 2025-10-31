from fastapi.testclient import TestClient
from app import app


client = TestClient(app)


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_extract_pdf():
    # Use one of the provided sample PDFs
    import os

    # Walk up directories until we find sample_papers
    cur = os.path.abspath(os.path.dirname(__file__))
    sample_path = None
    for _ in range(8):  # safety cap
        candidate = os.path.join(cur, "sample_papers", "paper_1.pdf")
        if os.path.exists(candidate):
            sample_path = candidate
            break
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    assert sample_path is not None and os.path.exists(sample_path)
    with open(sample_path, "rb") as f:
        files = {"file": ("paper_1.pdf", f, "application/pdf")}
        r = client.post("/extract", files=files)
    assert r.status_code == 200
    data = r.json()
    assert "metadata" in data
    assert "chunks" in data
    assert len(data["chunks"]) > 0

