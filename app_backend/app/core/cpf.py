"""Validação e normalização de CPF (apenas dígitos, 11 posições)."""


def normalize_cpf_digits(raw: str) -> str:
    """Extrai 11 dígitos de uma string (pontuação ignorada)."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) != 11:
        msg = "CPF deve conter 11 dígitos."
        raise ValueError(msg)
    return digits


def cpf_is_valid(digits: str) -> bool:
    """Algoritmo de verificação dos dígitos do CPF (Brasil)."""
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:
        return False

    def verifier(base: str, start_weight: int) -> int:
        total = sum(int(base[i]) * (start_weight - i) for i in range(len(base)))
        rest = total % 11
        return 0 if rest < 2 else 11 - rest

    d1 = verifier(digits[:9], 10)
    if int(digits[9]) != d1:
        return False
    d2 = verifier(digits[:10], 11)
    return int(digits[10]) == d2


def parse_and_validate_cpf(raw: str) -> str:
    """Normaliza e valida; retorna somente dígitos."""
    d = normalize_cpf_digits(raw)
    if not cpf_is_valid(d):
        msg = "CPF inválido."
        raise ValueError(msg)
    return d
