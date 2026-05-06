import { c as createComponent, r as renderHead, d as addAttribute, e as renderTemplate } from '../chunks/astro/server_brzcl314.mjs';
/* empty css                                    */
export { renderers } from '../renderers.mjs';

const prerender = false;
const $$Auctions = createComponent(async ($$result, $$props, $$slots) => {
  const apiUrl = "https://api.auctionit.ai";
  const bidderUrl = "https://bid.auctionit.ai";
  let auctions = [];
  let fetchError = null;
  try {
    const res = await fetch(`${apiUrl}/api/public/auctions/upcoming`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`api ${res.status}`);
    auctions = await res.json();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "unknown error";
  }
  const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
  const formatCents = (cents) => inr.format(cents / 100);
  const formatWhen = (iso) => new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata"
  });
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Upcoming Auctions · AuctionIt</title><meta name="description" content="Browse upcoming and live auctions. Sign in to bid.">${renderHead()}</head> <body class="min-h-screen bg-background text-foreground"> <header class="border-b"> <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"> <a href="/" class="text-lg font-semibold tracking-tight">AuctionIt</a> <a${addAttribute(bidderUrl, "href")} class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
Sign in to bid
</a> </div> </header> <main class="mx-auto max-w-5xl px-6 py-10"> <div class="mb-8"> <h1 class="text-3xl font-semibold">Upcoming auctions</h1> <p class="mt-2 text-sm text-muted-foreground"> ${auctions.length === 0 && !fetchError ? "No auctions scheduled right now. Check back soon." : `${auctions.length} listing${auctions.length === 1 ? "" : "s"} · refreshed every visit`} </p> </div> ${fetchError && renderTemplate`<div class="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"> <p class="font-medium text-destructive">Couldn't load auctions.</p> <p class="mt-1 text-muted-foreground">${fetchError}</p> </div>`} <ul class="grid gap-4 sm:grid-cols-2"> ${auctions.map((a) => renderTemplate`<li class="rounded-lg border bg-card p-5 transition hover:border-primary/40"> <div class="flex items-start justify-between gap-3"> <h2 class="text-base font-medium leading-snug">${a.title}</h2> <span${addAttribute([
    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
    a.status === "live" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
  ], "class:list")}> ${a.status === "live" ? "Live now" : "Scheduled"} </span> </div> ${a.description && renderTemplate`<p class="mt-2 line-clamp-2 text-sm text-muted-foreground"> ${a.description} </p>`} <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm"> <dt class="text-muted-foreground">Starts</dt> <dd>${formatWhen(a.startsAt)}</dd> <dt class="text-muted-foreground">Current bid</dt> <dd class="font-medium">${formatCents(a.currentPriceCents)}</dd> </dl> <a${addAttribute(`${bidderUrl}/auctions/${a.id}`, "href")} class="mt-4 inline-block text-sm text-primary underline">
View on bidder app →
</a> </li>`)} </ul> </main> </body></html>`;
}, "/Users/apple/work/auction-app/apps/marketing/src/pages/auctions.astro", void 0);
const $$file = "/Users/apple/work/auction-app/apps/marketing/src/pages/auctions.astro";
const $$url = "/auctions";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Auctions,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
