"""
Rotas HTTP do CRUD de produtos.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.product_schema import (
    ProductCreateRequest,
    ProductResponse,
    ProductUpdateRequest,
)
from app.services.product_service import ProductService

router = APIRouter(
    prefix="/products",
    tags=["products"],
    responses={
        200: {"description": "OK"},
        201: {"description": "Produto criado"},
        204: {"description": "Produto removido"},
        401: {"description": "Não autorizado"},
        404: {"description": "Produto não encontrado"},
        422: {"description": "Erro de validação (schema)"},
    },
)


async def get_product_service(db: AsyncSession = Depends(get_db)) -> ProductService:
    return ProductService(db)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreateRequest,
    current_user: User = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
) -> ProductResponse:
    return await service.create(payload, actor=str(current_user.id))


@router.get("", response_model=list[ProductResponse])
async def list_products(
    _: User = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
) -> list[ProductResponse]:
    products = await service.list_all()
    return list(products)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product_by_id(
    product_id: UUID,
    _: User = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
) -> ProductResponse:
    return await service.get_by_id(product_id)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    payload: ProductUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
) -> ProductResponse:
    return await service.update(product_id, payload, actor=str(current_user.id))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
) -> Response:
    await service.delete(product_id, actor=str(current_user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
