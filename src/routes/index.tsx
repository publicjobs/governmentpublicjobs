import { createFileRoute, redirect } from "@tanstack/react-router";

// Visitors land straight on the create-account page; /auth sends signed-in users on to /dashboard.
export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    const ref = (location.search as Record<string, unknown>)["ref"];
    throw redirect({ to: "/auth", search: { ref: typeof ref === "string" ? ref : undefined } });
  },
  head: () => ({
    meta: [
      { title: "Public Jobs Kenya — Find work near you in every county" },
      {
        name: "description",
        content:
          "Jobs in every Kenyan county and sub-county: waiters, drivers, cleaners, online and professional work. Create a free account and apply today.",
      },
      { property: "og:title", content: "Public Jobs Kenya — Find work near you" },
      {
        property: "og:description",
        content: "Hundreds of real jobs across all 47 counties, many with no qualifications needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
