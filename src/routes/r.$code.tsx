import { createFileRoute, redirect } from "@tanstack/react-router";

// Short invite link: /r/<code> opens the create-account page with the inviter's code.
export const Route = createFileRoute("/r/$code")({
  beforeLoad: ({ params }) => {
    const code = params.code.toLowerCase();
    throw redirect({ to: "/auth", search: { ref: /^[a-z0-9]{6,12}$/.test(code) ? code : undefined } });
  },
  head: () => ({
    meta: [
      { title: "You're invited — Public Jobs Kenya" },
      { name: "description", content: "A friend invited you to find jobs near you on Public Jobs Kenya. Joining is free." },
      { property: "og:title", content: "You're invited to Public Jobs Kenya" },
      { property: "og:description", content: "Jobs in every county and sub-county. Joining is free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
