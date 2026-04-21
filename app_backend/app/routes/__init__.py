"""Routers da API — inclua novos módulos aqui."""

from fastapi import APIRouter

from app.routes import admin_clinical, auth, catalog, products, profiles, realtime

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(catalog.router)
api_router.include_router(admin_clinical.router)
api_router.include_router(products.router)
api_router.include_router(realtime.router)
