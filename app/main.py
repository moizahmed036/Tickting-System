from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_v1_router
from app.core.config import settings
from app.core.scheduler import scheduler
from app.db.base import Base
from app.db.session import engine
from app.services.workflow_engine import WorkflowEngineException

# Import all models to ensure metadata registration
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager: initializes database tables and
    starts the background automation worker loops.
    """
    # Create DB tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start background scheduler
    await scheduler.start()

    yield

    # Graceful shutdown
    await scheduler.stop()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    ## Enterprise Workflow & Ticketing Automation System API
    
    A production-grade, modular enterprise ticketing engine featuring:
    - **Multi-Department Queues**: IT, Finance, HR, Service Delivery, Procurement.
    - **Role-Based Access Control (RBAC)**: Requester, Assignee, Authorizer, Observer, Admin.
    - **Finite State Machine (FSM)**: Strict workflow steps, permission gates, and transition rules.
    - **Append-Only Audit Trail**: Immutable chronological history capturing every state change and modification.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Custom Exception Handler for Workflow Engine Errors
@app.exception_handler(WorkflowEngineException)
async def workflow_engine_exception_handler(request: Request, exc: WorkflowEngineException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_type": "WorkflowEngineError"},
    )


# Health Check & Root Endpoints
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_STR,
    }


# Register API v1 Routers
app.include_router(api_v1_router, prefix=settings.API_V1_STR)
