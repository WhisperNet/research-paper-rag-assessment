from fastapi import FastAPI

try:
    # Support running as a module (python -m uvicorn app:app ...)
    from .routes import router as embedder_router  # type: ignore
except Exception:  # when run as script
    from routes import router as embedder_router  # type: ignore


def create_app() -> FastAPI:
    app = FastAPI(title="Embedder Service")
    # CORS
    try:
        from fastapi.middleware.cors import CORSMiddleware
        import os as _os

        allowed_origins = _os.getenv("EMBEDDER_CORS_ORIGINS", "*").split(",")
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[o.strip() for o in allowed_origins if o.strip()],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    except Exception:
        pass

    app.include_router(embedder_router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9100)
