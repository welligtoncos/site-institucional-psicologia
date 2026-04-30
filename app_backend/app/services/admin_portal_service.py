"""Operações do portal administrativo (indicadores, CRUD e intervenção em consultas)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_notify_email import (
    _format_gateway_label,
    notify_consulta_alterada_html,
    send_resend_email,
)
from app.core.exceptions import ConflictError, NotFoundError
from app.core.psychologist_profile import is_professional_profile_complete
from app.models.clinical import CobrancaStatusGateway, Consulta, ConsultaStatus
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.admin_schema import (
    AdminConsultaCancelarRequest,
    AdminConsultaCancelarResponse,
    AdminConsultaDetailResponse,
    AdminConsultaListItem,
    AdminConsultaListResponse,
    AdminConsultaRemarcarRequest,
    AdminConsultaRemarcarResponse,
    AdminDashboardIndicadoresResponse,
    AdminOperationNotice,
    AdminPacienteHistoricoConsulta,
    AdminPacienteHistoricoResponse,
    AdminPagamentoDetailResponse,
    AdminPagamentoListItem,
    AdminPagamentoListResponse,
    AdminPatientPutRequest,
    AdminPsychologistPutRequest,
    AdminPsychologistStatusPatchRequest,
)
from app.schemas.auth_schema import PsychologistRegisterRequest, UserResponse
from app.schemas.profile_schema import (
    PacienteProfileResponse,
    PatientMeResponse,
    PsychologistMeResponse,
    PsicologoProfileResponse,
)
from app.services.auth_service import AuthService

CLINIC_TZ = ZoneInfo("America/Sao_Paulo")


class AdminPortalService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._clinical = ClinicalRepository(db)
        self._users = UserRepository(db)
        self._auth = AuthService(db)

    async def get_indicadores(self) -> AdminDashboardIndicadoresResponse:
        total_pacientes = await self._clinical.count_pacientes_total()
        total_psicologos = await self._clinical.count_psicologos_total()
        total_consultas = await self._clinical.count_consultas_total()
        total_pagamentos = await self._clinical.count_cobrancas_total()
        consultas_agendadas = await self._clinical.count_consultas_por_status(ConsultaStatus.agendada)
        consultas_canceladas = await self._clinical.count_consultas_por_status(ConsultaStatus.cancelada)
        pagamentos_pendentes = await self._clinical.count_cobrancas_por_gateway(CobrancaStatusGateway.awaiting_payment)
        pagamentos_confirmados = await self._clinical.count_cobrancas_por_gateway(CobrancaStatusGateway.succeeded)
        consultas_realizadas = await self._clinical.count_consultas_por_status(ConsultaStatus.realizada)
        no_show = await self._clinical.count_consultas_por_status(ConsultaStatus.nao_compareceu)
        comparecimento_base = consultas_realizadas + no_show
        taxa_comparecimento_percentual = (
            round((consultas_realizadas / comparecimento_base) * 100, 2) if comparecimento_base > 0 else 0.0
        )

        hoje = datetime.now().date()
        inicio_mes = hoje.replace(day=1)
        inicio_30 = hoje - timedelta(days=29)

        faturamento_total_centavos = await self._clinical.sum_cobrancas_confirmadas_centavos()
        faturamento_mensal_centavos = await self._clinical.sum_cobrancas_confirmadas_periodo_centavos(
            data_inicio=inicio_mes,
            data_fim=hoje,
        )
        ticket_medio_centavos = await self._clinical.avg_cobrancas_confirmadas_centavos()
        novos_pacientes_30_dias = await self._clinical.count_pacientes_desde(data_inicio=inicio_30)
        psicologos_ativos = await self._clinical.count_psicologos_ativos()
        pacientes_recorrentes = await self._clinical.count_pacientes_recorrentes()

        ganhos_raw = await self._clinical.ganhos_confirmados_ultimos_dias(days=7)
        ganhos_map = {d.isoformat(): total for d, total in ganhos_raw}
        ganhos_ultimos_7_dias: list[dict] = []
        for i in range(6, -1, -1):
            dia = hoje - timedelta(days=i)
            iso = dia.isoformat()
            ganhos_ultimos_7_dias.append(
                {
                    "data": iso,
                    "label": dia.strftime("%d/%m"),
                    "valor_centavos": int(ganhos_map.get(iso, 0)),
                }
            )
        return AdminDashboardIndicadoresResponse(
            total_pacientes=total_pacientes,
            total_psicologos=total_psicologos,
            total_consultas=total_consultas,
            total_pagamentos=total_pagamentos,
            consultas_agendadas=consultas_agendadas,
            consultas_canceladas=consultas_canceladas,
            pagamentos_pendentes=pagamentos_pendentes,
            pagamentos_confirmados=pagamentos_confirmados,
            faturamento_total_centavos=faturamento_total_centavos,
            ganhos_ultimos_7_dias=ganhos_ultimos_7_dias,
            faturamento_mensal_centavos=faturamento_mensal_centavos,
            ticket_medio_centavos=ticket_medio_centavos,
            novos_pacientes_30_dias=novos_pacientes_30_dias,
            consultas_realizadas=consultas_realizadas,
            no_show=no_show,
            taxa_comparecimento_percentual=taxa_comparecimento_percentual,
            psicologos_ativos=psicologos_ativos,
            pacientes_recorrentes=pacientes_recorrentes,
        )

    async def create_psicologo(self, payload: PsychologistRegisterRequest) -> PsychologistMeResponse:
        user = await self._auth.register_psychologist(payload)
        ps_row = await self._clinical.get_psicologo_by_usuario_id(user.id)
        if ps_row is None:
            raise NotFoundError("Perfil de psicólogo não encontrado após criação.")
        ps = await self._clinical.get_psicologo_por_id(ps_row.id)
        assert ps is not None
        return PsychologistMeResponse(
            user=UserResponse.model_validate(ps.usuario),
            psicologo=PsicologoProfileResponse.model_validate(ps),
            professional_profile_complete=is_professional_profile_complete(ps.usuario, ps),
        )

    async def get_psicologo(self, psicologo_id: UUID) -> PsychologistMeResponse:
        ps = await self._clinical.get_psicologo_por_id(psicologo_id)
        if ps is None or ps.usuario.role != UserRole.psychologist:
            raise NotFoundError("Psicólogo não encontrado.")
        return PsychologistMeResponse(
            user=UserResponse.model_validate(ps.usuario),
            psicologo=PsicologoProfileResponse.model_validate(ps),
            professional_profile_complete=is_professional_profile_complete(ps.usuario, ps),
        )

    async def update_psicologo(self, psicologo_id: UUID, data: AdminPsychologistPutRequest) -> PsychologistMeResponse:
        ps = await self._clinical.get_psicologo_por_id(psicologo_id)
        if ps is None or ps.usuario.role != UserRole.psychologist:
            raise NotFoundError("Psicólogo não encontrado.")
        u = ps.usuario
        if data.email is not None or data.name is not None or data.phone is not None:
            await self._users.update_admin_contact(
                u.id,
                name=data.name if data.name is not None else None,
                phone=data.phone if data.phone is not None else None,
                email=str(data.email) if data.email is not None else None,
            )
        await self._clinical.update_psicologo_perfil(
            u.id,
            crp=data.crp,
            bio=data.bio,
            foto_url=data.foto_url,
            especialidades=data.especialidades,
            valor_sessao_padrao=data.valor_sessao_padrao,
            duracao_minutos_padrao=data.duracao_minutos_padrao,
        )
        ps2 = await self._clinical.get_psicologo_por_id(psicologo_id)
        assert ps2 is not None
        return PsychologistMeResponse(
            user=UserResponse.model_validate(ps2.usuario),
            psicologo=PsicologoProfileResponse.model_validate(ps2),
            professional_profile_complete=is_professional_profile_complete(ps2.usuario, ps2),
        )

    async def patch_psicologo_status(self, psicologo_id: UUID, body: AdminPsychologistStatusPatchRequest) -> PsychologistMeResponse:
        ps = await self._clinical.get_psicologo_por_id(psicologo_id)
        if ps is None or ps.usuario.role != UserRole.psychologist:
            raise NotFoundError("Psicólogo não encontrado.")
        await self._users.set_is_active(ps.usuario.id, is_active=body.ativo)
        ps2 = await self._clinical.get_psicologo_por_id(psicologo_id)
        assert ps2 is not None
        return PsychologistMeResponse(
            user=UserResponse.model_validate(ps2.usuario),
            psicologo=PsicologoProfileResponse.model_validate(ps2),
            professional_profile_complete=is_professional_profile_complete(ps2.usuario, ps2),
        )

    async def update_paciente(self, paciente_id: UUID, data: AdminPatientPutRequest) -> PatientMeResponse:
        p = await self._clinical.get_paciente_por_id(paciente_id)
        if p is None or p.usuario.role != UserRole.patient:
            raise NotFoundError("Paciente não encontrado.")
        raw = data.model_dump()
        email = raw.pop("email", None)
        if email is not None:
            await self._users.update_admin_contact(
                p.usuario_id,
                name=raw["name"],
                phone=raw["phone"],
                email=str(email),
            )
        else:
            await self._users.update_name_phone(p.usuario_id, name=raw["name"], phone=raw["phone"])
        paciente_updates = {k: raw[k] for k in ClinicalRepository._PACIENTE_UPDATE_FIELDS if k in raw}
        pac = await self._clinical.upsert_paciente_perfil(p.usuario_id, paciente_updates)
        u = await self._users.get_by_id(p.usuario_id)
        assert u is not None
        return PatientMeResponse(user=UserResponse.model_validate(u), paciente=PacienteProfileResponse.model_validate(pac))

    async def get_paciente_detalhe(self, paciente_id: UUID) -> AdminPacienteHistoricoResponse:
        p = await self._clinical.get_paciente_por_id(paciente_id)
        if p is None or p.usuario.role != UserRole.patient:
            raise NotFoundError("Paciente não encontrado.")
        todas = await self._clinical.list_consultas_paciente_todas(paciente_id)
        now = datetime.now(CLINIC_TZ)

        def start_dt(c: Consulta) -> datetime:
            t = c.hora_inicio
            return datetime.combine(c.data_agendada, t, tzinfo=CLINIC_TZ)

        futuras: list[AdminPacienteHistoricoConsulta] = []
        realizadas: list[AdminPacienteHistoricoConsulta] = []
        for c in todas:
            item = AdminPacienteHistoricoConsulta(
                id=c.id,
                data_agendada=c.data_agendada,
                hora_inicio=c.hora_inicio.strftime("%H:%M"),
                psicologo_nome=c.psicologo.usuario.name.strip() if c.psicologo and c.psicologo.usuario else "—",
                status=c.status.value,
                situacao_pagamento=c.situacao_pagamento.value,
            )
            if c.status == ConsultaStatus.cancelada:
                continue
            if c.status in (ConsultaStatus.realizada, ConsultaStatus.nao_compareceu):
                realizadas.append(item)
            elif start_dt(c) >= now:
                futuras.append(item)
            else:
                realizadas.append(item)

        pag_rows: list[AdminPagamentoListItem] = []
        for c in todas:
            if c.cobranca is None:
                continue
            ch = c.cobranca
            pag_rows.append(
                AdminPagamentoListItem(
                    id=ch.id,
                    consulta_id=c.id,
                    paciente_id=p.id,
                    paciente_nome=p.usuario.name.strip(),
                    valor_centavos=ch.valor_centavos,
                    moeda=ch.moeda,
                    forma_pagamento=_format_gateway_label(ch.provedor_gateway),
                    status_gateway=ch.status_gateway.value,
                    criado_em=ch.criado_em,
                    pago_em=ch.pago_em,
                )
            )

        base = PatientMeResponse(
            user=UserResponse.model_validate(p.usuario),
            paciente=PacienteProfileResponse.model_validate(p),
        )
        return AdminPacienteHistoricoResponse(
            paciente=base,
            consultas_realizadas=sorted(realizadas, key=lambda x: (x.data_agendada, x.hora_inicio), reverse=True),
            consultas_futuras=sorted(futuras, key=lambda x: (x.data_agendada, x.hora_inicio)),
            pagamentos=pag_rows,
        )

    def _consulta_item(self, c: Consulta) -> AdminConsultaListItem:
        gateway = c.cobranca.status_gateway.value if c.cobranca else None
        return AdminConsultaListItem(
            id=c.id,
            paciente_id=c.paciente_id,
            paciente_nome=c.paciente.usuario.name.strip() if c.paciente and c.paciente.usuario else "—",
            psicologo_id=c.psicologo_id,
            psicologo_nome=c.psicologo.usuario.name.strip() if c.psicologo and c.psicologo.usuario else "—",
            data_agendada=c.data_agendada,
            hora_inicio=c.hora_inicio.strftime("%H:%M"),
            modalidade=c.modalidade.value,
            status_consulta=c.status.value,
            status_pagamento_consulta=c.situacao_pagamento.value,
            status_gateway=gateway,
        )

    def _consulta_detail(self, c: Consulta) -> AdminConsultaDetailResponse:
        cob = c.cobranca
        cob_dict = None
        if cob is not None:
            cob_dict = {
                "id": str(cob.id),
                "valor_centavos": cob.valor_centavos,
                "status_gateway": cob.status_gateway.value,
                "provedor": cob.provedor_gateway,
                "pago_em": cob.pago_em.isoformat() if cob.pago_em else None,
            }
        return AdminConsultaDetailResponse(
            id=c.id,
            paciente={
                "id": str(c.paciente_id),
                "nome": c.paciente.usuario.name if c.paciente and c.paciente.usuario else "",
                "email": str(c.paciente.usuario.email) if c.paciente and c.paciente.usuario else "",
            },
            psicologo={
                "id": str(c.psicologo_id),
                "nome": c.psicologo.usuario.name if c.psicologo and c.psicologo.usuario else "",
                "crp": c.psicologo.crp if c.psicologo else "",
            },
            data_agendada=c.data_agendada,
            hora_inicio=c.hora_inicio.strftime("%H:%M"),
            duracao_minutos=c.duracao_minutos,
            modalidade=c.modalidade.value,
            status=c.status.value,
            situacao_pagamento=c.situacao_pagamento.value,
            valor_acordado=c.valor_acordado,
            especialidade_atendida=c.especialidade_atendida,
            observacoes=c.observacoes,
            link_videochamada_opcional=c.link_videochamada_opcional,
            cobranca=cob_dict,
        )

    async def list_consultas(
        self,
        *,
        skip: int,
        limit: int,
        data_inicio: date | None,
        data_fim: date | None,
        paciente_id: UUID | None,
        psicologo_id: UUID | None,
        status: ConsultaStatus | None,
    ) -> AdminConsultaListResponse:
        total = await self._clinical.count_consultas_admin_filtrado(
            data_inicio=data_inicio,
            data_fim=data_fim,
            paciente_id=paciente_id,
            psicologo_id=psicologo_id,
            status=status,
        )
        rows = await self._clinical.list_consultas_admin(
            skip=skip,
            limit=limit,
            data_inicio=data_inicio,
            data_fim=data_fim,
            paciente_id=paciente_id,
            psicologo_id=psicologo_id,
            status=status,
        )
        return AdminConsultaListResponse(
            items=[self._consulta_item(c) for c in rows],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def get_consulta(self, consulta_id: UUID) -> AdminConsultaDetailResponse:
        c = await self._clinical.get_consulta_admin_por_id(consulta_id)
        if c is None:
            raise NotFoundError("Consulta não encontrada.")
        return self._consulta_detail(c)

    async def cancelar_consulta(
        self,
        consulta_id: UUID,
        body: AdminConsultaCancelarRequest,
    ) -> AdminConsultaCancelarResponse:
        c = await self._clinical.get_consulta_admin_por_id(consulta_id)
        if c is None:
            raise NotFoundError("Consulta não encontrada.")
        if c.status in (ConsultaStatus.cancelada, ConsultaStatus.realizada):
            raise ConflictError("Consulta não pode ser cancelada neste estado.")

        c.status = ConsultaStatus.cancelada
        if body.motivo:
            note = f"\n[CANCELADO ADMIN] {body.motivo.strip()}"
            c.observacoes = (c.observacoes or "") + note
        if c.cobranca is not None and c.cobranca.status_gateway == CobrancaStatusGateway.awaiting_payment:
            c.cobranca.status_gateway = CobrancaStatusGateway.failed
        await self._clinical.save_consulta(c)
        c2 = await self._clinical.get_consulta_admin_por_id(consulta_id)
        assert c2 is not None
        notice = self._notify_consulta_change(c2, titulo="Consulta cancelada", msg="A consulta foi cancelada pela administração.")
        return AdminConsultaCancelarResponse(consulta=self._consulta_detail(c2), notice=notice)

    async def remarcar_consulta(self, consulta_id: UUID, body: AdminConsultaRemarcarRequest) -> AdminConsultaRemarcarResponse:
        c = await self._clinical.get_consulta_admin_por_id(consulta_id)
        if c is None:
            raise NotFoundError("Consulta não encontrada.")
        if c.status in (ConsultaStatus.cancelada, ConsultaStatus.realizada, ConsultaStatus.nao_compareceu):
            raise ConflictError("Consulta não pode ser remarcada neste estado.")
        try:
            hh, mm = body.hora_inicio.strip().split(":")
            nova_hora = time(int(hh), int(mm))
        except Exception as exc:
            raise ConflictError("hora_inicio deve estar no formato HH:MM.") from exc

        conflict = await self._clinical.existe_consulta_conflitante_no_horario(
            psicologo_id=c.psicologo_id,
            data_agendada=body.data_agendada,
            hora_inicio=nova_hora,
            excluir_consulta_id=c.id,
        )
        if conflict:
            raise ConflictError("Já existe consulta ativa para este profissional neste horário.")

        old_date = c.data_agendada.isoformat()
        old_time = c.hora_inicio.strftime("%H:%M")
        c.data_agendada = body.data_agendada
        c.hora_inicio = nova_hora
        c.observacoes = (c.observacoes or "") + f"\n[REMARCADO ADMIN] de {old_date} {old_time} para {body.data_agendada.isoformat()} {body.hora_inicio.strip()}."
        await self._clinical.save_consulta(c)
        c2 = await self._clinical.get_consulta_admin_por_id(consulta_id)
        assert c2 is not None
        notice = self._notify_consulta_change(
            c2,
            titulo="Consulta remarcada",
            msg="A data ou horário da consulta foi alterado pela administração.",
        )
        return AdminConsultaRemarcarResponse(consulta=self._consulta_detail(c2), notice=notice)

    def _notify_consulta_change(self, c: Consulta, *, titulo: str, msg: str) -> AdminOperationNotice:
        emails: list[str] = []
        if c.paciente and c.paciente.usuario:
            emails.append(str(c.paciente.usuario.email))
        if c.psicologo and c.psicologo.usuario:
            emails.append(str(c.psicologo.usuario.email))
        data_str = c.data_agendada.strftime("%d/%m/%Y")
        html = notify_consulta_alterada_html(
            titulo=titulo,
            alteracao=msg,
            paciente_nome=c.paciente.usuario.name if c.paciente and c.paciente.usuario else "—",
            profissional_nome=c.psicologo.usuario.name if c.psicologo and c.psicologo.usuario else "—",
            data_str=data_str,
            hora_str=c.hora_inicio.strftime("%H:%M"),
            modalidade=c.modalidade.value,
        )
        ok, err = send_resend_email(
            to_addresses=emails,
            subject=f"{titulo} — {data_str}",
            html_body=html,
        )
        return AdminOperationNotice(notificacoes_enviadas=ok, notificacoes_detalhe=err)

    async def list_pagamentos(
        self,
        *,
        skip: int,
        limit: int,
        status_gateway: CobrancaStatusGateway | None,
        data_inicio: date | None,
        data_fim: date | None,
        paciente_id: UUID | None,
        provedor: str | None,
    ) -> AdminPagamentoListResponse:
        total = await self._clinical.count_cobrancas_admin_filtrado(
            status_gateway=status_gateway,
            data_pagamento_inicio=data_inicio,
            data_pagamento_fim=data_fim,
            paciente_id=paciente_id,
            provedor=provedor,
        )
        rows = await self._clinical.list_cobrancas_admin(
            skip=skip,
            limit=limit,
            status_gateway=status_gateway,
            data_pagamento_inicio=data_inicio,
            data_pagamento_fim=data_fim,
            paciente_id=paciente_id,
            provedor=provedor,
        )
        items: list[AdminPagamentoListItem] = []
        for ch in rows:
            cons = ch.consulta
            pac = cons.paciente if cons else None
            nome = pac.usuario.name.strip() if pac and pac.usuario else "—"
            pid = pac.id if pac is not None else (cons.paciente_id if cons is not None else ch.consulta_id)
            items.append(
                AdminPagamentoListItem(
                    id=ch.id,
                    consulta_id=ch.consulta_id,
                    paciente_id=pid,
                    paciente_nome=nome,
                    valor_centavos=ch.valor_centavos,
                    moeda=ch.moeda,
                    forma_pagamento=_format_gateway_label(ch.provedor_gateway),
                    status_gateway=ch.status_gateway.value,
                    criado_em=ch.criado_em,
                    pago_em=ch.pago_em,
                )
            )
        return AdminPagamentoListResponse(items=items, total=total, skip=skip, limit=limit)

    async def get_pagamento(self, cobranca_id: UUID) -> AdminPagamentoDetailResponse:
        ch = await self._clinical.get_cobranca_admin_por_id(cobranca_id)
        if ch is None:
            raise NotFoundError("Cobrança não encontrada.")
        c = ch.consulta
        pac = c.paciente if c else None
        return AdminPagamentoDetailResponse(
            cobranca_id=ch.id,
            consulta_id=ch.consulta_id,
            valor_centavos=ch.valor_centavos,
            moeda=ch.moeda,
            forma_pagamento=_format_gateway_label(ch.provedor_gateway),
            provedor_gateway=ch.provedor_gateway,
            id_intent_gateway=ch.id_intent_gateway,
            status_gateway=ch.status_gateway.value,
            criado_em=ch.criado_em,
            pago_em=ch.pago_em,
            paciente={
                "id": str(pac.id) if pac else "",
                "nome": pac.usuario.name if pac and pac.usuario else "",
                "email": str(pac.usuario.email) if pac and pac.usuario else "",
            },
            consulta_resumo={
                "data": c.data_agendada.isoformat() if c else "",
                "hora": c.hora_inicio.strftime("%H:%M") if c else "",
                "status": c.status.value if c else "",
                "modalidade": c.modalidade.value if c else "",
            },
        )
