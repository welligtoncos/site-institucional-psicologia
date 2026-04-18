"""Perfis: patient, psychologist, admin (substitui user -> patient).

Revision ID: 003_user_roles_three_profiles
Revises: 002_products
Create Date: 2026-04-17

"""

from collections.abc import Sequence

from alembic import op

revision: str = "003_user_roles_three_profiles"
down_revision: str | None = "002_products"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE user_role_enum_new AS ENUM ('patient', 'psychologist', 'admin');
        """
    )
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT;")
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role TYPE user_role_enum_new
        USING (
            CASE role::text
                WHEN 'admin' THEN 'admin'::user_role_enum_new
                ELSE 'patient'::user_role_enum_new
            END
        );
        """
    )
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role SET DEFAULT 'patient'::user_role_enum_new;
        """
    )
    op.execute("DROP TYPE user_role_enum;")
    op.execute("ALTER TYPE user_role_enum_new RENAME TO user_role_enum;")


def downgrade() -> None:
    op.execute(
        """
        CREATE TYPE user_role_enum_old AS ENUM ('admin', 'user');
        """
    )
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT;")
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role TYPE user_role_enum_old
        USING (
            CASE role::text
                WHEN 'admin' THEN 'admin'::user_role_enum_old
                ELSE 'user'::user_role_enum_old
            END
        );
        """
    )
    op.execute(
        """
        ALTER TABLE users
        ALTER COLUMN role SET DEFAULT 'user'::user_role_enum_old;
        """
    )
    op.execute("DROP TYPE user_role_enum;")
    op.execute("ALTER TYPE user_role_enum_old RENAME TO user_role_enum;")
