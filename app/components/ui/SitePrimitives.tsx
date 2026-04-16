import Link from "next/link";

type ContainerProps = {
  className?: string;
  children: React.ReactNode;
};

type SectionProps = {
  id?: string;
  className?: string;
  children: React.ReactNode;
};

type ActionLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

const baseContainer = "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8";
const baseSection = "py-16 sm:py-20 lg:py-24";
const baseButton = "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition";

export function Container({ className = "", children }: ContainerProps) {
  return <div className={`${baseContainer} ${className}`.trim()}>{children}</div>;
}

export function Section({ id, className = "", children }: SectionProps) {
  return (
    <section id={id} className={`${baseSection} ${className}`.trim()}>
      {children}
    </section>
  );
}

export function ActionLink({ href, children, variant = "primary", className = "" }: ActionLinkProps) {
  const variantClass =
    variant === "primary"
      ? "bg-sky-600 text-white shadow-sm shadow-sky-600/25 hover:bg-sky-700"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100";

  return (
    <Link href={href} className={`${baseButton} ${variantClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}
