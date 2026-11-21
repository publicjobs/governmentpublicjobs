import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PostJobForm } from "@/components/app/PostJobForm";
import { meQuery, myPostedJobsQuery, locationLabel } from "@/lib/queries";
import { formatPay } from "@/lib/pay";

export const Route = createFileRoute("/_authenticated/post-job")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(meQuery),
      context.queryClient.ensureQueryData(myPostedJobsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Post a job — Public Jobs Kenya" },
      { name: "description", content: "Hiring? Post a job free and reach job seekers in your county." },
      { property: "og:title", content: "Post a job — Public Jobs Kenya" },
      { property: "og:description", content: "Post a job free and reach job seekers near you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostJobPage,
});

const REVIEW = {
  pending: { label: "Waiting for review", variant: "warning" as const },
  approved: { label: "Live", variant: "success" as const },
  rejected: { label: "Not approved", variant: "destructive" as const },
};

function PostJobPage() {
  const { data: jobs } = useSuspenseQuery(myPostedJobsQuery);

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <PostJobForm />

      <aside>
        <h2 className="text-xl font-bold">Jobs you posted</h2>
        {jobs.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
            You haven't posted any jobs yet. Jobs you submit show up here with their review status.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {jobs.map((j) => {
              const r = REVIEW[j.review_status as keyof typeof REVIEW] ?? REVIEW.pending;
              const count = j.applications?.[0]?.count ?? 0;
              return (
                <li key={j.id} className="rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    {j.is_active ? (
                      <Link to="/jobs/$jobId" params={{ jobId: j.id }} className="font-semibold hover:text-primary">{j.title}</Link>
                    ) : (
                      <span className="font-semibold">{j.title}</span>
                    )}
                    <Badge variant={r.variant} className="shrink-0">{r.label}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {locationLabel(j)}</p>
                  <p className="mt-1 text-sm font-semibold">{formatPay(j.pay_amount, j.pay_period)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Posted {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                    {j.review_status === "approved" ? ` · ${count} ${count === 1 ? "applicant" : "applicants"}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </main>
  );
}
