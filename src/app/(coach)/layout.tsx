import { AppShell } from "@/components/navigation/app-shell";

/** Coquille de l'espace coach — navigation adaptative B4 (rôle garanti par le proxy, RG-03). */
export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="coach">{children}</AppShell>;
}
