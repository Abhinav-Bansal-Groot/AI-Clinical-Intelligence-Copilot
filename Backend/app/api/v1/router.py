from fastapi import APIRouter

from app.api.v1 import (
    auth,
    copilot,
    dashboard,
    dashboard_copilot,
    insights,
    knowledge,
    patients,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(
    dashboard_copilot.router,
    prefix="/dashboard-copilot",
    tags=["dashboard-copilot"],
)
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
