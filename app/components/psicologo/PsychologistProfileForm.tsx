"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";

const ACCESS_TOKEN_KEY = "portal_access_token";

const fieldClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-inner shadow-slate-900/5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 [color-scheme:light]";

function parseEspecialidades(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinEspecialidades(tags: string[]): string {
  return tags.join(", ");
}

/** Comprime para data URL JPEG e limita tamanho (backend aceita até ~600k caracteres). */
async function fileToCompressedDataUrl(file: File, maxChars = 480_000): Promise<string> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;
  const maxDim = 720;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(img, 0, 0, w, h);
  let q = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > maxChars && q > 0.32) {
    q -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUrl.length > maxChars) {
    throw new Error("Imagem ainda grande demais. Tente outra foto ou uma imagem menor.");
  }
  return dataUrl;
}

type ProfileJson = {
  detail?: unknown;
  professional_profile_complete?: boolean;
  user?: { name: string; phone: string; email: string };
  psicologo?: {
    crp: string;
    bio: string;
    foto_url: string | null;
    especialidades: string | null;
    valor_sessao_padrao: string;
    duracao_minutos_padrao: number;
  };
};

function ProfileAttentionBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/90 p-4 shadow-lg shadow-amber-900/10 ring-2 ring-amber-300/60"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
      <div className="relative flex gap-3 sm:gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-white shadow-md ring-2 ring-amber-600/30"
          aria-hidden
        >
          !
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-950">Perfil profissional pendente</p>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-950/95">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function PsychologistProfileForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [crp, setCrp] = useState("");
  const [bio, setBio] = useState("");
  const [valor, setValor] = useState("");
  const [duracao, setDuracao] = useState("50");
  const [fotoUrl, setFotoUrl] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState<string | null>(null);
  const [headerShowsComplete, setHeaderShowsComplete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAttentionMessage(null);
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    try {
      const response = await fetch("/api/portal/profile/psychologist", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await response.json()) as ProfileJson;
      if (!response.ok) {
        throw new Error(formatApiErrorDetail(json, "Não foi possível carregar seu perfil."));
      }
      const u = json.user;
      const p = json.psicologo;
      if (!u || !p) {
        throw new Error("Resposta incompleta do servidor.");
      }
      setName(u.name ?? "");
      setPhone(u.phone ?? "");
      setCrp(p.crp ?? "");
      setBio(p.bio ?? "");
      setValor(p.valor_sessao_padrao != null ? String(p.valor_sessao_padrao) : "");
      setDuracao(String(p.duracao_minutos_padrao ?? 50));
      setFotoUrl(p.foto_url ?? "");
      setSpecialties(parseEspecialidades(p.especialidades));
      const complete = json.professional_profile_complete === true;
      setHeaderShowsComplete(complete);
      if (!complete) {
        setAttentionMessage(
          "Para concluir: nome completo, CRP, biografia (mín. 10 caracteres), valor da sessão maior que zero, foto e ao menos uma especialidade.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar perfil.");
      setHeaderShowsComplete(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePhotoFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const url = await fileToCompressedDataUrl(file);
      setFotoUrl(url);
      toast.success("Foto processada. Salve o perfil para enviar ao servidor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar imagem.");
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || specialties.includes(t)) return;
    setSpecialties([...specialties, t]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setSpecialties(specialties.filter((s) => s !== tag));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      toast.error("Sessão expirada.");
      return;
    }
    const valorNum = parseFloat(valor.replace(",", "."));
    if (Number.isNaN(valorNum) || valorNum <= 0) {
      toast.error("Informe um valor de sessão válido (maior que zero).");
      return;
    }
    const duracaoNum = parseInt(duracao, 10);
    if (Number.isNaN(duracaoNum) || duracaoNum < 15 || duracaoNum > 240) {
      toast.error("Duração deve ser entre 15 e 240 minutos.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        crp: crp.trim(),
        bio: bio.trim(),
        valor_sessao_padrao: valorNum,
        duracao_minutos_padrao: duracaoNum,
        foto_url: fotoUrl.trim() || null,
        especialidades: joinEspecialidades(specialties),
      };

      const response = await fetch("/api/portal/profile/psychologist", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as ProfileJson;
      if (!response.ok) {
        throw new Error(formatApiErrorDetail(json, "Não foi possível salvar."));
      }
      toast.success("Perfil salvo.");
      if (json.professional_profile_complete === true) {
        setHeaderShowsComplete(true);
        setAttentionMessage(null);
      } else {
        setHeaderShowsComplete(false);
        setAttentionMessage(
          "Alguns itens ainda faltam para o perfil profissional completo: verifique nome, CRP, biografia (10+ caracteres), valor, foto e especialidades.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-sm text-slate-600">
        Carregando perfil…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Perfil profissional</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {headerShowsComplete ? "Meu perfil profissional" : "Completar perfil profissional"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          CRP, biografia, valor da sessão, duração, foto e especialidades são usados no portal do paciente e na clínica.
        </p>
      </section>

      {attentionMessage ? <ProfileAttentionBanner message={attentionMessage} /> : null}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Nome completo</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 ${fieldClassName}`}
              placeholder="Nome como aparece para pacientes"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Telefone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`mt-1 ${fieldClassName}`}
              placeholder="DDD + número"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">CRP</span>
            <input
              required
              value={crp}
              onChange={(e) => setCrp(e.target.value)}
              className={`mt-1 ${fieldClassName}`}
              placeholder="Ex.: 06/123456"
            />
          </label>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400"
              style={
                fotoUrl
                  ? { backgroundImage: `url(${fotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : undefined
              }
            >
              {!fotoUrl ? <span className="text-center text-xs px-2">Sem foto</span> : null}
            </div>
            <label className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100">
              Escolher foto
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhotoFile(e.target.files?.[0] ?? null)} />
            </label>
            {fotoUrl ? (
              <button
                type="button"
                onClick={() => setFotoUrl("")}
                className="text-xs text-slate-500 underline hover:text-slate-800"
              >
                Remover foto
              </button>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Valor da sessão (R$)</span>
              <input
                required
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`mt-1 ${fieldClassName}`}
                placeholder="190"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Duração padrão (minutos)</span>
              <input
                required
                type="number"
                min={15}
                max={240}
                value={duracao}
                onChange={(e) => setDuracao(e.target.value)}
                className={`mt-1 ${fieldClassName}`}
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-600">Biografia</span>
          <textarea
            required
            minLength={10}
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={`mt-1 ${fieldClassName}`}
            placeholder="Formação, linhas de trabalho e público atendido (mínimo 10 caracteres)."
          />
        </label>

        <div>
          <span className="text-xs font-medium text-slate-600">Especialidades</span>
          <p className="mt-0.5 text-xs text-slate-500">Adicione ao menos uma especialidade para o perfil completo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-900"
              >
                {s}
                <button type="button" onClick={() => removeTag(s)} className="text-emerald-700 hover:text-rose-600" aria-label={`Remover ${s}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className={`min-w-0 flex-1 ${fieldClassName}`}
              placeholder="Digite e pressione Enter"
            />
            <button
              type="button"
              onClick={addTag}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
