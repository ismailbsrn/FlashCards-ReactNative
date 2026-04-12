from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, collections, cards, review_logs, sync

from app.core.config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FlashCards API",
    description="FlashCards",
    version="1.0.0"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import sys
    print("VALIDATION ERROR:", exc.errors(), file=sys.stderr)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

app.include_router(auth.router)
app.include_router(collections.router)
app.include_router(cards.router)
app.include_router(review_logs.router)
app.include_router(sync.router)


@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "FlashCards API is running"}


@app.get("/api/health")
def health():
    """API health check"""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
