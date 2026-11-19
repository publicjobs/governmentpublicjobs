import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Search, Laptop, GraduationCap, HandHeart, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobCard } from "@/components/app/JobCard";
import { CATEGORIES, jobsQuery, meQuery, myApplicationsQuery, type Job } from "@/lib/queries";
import { COUNTIES } from "@/lib/kenya";
import { formatKsh } from "@/lib/pay";
import { cn } from "@/lib/utils";

type Search = { county?: string; cat?: string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    county: typeof s.county === "string" && COUNTIES.includes(s.county) ? s.county : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  loaderDeps: ({ search }) => ({ county: search.county }),
  loader: async ({ context, deps }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    const county = deps.county ?? me.profile?.county ?? "Nairobi";
    await Promise.all([
      context.queryClient.ensureQueryData(jobsQuery(county)),
      context.queryClient.ensureQueryData(myApplicationsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Jobs near you — Public Jobs Kenya" },
      { name: "description", content: "Browse jobs in your sub-county, county, online and professional roles." },
      { property: "og:title", content: "Jobs near you — Public Jobs Kenya" },
      { property: "og:description", content: "Jobs in your sub-county, online and professional roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const FILTERS = [
  { key: "all", label: "All jobs" },
  { key: "near", label: "Near me" },
  { key: "noqual", label: "No qualifications" },
  ...CATEGORIES.map((c) => ({ key: c, label: c })),
];

function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const { data: me } = useSuspenseQuery(meQuery);
  const homeCounty = me.profile?.county ?? "Nairobi";
  const county = search.county ?? homeCounty;
  const isHome = county === homeCounty;
  const { data: jobs } = useSuspenseQuery(jobsQuery(county));
  const { data: apps } = useSuspenseQuery(myApplicationsQuery);
  const [q, setQ] = useState("");
  const cat = search.cat ?? "all";
  const sub = me.profile?.sub_county ?? "";
  const expectedDaily = me.profile?.expected_daily_pay ?? null;
  const appliedIds = useMemo(() => new Set(apps.map((a) => a.job_id)), [apps]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (term && !`${j.title} ${j.employer} ${j.sub_county ?? ""} ${j.category}`.toLowerCase().includes(term)) return false;
      if (cat === "all") return true;
      if (cat === "near") return isHome && j.sub_county === sub;
      if (cat === "noqual") return !j.qualification_required;
      return j.category === cat;
    });
  }, [jobs, q, cat, isHome, sub]);

  const local = jobs.filter((j) => !j.is_online);
  const nearCount = isHome ? local.filter((j) => j.sub_county === sub).length : 0;
  const onlineCount = jobs.filter((j) => j.is_online).length;
  const noQualCount = jobs.filter((j) => !j.qualification_required).length;

  const sections: { title: string; subtitle: string; jobs: Job[] }[] =
    cat === "all" && !q.trim()
      ? [
          ...(isHome
            ? [{ title: `Right here in ${sub}`, subtitle: "Jobs in your own sub-county", jobs: local.filter((j) => j.sub_county === sub && j.category !== "Professional") }]
            : []),
          {
            title: isHome ? `More jobs across ${county}` : `Jobs in ${county} County`,
            subtitle: "Casual, full-time and part-time work, many need no papers",
            jobs: local.filter((j) => j.category !== "Professional" && (!isHome || j.sub_county !== sub)),
          },
          { title: "Online jobs", subtitle: "Work from home anywhere in Kenya", jobs: jobs.filter((j) => j.is_online) },
          { title: "Professional jobs", subtitle: `Roles for certificate, diploma and degree holders in ${county}`, jobs: local.filter((j) => j.category === "Professional") },
        ]
      : [{ title: `${filtered.length} jobs found`, subtitle: FILTERS.find((f) => f.key === cat)?.label ?? "", jobs: filtered }];

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <p className="text-sm font-medium text-primary-foreground/75">Habari, {me.profile?.first_name || "there"} 👋</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {isHome && nearCount > 0 ? (
              <>
                {nearCount} jobs open in <span className="text-highlight">{sub}</span>
              </>
            ) : (
              <>
                {local.length} jobs open in <span className="text-highlight">{county}</span>
              </>
            )}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-primary-foreground/80">
            <MapPin className="size-4" /> {isHome ? `${sub}, ${county} County` : `Browsing ${county} County`}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<MapPin />} label="In this county" value={local.length} />
            <Stat icon={<HandHeart />} label="No qualifications" value={noQualCount} />
            <Stat icon={<Laptop />} label="Online jobs" value={onlineCount} />
            <Stat icon={<Wallet />} label="Your daily target" value={expectedDaily ? formatKsh(expectedDaily) : "—"} />
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search waiter, driver, Kasarani…" className="pl-9" />
          </div>
          <Select value={county} onValueChange={(v) => navigate({ search: (s) => ({ ...s, county: v === homeCounty ? undefined : v }) })}>
            <SelectTrigger className="md:w-56" aria-label="Browse county"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {COUNTIES.map((c) => (
                <SelectItem key={c} value={c}>{c === homeCounty ? `${c} (my county)` : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          {FILTERS.filter((f) => f.key !== "near" || isHome).map((f) => (
            <button
              key={f.key}
              onClick={() => navigate({ search: (s) => ({ ...s, cat: f.key === "all" ? undefined : f.key }) })}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                cat === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.key === "Online" ? <Laptop className="mr-1 inline size-3.5" /> : null}
              {f.key === "Professional" ? <GraduationCap className="mr-1 inline size-3.5" /> : null}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-8">
        {sections.filter((s) => s.jobs.length > 0 || sections.length === 1).map((s) => (
          <section key={s.title}>
            <div className="mb-4">
              <h2 className="text-2xl font-bold">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.subtitle}</p>
            </div>
            {s.jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
                No jobs match that yet. Try another category or county.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.jobs.map((job) => (
                  <JobCard key={job.id} job={job} expectedDaily={expectedDaily} applied={appliedIds.has(job.id)} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 backdrop-blur [&_svg]:size-4">
      <div className="flex items-center gap-1.5 text-xs text-primary-foreground/75">{icon} {label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </div>
  );
}
