import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error("Not signed in");
    const uid = userData.user.id;
    const [{ data: profile, error }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (error) throw error;
    return {
      userId: uid,
      email: userData.user.email ?? "",
      profile,
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  },
});

export const jobsQuery = (county: string) =>
  queryOptions({
    queryKey: ["jobs", county],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .in("county", [county, "Online"])
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const jobQuery = (id: string) =>
  queryOptions({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const myApplicationsQuery = queryOptions({
  queryKey: ["my-applications"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];
    const { data, error } = await supabase
      .from("applications")
      .select("*, jobs(*)")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const myReferralsQuery = queryOptions({
  queryKey: ["my-referrals"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_referrals");
    if (error) throw error;
    return data ?? [];
  },
});

export const adminDataQuery = queryOptions({
  queryKey: ["admin-data"],
  queryFn: async () => {
    const [profilesRes, appsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select("*, jobs(title, employer, county, sub_county, pay_amount, pay_period), profiles(first_name, last_name, phone, email, id_number)")
        .order("created_at", { ascending: false }),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (appsRes.error) throw appsRes.error;
    return { profiles: profilesRes.data, applications: appsRes.data };
  },
});

export function locationLabel(job: Pick<Job, "county" | "sub_county" | "is_online">): string {
  if (job.is_online) return "Remote · anywhere in Kenya";
  return job.sub_county ? `${job.sub_county}, ${job.county} County` : `${job.county} County`;
}

export const CATEGORIES = [
  "Hospitality",
  "Driving & Delivery",
  "Retail & Sales",
  "Security & Cleaning",
  "Construction & Skilled",
  "Farming & Agriculture",
  "Online",
  "Professional",
] as const;

export const STATUS_COPY: Record<string, { label: string; note: string; variant: "warning" | "success" | "destructive" | "soft" }> = {
  pending: { label: "Pending", note: "Wait for response within 2 business days.", variant: "warning" },
  shortlisted: { label: "Shortlisted", note: "Good news! The employer may call you soon.", variant: "soft" },
  accepted: { label: "Accepted", note: "Congratulations! Expect a call with next steps.", variant: "success" },
  rejected: { label: "Not selected", note: "Keep applying, new jobs are added every day.", variant: "destructive" },
};
