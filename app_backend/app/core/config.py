"""
Configuração via variáveis de ambiente (pydantic-settings).
Compatível com SECRET_KEY / ALGORITHM do prompt e com nomes legados (JWT_*).

Antes de importar `get_settings` na entrada da app, chame `load_project_dotenv()`
(`app.core.dotenv_bootstrap`) para aplicar o `.env` (e regras como preservar `DATABASE_URL` no Docker).
"""

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Parâmetros da aplicação — não versionar segredos reais.
    Lê só `os.environ`; o `.env` é carregado antes por `load_project_dotenv()`.
    """

    model_config = SettingsConfigDict(extra="ignore")

    app_name: str = Field(default="API Auth", description="Título na OpenAPI")
    debug: bool = Field(default=False)

    cors_origins: str = Field(
        default=(
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:4200,http://127.0.0.1:4200"
        ),
        description="Origens CORS separadas por vírgula (inclui Angular ng serve na 4200)",
    )

    # URL assíncrona: postgresql+asyncpg://user:pass@host:5432/dbname
    database_url: str = Field(..., alias="DATABASE_URL")

    # JWT — SECRET_KEY (prompt) ou JWT_SECRET_KEY (.env antigo)
    secret_key: str = Field(
        ...,
        validation_alias=AliasChoices("SECRET_KEY", "JWT_SECRET_KEY"),
        description="Chave para assinar JWT",
    )
    algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("ALGORITHM", "JWT_ALGORITHM"),
    )

    access_token_expire_minutes: int = Field(
        default=30,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(
        default=7,
        validation_alias="REFRESH_TOKEN_EXPIRE_DAYS",
    )

    rabbitmq_url: str = Field(
        default="amqp://app:app@127.0.0.1:5672/%2f",
        validation_alias=AliasChoices("RABBITMQ_URL", "AMQP_URL"),
        description="URL de conexão AMQP do RabbitMQ",
    )
    mongo_uri: str = Field(
        default="mongodb://app:app@127.0.0.1:27017",
        validation_alias=AliasChoices("MONGO_URI", "MONGODB_URI"),
        description="URI de conexão do MongoDB para auditoria",
    )
    mongo_audit_db: str = Field(default="auditdb", validation_alias="MONGO_AUDIT_DB")
    mongo_audit_collection: str = Field(
        default="product_events",
        validation_alias="MONGO_AUDIT_COLLECTION",
    )

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
