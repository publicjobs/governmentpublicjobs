import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Lock, Search, ShieldAlert, Users, ClipboardList, Clock, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminDataQuery, meQuery, STATUS_COPY } from "@/lib/queries";
import { formatKsh, formatPay } from "@/lib/pay";
import { PostJobForm } from "@/components/app/PostJobForm";

export const Route = createFileRoute("/_authenticated/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  head: () => ({
    meta: [
      { title: "Admin panel — Public Jobs Kenya" },
      { name: "description", content: "Manage job seekers and applications." },
      { property: "og:title", content: "Admin panel — Public Jobs Kenya" },
      { property: "og:description", content: "Manage job seekers and applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-muted-foreground">Your account doesn't have access to this page.</p>
        <Button asChild className="mt-6"><Link to="/dashboard">Back to jobs</Link></Button>
      </main>
    );
  }
  return <AdminContent />;
}

function AdminContent() {
  const { data, isLoading, error } = useQuery(adminDataQuery);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const appsByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of data?.applications ?? []) {
      const list = m.get(a.user_id) ?? [];
      if (a.jobs) list.push(a.jobs.title);
      m.set(a.user_id, list);
    }
    return m;
  }, [data]);

  const referralCounts = new Map<string, number>();
  for (const p of data?.profiles ?? []) {
    if (p.referred_by) referralCounts.set(p.referred_by, (referralCounts.get(p.referred_by) ?? 0) + 1);
  }

  if (isLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading admin data…</main>;
  if (error || !data) return <main className="mx-auto max-w-6xl px-4 py-10 text-destructive">Could not load admin data.</main>;

  const term = q.trim().toLowerCase();
  const profiles = data.profiles.filter((p) =>
    !term || `${p.first_name} ${p.last_name} ${p.email ?? ""} ${p.phone ?? ""} ${p.id_number ?? ""} ${p.county ?? ""} ${p.sub_county ?? ""}`.toLowerCase().includes(term),
  );
  const apps = data.applications.filter((a) =>
    !term || `${a.profiles?.first_name ?? ""} ${a.profiles?.last_name ?? ""} ${a.profiles?.phone ?? ""} ${a.jobs?.title ?? ""} ${a.jobs?.sub_county ?? ""}`.toLowerCase().includes(term),
  );
  const pending = data.applications.filter((a) => a.status === "pending").length;
  const contactable = data.profiles.filter((p) => p.allow_contact).length;

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error("Could not update status");
      return;
    }
    toast.success("Status updated");
    queryClient.invalidateQueries({ queryKey: ["admin-data"] });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold">Admin panel</h1>
      <p className="mt-1 text-muted-foreground">Everyone who signed up and every job they applied for.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Users />} label="Job seekers" value={data.profiles.length} />
        <StatCard icon={<ClipboardList />} label="Applications" value={data.applications.length} />
        <StatCard icon={<Clock />} label="Pending" value={pending} />
        <StatCard icon={<PhoneCall />} label="Allow contact" value={contactable} />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Passwords are stored scrambled, so nobody can see them, not even admins. Users can reset a forgotten password themselves.
      </p>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, ID, email, location or job…" className="pl-9" />
      </div>

      <Tabs defaultValue="applications" className="mt-6">
        <TabsList>
          <TabsTrigger value="applications">Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({profiles.length})</TabsTrigger>
          <TabsTrigger value="post">Post a job</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>ID number</TableHead>
                  <TableHead>Job applied for</TableHead>
                  <TableHead>Job location</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No applications yet.</TableCell></TableRow>
                ) : apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.profiles?.first_name} {a.profiles?.last_name}</div>
                      <div className="text-xs text-muted-foreground">{a.profiles?.email}</div>
                      {a.cover_note ? <div className="mt-1 max-w-xs text-xs italic text-muted-foreground">“{a.cover_note}”</div> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{a.profiles?.phone ?? "—"}</TableCell>
                    <TableCell>{a.profiles?.id_number ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.jobs?.title}</div>
                      <div className="text-xs text-muted-foreground">{a.jobs?.employer} · {a.jobs ? formatPay(a.jobs.pay_amount, a.jobs.pay_period) : ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{a.jobs?.sub_county ? `${a.jobs.sub_county}, ${a.jobs.county}` : a.jobs?.county}</TableCell>
                    <TableCell className="whitespace-nowrap">{format(new Date(a.created_at), "d MMM, h:mm a")}</TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                        <SelectTrigger className="w-36" aria-label="Application status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_COPY).map(([k, s]) => (
                            <SelectItem key={k} value={k}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="post">
          <PostJobForm />
        </TabsContent>

        <TabsContent value="users">
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Expected pay</TableHead>
                  <TableHead>Contact OK</TableHead>
                  <TableHead>Jobs applied for</TableHead>
                  <TableHead>Referred</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No users yet.</TableCell></TableRow>
                ) : profiles.map((p) => {
                  const jobs = appsByUser.get(p.id) ?? [];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.id_number ?? "—"}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.phone ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.sub_county}, {p.county}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {p.expected_daily_pay ? `${formatKsh(p.expected_daily_pay)}/day` : "—"}
                        <br />
                        <span className="text-muted-foreground">{p.expected_monthly_pay ? `${formatKsh(p.expected_monthly_pay)}/month` : ""}</span>
                      </TableCell>
                      <TableCell>{p.allow_contact ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                      <TableCell className="max-w-xs text-sm">{jobs.length ? jobs.join(", ") : <span className="text-muted-foreground">None yet</span>}</TableCell>
                      <TableCell className="text-center font-semibold">{referralCounts.get(p.id) ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(p.created_at), "d MMM yyyy")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card [&_svg]:size-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="text-primary">{icon}</span> {label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
