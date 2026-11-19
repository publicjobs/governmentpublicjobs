import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Briefcase, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";
import { Logo } from "./Logo";

export function AppHeader() {
  const { data: me } = useQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  const activeCls = "bg-secondary text-secondary-foreground";

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/dashboard" aria-label="Public Jobs Kenya home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/dashboard" className={linkCls} activeProps={{ className: activeCls }}>
            <Briefcase className="size-4" />
            <span className="hidden sm:inline">Jobs</span>
          </Link>
          <Link to="/applications" className={linkCls} activeProps={{ className: activeCls }}>
            <ClipboardList className="size-4" />
            <span className="hidden sm:inline">My applications</span>
          </Link>
          {me?.isAdmin ? (
            <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : null}
          <span className="mx-2 hidden h-6 w-px bg-border md:block" />
          <span className="hidden text-sm font-medium md:inline">{me?.profile?.first_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut />
          </Button>
        </nav>
      </div>
    </header>
  );
}
