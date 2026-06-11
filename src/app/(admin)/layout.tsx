import { AppShell } from "@/components/navigation/app-shell";

/** Coquille de l'espace admin — navigation adaptative B4 (rôle garanti par le proxy + exigerSuperAdmin). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="admin">{children}</AppShell>;
}
