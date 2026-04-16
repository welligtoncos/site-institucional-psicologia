"""
Persistência de `Product` usando SQLAlchemy assíncrono.
"""

from collections.abc import Sequence
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        *,
        nome: str,
        descricao: str,
        preco: Decimal,
        quantidade: int,
        ativo: bool,
    ) -> Product:
        product = Product(
            nome=nome.strip(),
            descricao=descricao.strip(),
            preco=preco,
            quantidade=quantidade,
            ativo=ativo,
        )
        self._db.add(product)
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def list_all(self) -> Sequence[Product]:
        result = await self._db.execute(select(Product).order_by(Product.created_at.desc()))
        return result.scalars().all()

    async def get_by_id(self, product_id: UUID) -> Product | None:
        return await self._db.get(Product, product_id)

    async def update(self, product: Product) -> Product:
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def delete(self, product_id: UUID) -> bool:
        result = await self._db.execute(delete(Product).where(Product.id == product_id))
        if result.rowcount == 0:
            await self._db.rollback()
            return False
        await self._db.commit()
        return True
