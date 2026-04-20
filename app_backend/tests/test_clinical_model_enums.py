"""Regressões de mapeamento de enum no modelo clínico."""

from app.models.clinical import Consulta


def test_consulta_modalidade_uses_database_enum_values() -> None:
    modalidade_type = Consulta.__table__.c.modalidade.type
    assert modalidade_type.enums == ["Online", "Presencial"]


def test_consulta_situacao_pagamento_uses_database_enum_values() -> None:
    pagamento_type = Consulta.__table__.c.situacao_pagamento.type
    assert pagamento_type.enums == ["Pago", "Pendente"]
