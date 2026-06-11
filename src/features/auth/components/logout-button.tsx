import { LogOut } from "lucide-react";

import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline">
        <LogOut aria-hidden />
        Se déconnecter
      </Button>
    </form>
  );
}
