import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, meQuery } from "@/lib/queries";
import { COUNTIES, KENYA } from "@/lib/kenya";

const schema = z.object({
  title: z.string().trim().min(3, "Enter a job title").max(120),
  employer: z.string().trim().min(2, "Enter the employer").max(120),
  category: z.string().min(1, "Choose a category"),
  county: z.string().min(1, "Choose a county"),
  sub_county: z.string(),
  job_type: z.string().min(1),
  pay_amount: z.coerce.number({ invalid_type_error: "Enter the pay" }).int().min(50, "Enter the pay").max(10_000_000),
  pay_period: z.string().min(1),
  positions: z.coerce.number().int().min(1).max(500),
  description: z.string().trim().min(20, "Describe the job (at least 20 characters)").max(2000),
  requirements: z.string().trim().min(3, "Enter requirements, e.g. No qualifications required").max(1000),
  qualification_required: z.boolean(),
});

const initial = {
  title: "",
  employer: "",
  category: "",
  county: "",
  sub_county: "",
  job_type: "Full-time",
  pay_amount: "",
  pay_period: "day",
  positions: "1",
  description: "",
  requirements: "No qualifications required.",
  qualification_required: false,
};

export function PostJobForm({ asAdmin = false }: { asAdmin?: boolean }) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isOnline = f.county === "Online";

  function set<K extends keyof typeof initial>(k: K, v: (typeof initial)[K]) {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(f);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    const v = parsed.data;
    if (!isOnline && !v.sub_county) {
      setErrors({ sub_county: "Choose a sub-county" });
      return;
    }
    if (!me) return;
    setSaving(true);
    const { error } = await supabase.from("jobs").insert({
      ...v,
      sub_county: isOnline ? null : v.sub_county,
      is_online: isOnline,
      job_type: isOnline && v.job_type === "Full-time" ? "Remote" : v.job_type,
      posted_by: me.userId,
      is_active: asAdmin,
      review_status: asAdmin ? "approved" : "pending",
    });
    setSaving(false);
    if (error) {
      toast.error("Could not post the job");
      return;
    }
    toast.success(asAdmin ? "Job posted. It's live for job seekers now." : "Job sent for review. It goes live once an admin approves it.");
    setF(initial);
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["my-posted-jobs"] });
  }

  const err = (k: string) => (errors[k] ? <p className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-card" noValidate>
      <div>
        <h2 className="text-xl font-bold">Post a new job</h2>
        <p className="text-sm text-muted-foreground">
          {asAdmin
            ? "Jobs you post appear instantly on job seekers' dashboards with a \"New\" label."
            : "Hiring? Post your job free. Our team checks it, usually within a day, then it goes live for job seekers."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Job title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Waiter / Waitress" />{err("title")}</div>
        <div className="space-y-1.5"><Label>Employer</Label><Input value={f.employer} onChange={(e) => set("employer", e.target.value)} placeholder="e.g. Kasarani Choma Grill" />{err("employer")}</div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose category" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>{err("category")}
        </div>
        <div className="space-y-1.5">
          <Label>Job type</Label>
          <Select value={f.job_type} onValueChange={(v) => set("job_type", v)}>
            <SelectTrigger aria-label="Job type"><SelectValue /></SelectTrigger>
            <SelectContent>{["Full-time", "Part-time", "Casual", "Contract", "Remote"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>County</Label>
          <Select value={f.county} onValueChange={(v) => { setF((s) => ({ ...s, county: v, sub_county: "" })); setErrors((e) => ({ ...e, county: "" })); }}>
            <SelectTrigger aria-label="Job county"><SelectValue placeholder="Choose county" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="Online">Online (remote)</SelectItem>
              {COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>{err("county")}
        </div>
        <div className="space-y-1.5">
          <Label>Sub-county</Label>
          <Select value={f.sub_county} onValueChange={(v) => set("sub_county", v)} disabled={!f.county || isOnline}>
            <SelectTrigger aria-label="Job sub-county"><SelectValue placeholder={isOnline ? "Not needed for online jobs" : "Choose sub-county"} /></SelectTrigger>
            <SelectContent className="max-h-72">{(KENYA[f.county] ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>{err("sub_county")}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="space-y-1.5"><Label>Pay (KSh)</Label><Input inputMode="numeric" value={f.pay_amount} onChange={(e) => set("pay_amount", e.target.value.replace(/\D/g, ""))} placeholder="700" />{err("pay_amount")}</div>
          <div className="space-y-1.5">
            <Label>Per</Label>
            <Select value={f.pay_period} onValueChange={(v) => set("pay_period", v)}>
              <SelectTrigger className="w-28" aria-label="Pay period"><SelectValue /></SelectTrigger>
              <SelectContent>{["hour", "day", "week", "month"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Positions</Label><Input inputMode="numeric" value={f.positions} onChange={(e) => set("positions", e.target.value.replace(/\D/g, ""))} />{err("positions")}</div>
      </div>
      <div className="space-y-1.5"><Label>What the worker will do</Label><Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Duties, working hours, days off, meals, how and when pay is made…" />{err("description")}</div>
      <div className="space-y-1.5"><Label>Requirements</Label><Textarea rows={2} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} />{err("requirements")}</div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={f.qualification_required} onCheckedChange={(c) => set("qualification_required", c === true)} aria-label="Needs certificate" />
        This job needs a certificate, diploma or degree
      </label>
      <Button type="submit" variant="hero" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />} {asAdmin ? "Post job" : "Submit job for review"}</Button>
    </form>
  );
}
