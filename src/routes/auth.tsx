import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/app/Logo";
import { COUNTIES, KENYA } from "@/lib/kenya";
import heroImg from "@/assets/kenya-workers.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { ref?: string | undefined } => ({
    ref: typeof s["ref"] === "string" && /^[a-z0-9]{6,12}$/.test(s["ref"]) ? s["ref"] : undefined,
  }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Create your account — Public Jobs Kenya" },
      {
        name: "description",
        content: "Sign up free in two minutes and see jobs in your county and sub-county right away.",
      },
      { property: "og:title", content: "Create your account — Public Jobs Kenya" },
      {
        property: "og:description",
        content: "Sign up free and apply to jobs near you, online jobs and professional jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const phoneRe = /^(?:\+254|254|0)(?:7|1)\d{8}$/;

const signUpSchema = z.object({
  first_name: z.string().trim().min(2, "Enter your first name").max(60),
  last_name: z.string().trim().min(2, "Enter your surname").max(60),
  id_number: z
    .string()
    .trim()
    .max(10)
    .refine((v) => v === "" || /^\d{6,10}$/.test(v), "ID number should be 6–10 digits"),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  expected_daily_pay: z.coerce.number({ invalid_type_error: "Enter an amount" }).int().min(100, "Minimum KSh 100").max(100000),
  expected_monthly_pay: z.coerce.number({ invalid_type_error: "Enter an amount" }).int().min(1000, "Minimum KSh 1,000").max(5000000),
  phone: z.string().trim().refine((v) => phoneRe.test(v.replace(/\s/g, "")), "Use a Kenyan number e.g. 0712 345 678"),
  county: z.string().min(1, "Choose your county"),
  sub_county: z.string().min(1, "Choose your sub-county"),
  allow_contact: z.boolean(),
});

type FormState = {
  first_name: string;
  last_name: string;
  id_number: string;
  email: string;
  password: string;
  expected_daily_pay: string;
  expected_monthly_pay: string;
  phone: string;
  county: string;
  sub_county: string;
  allow_contact: boolean;
};

const empty: FormState = {
  first_name: "",
  last_name: "",
  id_number: "",
  email: "",
  password: "",
  expected_daily_pay: "",
  expected_monthly_pay: "",
  phone: "",
  county: "",
  sub_county: "",
  allow_contact: true,
};

function AuthPage() {
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const subCounties = useMemo(() => (form.county ? KENYA[form.county] ?? [] : []), [form.county]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    const v = parsed.data;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: v.first_name,
          last_name: v.last_name,
          id_number: v.id_number,
          phone: v.phone.replace(/\s/g, ""),
          county: v.county,
          sub_county: v.sub_county,
          expected_daily_pay: String(v.expected_daily_pay),
          expected_monthly_pay: String(v.expected_monthly_pay),
          allow_contact: v.allow_contact ? "true" : "false",
          ref: ref ?? "",
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("registered") ? "This email already has an account. Sign in instead." : error.message);
      return;
    }
    if (data.session) {
      toast.success(`Karibu, ${v.first_name}! Here are jobs near you.`);
      navigate({ to: "/dashboard", replace: true });
    } else {
      setCheckEmail(true);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim();
    if (!email || !form.password) {
      toast.error("Enter your email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
    setLoading(false);
    if (error) {
      toast.error("Wrong email or password");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-hero lg:block">
        <img
          src={heroImg}
          alt="Kenyan workers: a waitress, delivery rider, guard, nurse, farmer and online worker"
          width={1024}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo onDark />
          <div className="max-w-md text-primary-foreground">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">Kazi iko. Find work near you today.</h1>
            <p className="mt-4 text-lg text-primary-foreground/85">
              Waiters, drivers, guards, shop attendants, online jobs and professional roles in all 47 counties.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-primary-foreground/90">
              <li className="flex items-center gap-2"><MapPin className="size-4 text-highlight" /> Jobs in your own sub-county</li>
              <li className="flex items-center gap-2"><Wallet className="size-4 text-highlight" /> Clear pay on every job</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-highlight" /> Free to join and apply</li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:py-12">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto w-full max-w-xl animate-rise">
          {checkEmail ? (
            <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
              <h2 className="text-2xl font-bold">Check your email</h2>
              <p className="mt-2 text-muted-foreground">
                We sent a confirmation link to {form.email}. Open it to finish creating your account.
              </p>
            </div>
          ) : (
            <>
              {ref && mode === "signup" ? (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
                  🎉 A friend invited you to Public Jobs Kenya
                </p>
              ) : null}
              <h2 className="text-3xl font-bold">{mode === "signup" ? "Create your free account" : "Welcome back"}</h2>
              <p className="mt-1 text-muted-foreground">
                {mode === "signup"
                  ? "Takes 2 minutes. We'll show you jobs that match where you live."
                  : "Sign in to see your jobs and applications."}
              </p>

              <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
                {(["signup", "signin"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                      mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
                    }`}
                  >
                    {m === "signup" ? "Create account" : "Sign in"}
                  </button>
                ))}
              </div>

              {mode === "signin" ? (
                <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                  <Field label="Email" error={errors["email"]}>
                    <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@gmail.com" />
                  </Field>
                  <Field label="Password">
                    <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
                  </Field>
                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : null} Sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="mt-6 space-y-6" noValidate>
                  <Section title="About you">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="First name" error={errors["first_name"]}>
                        <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Wanjiru" autoComplete="given-name" />
                      </Field>
                      <Field label="Surname" error={errors["last_name"]}>
                        <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Kamau" autoComplete="family-name" />
                      </Field>
                    </div>
                    <Field label="National ID number (optional)" error={errors["id_number"]}>
                      <Input inputMode="numeric" value={form.id_number} onChange={(e) => set("id_number", e.target.value)} placeholder="e.g. 32145678" />
                    </Field>
                    <Field label="Phone number" error={errors["phone"]}>
                      <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" autoComplete="tel" />
                    </Field>
                  </Section>

                  <Section title="Your account" hint="Use the email you already have and a password you'll remember.">
                    <Field label="Email" error={errors["email"]}>
                      <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@gmail.com" />
                    </Field>
                    <Field label="Password" error={errors["password"]}>
                      <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
                    </Field>
                  </Section>

                  <Section title="Expected pay">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Per day (KSh)" error={errors["expected_daily_pay"]}>
                        <Input inputMode="numeric" value={form.expected_daily_pay} onChange={(e) => set("expected_daily_pay", e.target.value.replace(/\D/g, ""))} placeholder="700" />
                      </Field>
                      <Field label="Per month (KSh)" error={errors["expected_monthly_pay"]}>
                        <Input inputMode="numeric" value={form.expected_monthly_pay} onChange={(e) => set("expected_monthly_pay", e.target.value.replace(/\D/g, ""))} placeholder="18000" />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Where you live" hint="We'll show jobs in your sub-county first.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="County" error={errors["county"]}>
                        <Select
                          value={form.county}
                          onValueChange={(v) => {
                            setForm((f) => ({ ...f, county: v, sub_county: "" }));
                            setErrors((e) => ({ ...e, county: "" }));
                          }}
                        >
                          <SelectTrigger aria-label="County"><SelectValue placeholder="Choose county" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {COUNTIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Sub-county" error={errors["sub_county"]}>
                        <Select value={form.sub_county} onValueChange={(v) => set("sub_county", v)} disabled={!form.county}>
                          <SelectTrigger aria-label="Sub-county"><SelectValue placeholder={form.county ? "Choose sub-county" : "Pick county first"} /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {subCounties.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </Section>

                  <label className="flex items-start gap-3 rounded-xl border bg-surface p-4 text-sm">
                    <Checkbox
                      checked={form.allow_contact}
                      onCheckedChange={(c) => set("allow_contact", c === true)}
                      className="mt-0.5"
                      aria-label="Allow contact"
                    />
                    <span>
                      <span className="font-semibold">Allow Public Jobs Kenya to contact me</span>
                      <span className="block text-muted-foreground">
                        By phone call, SMS or email about my applications and new jobs. You can say no and still apply.
                      </span>
                    </span>
                  </label>

                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : null} Create account & see jobs
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Public Jobs Kenya will never ask you to pay to apply for a job.
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string | undefined; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="font-display text-base font-semibold">{title}</legend>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
