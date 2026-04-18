"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return <Toaster position="top-center" richColors closeButton duration={3500} />;
}
