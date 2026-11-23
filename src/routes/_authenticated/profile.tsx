import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, Save, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { meQuery } from "@/lib/queries";
import { COUNTIES, KENYA } from "@/lib/kenya";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  head: () => ({
    meta: [
      { title: "My profile — Public Jobs Kenya" },
      { name: "description", content: "Update your phone, ID number, location, expected pay and password." },
      { property: "og:title", content: "My profile — Public Jobs Kenya" },
      { property: "og:description", content: "Update your details and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const phoneRe = /^(?:\+254|254|0)(?:7|1)\d{8}$/;
const profileSchema = z.object({
  first_name: z.string().trim().min(2, "Enter your first name").max(60),
  last_name: z.string().trim().min(2, "Enter your surname").max(60),
  id_number: z.string().trim().refine((v) => v === "" || /^\d{6,10}$/.test(v), "ID number should be 6–10 digits"),
  phone: z.string().trim().refine((v) => phoneRe.test(v.replace(/\s/g, "")), "Use a Kenyan number e.g. 0712 345 678"),
  county: z.string().min(1, "Choose your county"),
  sub_county: z.string().min(1, "Choose your sub-county"),
  expected_daily_pay: z.coerce.number().int().min(100, "Minimum KSh 100").max(100000),
  expected_monthly_pay: z.coerce.number().int().min(1000, "Minimum KSh 1,000").max(5000000),
  allow_contact: z.boolean(),
});

function ProfilePage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const queryClient = useQueryClient();
  const p = me.profile;
  const [f, setF] = useState({
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    id_number: p?.id_number ?? "",
    phone: p?.phone ?? "",
    county: p?.county ?? "",
    sub_county: p?.sub_county ?? "",
    expected_daily_pay: String(p?.expected_daily_pay ?? ""),
    expected_monthly_pay: String(p?.expected_monthly_pay ?? ""),
    allow_contact: p?.allow_contact ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const subs = useMemo(() => (f.county ? KENYA[f.county] ?? [] : []), [f.county]);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(f);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    const v = parsed.data;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...v,
        id_number: v.id_number || null,
        phone: v.phone.replace(/\s/g, ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", me.userId);
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile");
      return;
    }
    toast.success("Profile saved");
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setPwSaving(true);
    // Confirm the current password before changing it.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: me.email, password: pw.current });
    if (signInError) {
      setPwSaving(false);
      toast.error("Current password is wrong");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password changed");
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><UserRound className="size-7 text-primary" /> My profile</h1>
        <p className="mt-1 text-muted-foreground">Keep your details up to date so employers can reach you.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-5 rounded-2xl border bg-card p-6 shadow-card" noValidate>
        <h2 className="text-xl font-bold">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>First name</Label><Input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />{err("first_name")}</div>
          <div className="space-y-1.5"><Label>Surname</Label><Input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />{err("last_name")}</div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={me.email} readOnly disabled aria-label="Email" />
            <p className="text-xs text-muted-foreground">Your sign-in email.</p>
          </div>
          <div className="space-y-1.5"><Label>Phone number</Label><Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" />{err("phone")}</div>
          <div className="space-y-1.5"><Label>National ID number (optional)</Label><Input inputMode="numeric" value={f.id_number} onChange={(e) => set("id_number", e.target.value)} />{err("id_number")}</div>
          <div />
          <div className="space-y-1.5">
            <Label>County</Label>
            <Select value={f.county} onValueChange={(v) => { setF((s) => ({ ...s, county: v, sub_county: "" })); setErrors((e) => ({ ...e, county: "" })); }}>
              <SelectTrigger aria-label="County"><SelectValue placeholder="Choose county" /></SelectTrigger>
              <SelectContent className="max-h-72">{COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>{err("county")}
          </div>
          <div className="space-y-1.5">
            <Label>Sub-county</Label>
            <Select value={f.sub_county} onValueChange={(v) => set("sub_county", v)} disabled={!f.county}>
              <SelectTrigger aria-label="Sub-county"><SelectValue placeholder="Choose sub-county" /></SelectTrigger>
              <SelectContent className="max-h-72">{subs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>{err("sub_county")}
          </div>
          <div className="space-y-1.5"><Label>Expected pay per day (KSh)</Label><Input inputMode="numeric" value={f.expected_daily_pay} onChange={(e) => set("expected_daily_pay", e.target.value.replace(/\D/g, ""))} />{err("expected_daily_pay")}</div>
          <div className="space-y-1.5"><Label>Expected pay per month (KSh)</Label><Input inputMode="numeric" value={f.expected_monthly_pay} onChange={(e) => set("expected_monthly_pay", e.target.value.replace(/\D/g, ""))} />{err("expected_monthly_pay")}</div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border bg-surface p-4 text-sm">
          <Checkbox checked={f.allow_contact} onCheckedChange={(c) => set("allow_contact", c === true)} className="mt-0.5" aria-label="Allow contact" />
          <span><span className="font-semibold">Allow Public Jobs Kenya to contact me</span><span className="block text-muted-foreground">By phone call, SMS or email about my applications and new jobs.</span></span>
        </label>
        <Button type="submit" variant="hero" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save profile</Button>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-xl font-bold"><KeyRound className="size-5 text-primary" /> Change password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Current password</Label><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Confirm new password</Label><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} /></div>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" /> Your password is stored scrambled. No one at Public Jobs Kenya can read it.</p>
        <Button type="submit" variant="outline" disabled={pwSaving || !pw.current || !pw.next}>{pwSaving ? <Loader2 className="animate-spin" /> : null} Update password</Button>
      </form>
    </main>
  );
}
