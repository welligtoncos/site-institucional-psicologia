"""Routers da API — inclua novos módulos aqui."""

from fastapi import APIRouter

from app.routes import auth, products

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(products.router)
