import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { settingsFromQuery } from "../preview-protocol";
import { Scope3DWebPreview } from "./scope-3d-web-preview";

export const metadata: Metadata = {
  title: "Scope 3D web preview",
  robots: { index: false, follow: false },
};

// Dev-only: Scope 3D at real size in a simulation of the blog. Loaded inside
// /scope-lab's Web Preview iframe; also usable on its own, e.g.
// /scope-lab/preview?size=128&scene=about&theme=light on a phone.
export default async function Scope3DWebPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  return (
    <Scope3DWebPreview initialSettings={settingsFromQuery(query.toString())} />
  );
}
