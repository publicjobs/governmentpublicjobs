import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { MapPin, Users, CheckCircle2, Sparkles, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPay, meetsExpectedPay } from "@/lib/pay";
import { locationLabel, type Job } from "@/lib/queries";

export function JobCard({
  job,
  expectedDaily,
  applied,
}: {
  job: Job;
  expectedDaily?: number | null;
  applied?: boolean;
}) {
  const goodPay = meetsExpectedPay(job.pay_amount, job.pay_period, expectedDaily);
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{job.category}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
            {job.title}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{job.employer}</p>
        </div>
        {applied ? (
          <Badge variant="success" className="shrink-0 gap-1">
            <CheckCircle2 className="size-3" /> Applied
          </Badge>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <MapPin className="size-4 shrink-0 text-primary" />
        {locationLabel(job)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-secondary px-2.5 py-1 font-display text-base font-bold text-secondary-foreground">
          {formatPay(job.pay_amount, job.pay_period)}
        </span>
        <Badge variant="outline">{job.job_type}</Badge>
        {!job.qualification_required ? <Badge variant="highlight">No qualifications needed</Badge> : null}
        {goodPay ? (
          <Badge variant="success" className="gap-1">
            <Sparkles className="size-3" /> Meets your pay
          </Badge>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {job.positions} {job.positions === 1 ? "position" : "positions"}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
        </span>
      </div>
    </Link>
  );
}
