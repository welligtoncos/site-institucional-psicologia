/**
 * Mesmo “chassi” visual de /portal/atendimento: fundo em degradê sky + borda suave,
 * para psicólogo e paciente enxergarem o mesmo layout na experiência de sessão ao vivo.
 */
export default function PsicologoSessaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 via-slate-50/90 to-white p-5 shadow-sm sm:p-6 lg:p-8">
      {children}
    </div>
  );
}
