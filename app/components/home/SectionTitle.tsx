type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: SectionTitleProps) {
  const isCentered = align === "center";

  return (
    <div
      className={`${isCentered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`.trim()}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 sm:text-sm">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
        {title}
      </h2>

      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}
