"""
Regras de negócio do CRUD de produtos.
"""

from collections.abc import Sequence
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.messaging.producer import ProductEventPublisher
from app.repositories.product_repository import ProductRepository
from app.schemas.product_schema import (
    ProductCreateRequest,
    ProductResponse,
    ProductUpdateRequest,
)

logger = logging.getLogger(__name__)


class ProductService:
    def __init__(self, db: AsyncSession) -> None:
        self._products = ProductRepository(db)
        self._publisher = ProductEventPublisher()

    async def create(self, data: ProductCreateRequest, *, actor: str = "system") -> ProductResponse:
        product = await self._products.create(
            nome=data.nome,
            descricao=data.descricao,
            preco=data.preco,
            quantidade=data.quantidade,
            ativo=data.ativo,
        )
        response = ProductResponse.model_validate(product)
        self._publish_event("product.created", response, actor=actor)
        return response

    async def list_all(self) -> Sequence[ProductResponse]:
        products = await self._products.list_all()
        return [ProductResponse.model_validate(item) for item in products]

    async def get_by_id(self, product_id: UUID) -> ProductResponse:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Produto não encontrado.")
        return ProductResponse.model_validate(product)

    async def update(
        self,
        product_id: UUID,
        data: ProductUpdateRequest,
        *,
        actor: str = "system",
    ) -> ProductResponse:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Produto não encontrado.")

        changes = data.model_dump(exclude_unset=True)
        for key, value in changes.items():
            if isinstance(value, str):
                value = value.strip()
            setattr(product, key, value)

        updated = await self._products.update(product)
        response = ProductResponse.model_validate(updated)
        self._publish_event("product.updated", response, actor=actor)
        return response

    async def delete(self, product_id: UUID, *, actor: str = "system") -> None:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Produto não encontrado.")

        response = ProductResponse.model_validate(product)
        deleted = await self._products.delete(product_id)
        if not deleted:
            raise NotFoundError("Produto não encontrado.")
        self._publish_event("product.deleted", response, actor=actor)

    def _publish_event(self, event_type: str, product: ProductResponse, *, actor: str) -> None:
        try:
            self._publisher.publish(
                event_type=event_type,
                data=product.model_dump(mode="json"),
                actor=actor,
            )
        except Exception:
            # Tratamento básico de falha: mantém operação principal e registra erro para observabilidade.
            logger.exception("Evento RabbitMQ não publicado: %s", event_type)
