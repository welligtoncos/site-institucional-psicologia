import { Container } from "../ui/SitePrimitives";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-100/60 via-white to-slate-50" />
      <Container className="py-14 sm:py-16 lg:py-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 sm:text-sm">
          {eyebrow}
        </p>
        <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {description}
        </p>
      </Container>
    </section>
  );
}
