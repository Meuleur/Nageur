import { AppShell } from "@/components/navigation/app-shell";

/** Coquille de l'espace nageur — navigation adaptative B4 (rôle garanti par le proxy, RG-03). */
export default function NageurLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="nageur">{children}</AppShell>;
}
