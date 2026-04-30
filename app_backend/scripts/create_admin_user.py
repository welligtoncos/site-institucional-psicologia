#!/usr/bin/env python3
"""
Cria um usuário com papel `admin` na tabela `users` (login JWT no portal administrativo).

Uso (na pasta app_backend, com .env contendo DATABASE_URL e SECRET_KEY):
  python scripts/create_admin_user.py
  python scripts/create_admin_user.py --email seu@email.com --password "SenhaSegura12"

Sem --password: gera senha aleatória e exibe uma vez no terminal.

Exemplo PowerShell:
  cd app_backend
  $env:PYTHONPATH="."
  python scripts/create_admin_user.py --email admin@minha-clinica.test
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import string
import sys
from datetime import datetime, timezone
from pathlib import Path

# Raiz do pacote app_backend (pai de scripts/)
_APP_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_APP_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_APP_BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(_APP_BACKEND_ROOT / ".env")


def _random_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _run(*, name: str, email: str, phone: str, password: str) -> None:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.user import UserRole
    from app.repositories.user_repository import UserRepository

    email_norm = email.strip().lower()
    pwd_hash = hash_password(password)

    async with AsyncSessionLocal() as session:
        assert isinstance(session, AsyncSession)
        repo = UserRepository(session)
        existing = await repo.get_by_email(email_norm)
        if existing is not None:
            if existing.role != UserRole.admin:
                print(f"ERRO: já existe usuário com e-mail {email_norm} com papel {existing.role.value}.", file=sys.stderr)
                sys.exit(1)
            print(f"Usuário admin já existe: {email_norm} (id={existing.id}). Nada a fazer.")
            return

        user = await repo.create(
            name=name,
            email=email_norm,
            phone=phone.strip(),
            password_hash=pwd_hash,
            role=UserRole.admin,
            terms_accepted_at=datetime.now(timezone.utc),
        )
        print("Administrador criado com sucesso.")
        print(f"  id:    {user.id}")
        print(f"  email: {user.email}")
        print(f"  nome:  {user.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria usuário administrador (JWT admin).")
    parser.add_argument("--email", default="admin@clinica.local", help="E-mail de login (único).")
    parser.add_argument("--name", default="Administrador", help="Nome exibido.")
    parser.add_argument("--phone", default="11999999999", help="Telefone (mín. 8 caracteres).")
    parser.add_argument("--password", default="", help="Senha (mín. 8 caracteres). Se vazio, gera aleatória.")
    args = parser.parse_args()

    password = args.password.strip()
    generated = False
    if not password:
        password = _random_password(18)
        generated = True
    if len(password) < 8:
        print("ERRO: senha deve ter pelo menos 8 caracteres.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(_run(name=args.name, email=args.email, phone=args.phone, password=password))

    if generated:
        print()
        print("Senha gerada (guarde em local seguro — não será salva em arquivo):")
        print(f"  {password}")


if __name__ == "__main__":
    main()
