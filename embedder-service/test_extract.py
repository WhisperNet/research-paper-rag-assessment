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

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    sample_path = os.path.join(repo_root, "sample_papers", "paper_1.pdf")
    assert os.path.exists(sample_path)
    with open(sample_path, "rb") as f:
        files = {"file": ("paper_1.pdf", f, "application/pdf")}
        r = client.post("/extract", files=files)
    assert r.status_code == 200
    data = r.json()
    assert "metadata" in data
    assert "chunks" in data
    assert len(data["chunks"]) > 0

