"""Exceções de domínio mapeadas para HTTP em `main.py`."""


class DomainError(Exception):
    """Base para erros de regra de negócio."""


class ConflictError(DomainError):
    """Conflito de recurso (ex.: e-mail duplicado)."""


class AuthenticationError(DomainError):
    """Falha de credenciais ou token."""


class NotFoundError(DomainError):
    """Recurso não encontrado."""
