import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Briefcase, Building2, CalendarDays, CheckCircle2, Loader2, MapPin, ShieldCheck, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatPay, meetsExpectedPay } from "@/lib/pay";
import { jobQuery, locationLabel, meQuery, myApplicationsQuery, STATUS_COPY } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  loader: async ({ context, params }) => {
    const [job] = await Promise.all([
      context.queryClient.ensureQueryData(jobQuery(params.jobId)),
      context.queryClient.ensureQueryData(myApplicationsQuery),
      context.queryClient.ensureQueryData(meQuery),
    ]);
    if (!job) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Job details — Public Jobs Kenya" },
      { name: "description", content: "See pay, location and requirements, then apply in one tap." },
      { property: "og:title", content: "Job details — Public Jobs Kenya" },
      { property: "og:description", content: "See pay, location and requirements, then apply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">This job is no longer available</h1>
      <Button asChild className="mt-6"><Link to="/dashboard">Back to jobs</Link></Button>
    </div>
  ),
  component: JobPage,
});

function JobPage() {
  const { jobId } = Route.useParams();
  const { data: job } = useSuspenseQuery(jobQuery(jobId));
  const { data: apps } = useSuspenseQuery(myApplicationsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!job) return null;
  const existing = apps.find((a) => a.job_id === job.id);
  const goodPay = meetsExpectedPay(job.pay_amount, job.pay_period, me.profile?.expected_daily_pay);

  async function apply() {
    if (!job) return;
    setSubmitting(true);
    const { error } = await supabase.from("applications").insert({
      job_id: job.id,
      user_id: me.userId,
      cover_note: note.trim().slice(0, 1000) || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.code === "23505" ? "You already applied for this job." : "Could not send your application. Try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    toast.success("Application sent! Wait for response within 2 business days.");
    navigate({ to: "/applications" });
  }

  const facts = [
    { icon: <MapPin />, label: "Location", value: locationLabel(job) },
    { icon: <Wallet />, label: "Pay", value: formatPay(job.pay_amount, job.pay_period) },
    { icon: <Briefcase />, label: "Job type", value: job.job_type },
    { icon: <Users />, label: "Positions", value: String(job.positions) },
    { icon: <CalendarDays />, label: "Posted", value: format(new Date(job.created_at), "d MMM yyyy") },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All jobs
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft">{job.category}</Badge>
            {!job.qualification_required ? <Badge variant="highlight">No qualifications needed</Badge> : null}
            {goodPay ? <Badge variant="success">Meets your expected pay</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-bold">{job.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground"><Building2 className="size-4" /> {job.employer}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl bg-surface p-3 [&_svg]:size-4">
                <span className="mt-0.5 text-primary">{f.icon}</span>
                <div>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="font-semibold">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <h2 className="mt-8 text-xl font-bold">What you will do</h2>
          <p className="mt-2 leading-relaxed text-foreground/90">{job.description}</p>

          <h2 className="mt-6 text-xl font-bold">Requirements</h2>
          <p className="mt-2 leading-relaxed text-foreground/90">{job.requirements}</p>
        </article>

        <aside className="h-fit rounded-2xl border bg-card p-6 shadow-card lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">Pay</p>
          <p className="font-display text-3xl font-bold text-primary">{formatPay(job.pay_amount, job.pay_period)}</p>

          {existing ? (
            <div className="mt-5 rounded-xl bg-surface p-4">
              <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-success" /> You applied</p>
              <Badge variant={STATUS_COPY[existing.status]?.variant ?? "warning"} className="mt-2">
                {STATUS_COPY[existing.status]?.label ?? existing.status}
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">{STATUS_COPY[existing.status]?.note}</p>
              <Button asChild variant="outline" className="mt-4 w-full"><Link to="/applications">View my applications</Link></Button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <label className="text-sm font-medium" htmlFor="note">Short message to employer (optional)</label>
              <Textarea id="note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I have 2 years experience as a waiter in Roysambu and can start Monday." rows={4} />
              <Button variant="hero" size="lg" className="w-full" onClick={apply} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null} Apply now
              </Button>
              <p className="text-xs text-muted-foreground">
                Your name, phone and location are shared with the employer.
              </p>
            </div>
          )}
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> Applying is free. Never pay anyone to get a job.
          </p>
        </aside>
      </div>
    </main>
  );
}
