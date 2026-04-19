import type { Metadata } from "next";

import { PsychologistAuthShell } from "@/app/components/auth/PsychologistAuthShell";
import { PsychologistLiveSessionBoard } from "@/app/components/psicologo/PsychologistLiveSessionBoard";

type PageProps = { params: Promise<{ roomRef: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { roomRef } = await params;
  const decoded = decodeURIComponent(roomRef);
  return {
    title: `Sala · ${decoded}`,
    robots: { index: false, follow: false },
  };
}

export default async function PsicologoSessaoSalaPage({ params }: PageProps) {
  const { roomRef } = await params;
  const decoded = decodeURIComponent(roomRef);

  return (
    <PsychologistAuthShell>
      <PsychologistLiveSessionBoard lockedRoomRef={decoded} />
    </PsychologistAuthShell>
  );
}
