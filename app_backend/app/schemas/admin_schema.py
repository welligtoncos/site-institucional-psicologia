"""Schemas do portal administrativo (indicadores, listagens e comandos)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.schemas.auth_schema import PsychologistRegisterRequest
from app.schemas.profile_schema import PatientMeResponse, PatientProfilePatchRequest


class AdminDashboardIndicadoresResponse(BaseModel):
    total_pacientes: int
    total_psicologos: int
    total_consultas: int
    total_pagamentos: int
    consultas_agendadas: int
    consultas_canceladas: int
    pagamentos_pendentes: int
    pagamentos_confirmados: int
    faturamento_total_centavos: int
    ganhos_ultimos_7_dias: list[dict]
    faturamento_mensal_centavos: int
    ticket_medio_centavos: int
    novos_pacientes_30_dias: int
    consultas_realizadas: int
    no_show: int
    taxa_comparecimento_percentual: float
    psicologos_ativos: int
    pacientes_recorrentes: int


class AdminPsychologistStatusPatchRequest(BaseModel):
    """PATCH /admin/psicologos/{id}/status — ativo no portal do paciente = User.is_active."""

    ativo: bool


class AdminPsychologistPutRequest(BaseModel):
    """PUT /admin/psicologos/{id} — atualização pelo administrador."""

    name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    crp: str | None = Field(default=None, min_length=3, max_length=32)
    bio: str | None = Field(default=None, max_length=8000)
    foto_url: str | None = Field(default=None, max_length=600_000)
    especialidades: str | None = Field(default=None, max_length=4000)
    valor_sessao_padrao: Decimal | None = Field(default=None, ge=0)
    duracao_minutos_padrao: int | None = Field(default=None, ge=15, le=240)

    @model_validator(mode="after")
    def _at_least_one(self) -> "AdminPsychologistPutRequest":
        fields = (
            self.name,
            self.email,
            self.phone,
            self.crp,
            self.bio,
            self.foto_url,
            self.especialidades,
            self.valor_sessao_padrao,
            self.duracao_minutos_padrao,
        )
        if all(v is None for v in fields):
            raise ValueError("Informe ao menos um campo para atualizar.")
        return self


class AdminPatientPutRequest(PatientProfilePatchRequest):
    """PUT /admin/pacientes/{id} — mesmo pacote do perfil do paciente + e-mail opcional."""

    email: EmailStr | None = Field(default=None, description="Se informado, atualiza o e-mail do usuário (único).")


class AdminConsultaListItem(BaseModel):
    id: UUID
    paciente_id: UUID
    paciente_nome: str
    psicologo_id: UUID
    psicologo_nome: str
    data_agendada: date
    hora_inicio: str
    modalidade: str
    status_consulta: str
    status_pagamento_consulta: str
    status_gateway: str | None = None


class AdminConsultaListResponse(BaseModel):
    items: list[AdminConsultaListItem]
    total: int
    skip: int
    limit: int


class AdminConsultaDetailResponse(BaseModel):
    id: UUID
    paciente: dict
    psicologo: dict
    data_agendada: date
    hora_inicio: str
    duracao_minutos: int
    modalidade: str
    status: str
    situacao_pagamento: str
    valor_acordado: Decimal
    especialidade_atendida: str
    observacoes: str
    link_videochamada_opcional: str | None
    cobranca: dict | None


class AdminConsultaCancelarRequest(BaseModel):
    motivo: str | None = Field(default=None, max_length=2000)


class AdminConsultaRemarcarRequest(BaseModel):
    data_agendada: date
    hora_inicio: str = Field(..., description="HH:MM (24h)")


class AdminPagamentoListItem(BaseModel):
    id: UUID
    consulta_id: UUID
    paciente_id: UUID
    paciente_nome: str
    valor_centavos: int
    moeda: str
    forma_pagamento: str
    status_gateway: str
    criado_em: datetime
    pago_em: datetime | None


class AdminPagamentoListResponse(BaseModel):
    items: list[AdminPagamentoListItem]
    total: int
    skip: int
    limit: int


class AdminPagamentoDetailResponse(BaseModel):
    cobranca_id: UUID
    consulta_id: UUID
    valor_centavos: int
    moeda: str
    forma_pagamento: str
    provedor_gateway: str
    id_intent_gateway: str
    status_gateway: str
    criado_em: datetime
    pago_em: datetime | None
    paciente: dict
    consulta_resumo: dict


class AdminPacienteHistoricoConsulta(BaseModel):
    id: UUID
    data_agendada: date
    hora_inicio: str
    psicologo_nome: str
    status: str
    situacao_pagamento: str


class AdminPacienteHistoricoResponse(BaseModel):
    paciente: PatientMeResponse
    consultas_realizadas: list[AdminPacienteHistoricoConsulta]
    consultas_futuras: list[AdminPacienteHistoricoConsulta]
    pagamentos: list[AdminPagamentoListItem]


class AdminPsychologistCreateRequest(PsychologistRegisterRequest):
    """POST /admin/psicologos — mesmo corpo do cadastro público de psicólogo."""

    model_config = ConfigDict(extra="forbid")


class AdminOperationNotice(BaseModel):
    notificacoes_enviadas: bool = Field(
        description="True se e-mails foram disparados (Resend configurado); senão False.",
    )
    notificacoes_detalhe: str | None = None


class AdminConsultaCancelarResponse(BaseModel):
    consulta: AdminConsultaDetailResponse
    notice: AdminOperationNotice


class AdminConsultaRemarcarResponse(BaseModel):
    consulta: AdminConsultaDetailResponse
    notice: AdminOperationNotice
