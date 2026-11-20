import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Copy, MessageCircle, UserPlus, CalendarDays, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meQuery } from "@/lib/queries";
import { inviteLink, referralsByDay } from "@/lib/referrals";

const myReferralsQuery = queryOptions({
  queryKey: ["my-referrals"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_referrals");
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/referrals")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(meQuery),
      context.queryClient.ensureQueryData(myReferralsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Invite friends — Public Jobs Kenya" },
      { name: "description", content: "Share your invite link and see the friends who joined each day." },
      { property: "og:title", content: "Invite friends — Public Jobs Kenya" },
      { property: "og:description", content: "Share your invite link and track friends who joined." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: referrals } = useSuspenseQuery(myReferralsQuery);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const code = me.profile?.referral_code ?? "";
  const link = origin && code ? inviteLink(origin, code) : "";
  const days = useMemo(() => referralsByDay(referrals.map((r) => r.joined_at), 14), [referrals]);
  const today = days[0]?.count ?? 0;
  const week = days.slice(0, 7).reduce((n, d) => n + d.count, 0);
  const shareText = `Looking for work? Public Jobs Kenya has jobs in every county, many need no qualifications. Join free here: ${link}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  }

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-4 py-10">
          <p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/75"><UserPlus className="size-4" /> Invite friends</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Help a friend find work</h1>
          <p className="mt-2 max-w-xl text-primary-foreground/80">
            Share your personal link. Every friend who creates an account with it shows up below, day by day.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} aria-label="Your invite link" className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground" />
            <Button variant="hero" onClick={copy} disabled={!link}><Copy /> Copy link</Button>
            <Button asChild variant="onDark">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
            </Button>
          </div>
          <p className="mt-2 text-xs text-primary-foreground/70">Your code: <span className="font-mono font-semibold">{code}</span></p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-4 pt-8">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<CalendarDays />} label="Joined today" value={today} />
          <Stat icon={<TrendingUp />} label="Last 7 days" value={week} />
          <Stat icon={<Users />} label="All time" value={referrals.length} />
        </div>

        <section>
          <h2 className="text-xl font-bold">Daily referrals</h2>
          <p className="text-sm text-muted-foreground">Friends who joined with your link, last 14 days</p>
          <ul className="mt-4 divide-y rounded-2xl border bg-card shadow-card">
            {days.map((d, i) => (
              <li key={d.key} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm">{i === 0 ? "Today" : i === 1 ? "Yesterday" : format(d.date, "EEE, d MMM")}</span>
                <span className={d.count > 0 ? "rounded-full bg-success/15 px-3 py-0.5 text-sm font-semibold text-success" : "text-sm text-muted-foreground"}>
                  {d.count} {d.count === 1 ? "friend" : "friends"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">Friends who joined</h2>
          {referrals.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
              No one has joined with your link yet. Share it on WhatsApp to get started.
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {referrals.map((r, i) => (
                <li key={`${r.joined_at}-${i}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary font-display font-bold text-secondary-foreground">
                    {r.first_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{r.first_name} {r.last_initial}.</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.sub_county ? `${r.sub_county}, ` : ""}{r.county} · joined {formatDistanceToNow(new Date(r.joined_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card [&_svg]:size-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="text-primary">{icon}</span> {label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
