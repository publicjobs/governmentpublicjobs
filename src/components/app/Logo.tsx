import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-lg font-bold", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-sun text-highlight-foreground shadow-card">
        <Briefcase className="size-5" />
      </span>
      <span className={onDark ? "text-primary-foreground" : "text-foreground"}>
        Public Jobs <span className={onDark ? "text-highlight" : "text-primary"}>Kenya</span>
      </span>
    </span>
  );
}
