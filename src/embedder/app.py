from fastapi import FastAPI

app = FastAPI(title="Embedder Stub")


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "embedder"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9100)


