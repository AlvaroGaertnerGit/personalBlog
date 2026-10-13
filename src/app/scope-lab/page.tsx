import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Scope3DLab } from "./scope-3d-lab";

export const metadata: Metadata = {
  title: "Scope 3D lab",
  robots: { index: false, follow: false },
};

// Development-only laboratory for reviewing the Scope 3D model, its 12 baked
// clips and the autonomous behaviour state machine in a real WebGL viewer
// before Scope 3D is integrated anywhere. The production companion is still
// the 2D Scope (src/components/scope/); nothing here touches it.
export default function Scope3DLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Scope3DLab />;
}
