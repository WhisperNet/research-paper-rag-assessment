from fastapi.testclient import TestClient
from app import app


client = TestClient(app)


def test_embed_basic():
    r = client.post(
        "/embed",
        json={
            "texts": [
                "Transformers use self-attention.",
                "Convolutional networks are used in vision.",
            ],
            "normalize": True,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "vectors" in data and isinstance(data["vectors"], list)
    assert len(data["vectors"]) == 2
    dim = data["dim"]
    assert dim > 0
    assert len(data["vectors"][0]) == dim


