import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPay } from "@/lib/pay";
import { locationLabel, myApplicationsQuery, STATUS_COPY } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/applications")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myApplicationsQuery),
  head: () => ({
    meta: [
      { title: "My applications — Public Jobs Kenya" },
      { name: "description", content: "Track every job you applied for and its status." },
      { property: "og:title", content: "My applications — Public Jobs Kenya" },
      { property: "og:description", content: "Track every job you applied for and its status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { data: apps } = useSuspenseQuery(myApplicationsQuery);
  const pending = apps.filter((a) => a.status === "pending").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">My applications</h1>
      <p className="mt-1 text-muted-foreground">
        {apps.length === 0 ? "You haven't applied for any job yet." : `${apps.length} applied · ${pending} pending`}
      </p>

      {pending > 0 ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning bg-warning/40 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
          <p className="text-sm text-warning-foreground">
            <span className="font-semibold">Pending</span> — wait for response within 2 business days. Keep your phone on, employers may call you.
          </p>
        </div>
      ) : null}

      {apps.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed bg-card p-10 text-center">
          <p className="text-muted-foreground">Find a job you like and apply in one tap.</p>
          <Button asChild variant="hero" className="mt-4"><Link to="/dashboard">Browse jobs</Link></Button>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {apps.map((a) => {
            const s = STATUS_COPY[a.status] ?? STATUS_COPY.pending;
            const job = a.jobs;
            return (
              <li key={a.id} className="animate-rise rounded-2xl border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {job ? (
                      <Link to="/jobs/$jobId" params={{ jobId: job.id }} className="text-lg font-semibold hover:text-primary">
                        {job.title}
                      </Link>
                    ) : (
                      <span className="text-lg font-semibold">Job removed</span>
                    )}
                    <p className="text-sm text-muted-foreground">{job?.employer}</p>
                  </div>
                  <Badge variant={s.variant} className="text-sm">{s.label}</Badge>
                </div>
                {job ? (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" /> {locationLabel(job)}</span>
                    <span className="font-semibold">{formatPay(job.pay_amount, job.pay_period)}</span>
                    <span className="text-muted-foreground">Applied {format(new Date(a.created_at), "d MMM yyyy, h:mm a")}</span>
                  </div>
                ) : null}
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">{s.note}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
