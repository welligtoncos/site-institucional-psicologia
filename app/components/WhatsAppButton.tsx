import { siteConfig } from "../lib/site";

export function WhatsAppButton() {
  return (
    <a
      href={siteConfig.whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:bottom-6 sm:right-6"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">WA</span>
      WhatsApp
    </a>
  );
}
