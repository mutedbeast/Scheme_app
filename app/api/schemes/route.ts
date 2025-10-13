// Server route: Fetch and parse schemes from myscheme.gov.in for a given State.
// We attempt to scrape public HTML (no private API). This is best-effort and may need updates if site markup changes.

import type { NextRequest } from "next/server"
import { load as loadHTML } from "cheerio"

// Build a myScheme search URL for graceful fallback and deep-linking.
function searchUrl(q: string) {
  const u = new URL("https://www.myscheme.gov.in/search")
  u.searchParams.set("q", q)
  return u.toString()
}

// Extract Next.js buildId from homepage __NEXT_DATA__
async function getBuildId(): Promise<string | null> {
  try {
    const res = await fetch("https://www.myscheme.gov.in/", {
      headers: {
        "User-Agent": "v0-myscheme-locator/1.1 (+https://v0.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const html = await res.text()
    // __NEXT_DATA__ JSON is embedded in a script tag; simple heuristic extraction
    const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!m) return null
    const json = JSON.parse(m[1])
    return json?.buildId ?? null
  } catch {
    return null
  }
}

type SchemeItem = {
  title: string
  href: string
  description?: string
  sourceUrl?: string
}

// Generic fetch with browser-like headers
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Pretend to be a real browser to reduce blocks
        "User-Agent": "Mozilla/5.0 (Linux; KaiOS 2.5; rv:48.0) Gecko/48.0 Firefox/48.0",
        Accept: "text/html,application/xhtml+xml,application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.myscheme.gov.in/",
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractNextDataFromHtml(html: string): any | null {
  const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

function collectSchemeItemsFromUnknownJson(data: any, sourceUrl: string): SchemeItem[] {
  const items: SchemeItem[] = []
  const visited = new Set<any>()
  const stack: any[] = [data]

  const pushItem = (obj: any) => {
    const title = (obj?.title || obj?.name || "").toString().trim()
    const slug = (obj?.slug || obj?.path || obj?.url || "").toString().trim()
    if (!title) return
    let href = ""
    if (slug) {
      href = slug.startsWith("http")
        ? slug
        : slug.startsWith("/scheme") || slug.startsWith("scheme/")
          ? `/${slug.replace(/^\/+/, "")}`
          : slug.startsWith("/schemes") || slug.startsWith("schemes/")
            ? `/${slug.replace(/^\/+/, "")}`
            : ""
    }
    if (!href) return
    const description = (obj?.description || obj?.excerpt || obj?.summary || "").toString().trim() || undefined
    items.push({ title, href, description, sourceUrl })
  }

  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== "object" || visited.has(cur)) continue
    visited.add(cur)
    if (Array.isArray(cur)) {
      for (const it of cur) {
        if (it && typeof it === "object") {
          if ((it.title || it.name) && (it.slug || it.path || it.url)) pushItem(it)
          stack.push(it)
        }
      }
    } else {
      for (const k of Object.keys(cur)) {
        const v = (cur as any)[k]
        if (!v) continue
        if (typeof v === "object") {
          if ((v.title || v.name) && (v.slug || v.path || v.url)) pushItem(v)
          stack.push(v)
        }
      }
    }
  }

  // Dedup by href
  return Array.from(new Map(items.map((i) => [i.href, i])).values())
}

async function trySearchNextData(stateQ: string): Promise<SchemeItem[] | null> {
  const url = searchUrl(stateQ)
  const html = await fetchText(url)
  if (!html) return null
  const nextData = extractNextDataFromHtml(html)
  if (!nextData) return null
  const items = collectSchemeItemsFromUnknownJson(nextData, url)
  return items.length ? items : null
}

async function tryHtmlSearch(stateQ: string): Promise<SchemeItem[] | null> {
  const url = searchUrl(stateQ)
  const html = await fetchText(url)
  if (!html) return null
  const $ = loadHTML(html)
  const seen = new Set<string>()
  const items: SchemeItem[] = []

  $('a[href*="/scheme"], a[href*="/schemes"]').each((_, el) => {
    const rawHref = ($(el).attr("href") || "").trim()
    if (!rawHref) return
    const href = rawHref.startsWith("http") ? rawHref : `/${rawHref.replace(/^\/+/, "")}`
    if (seen.has(href)) return
    const title = ($(el).text() || "").replace(/\s+/g, " ").trim()
    if (!title) return
    let description = ""
    const card = $(el).closest("article, li, div, section")
    if (card.length) {
      const para = card.find("p").first().text().replace(/\s+/g, " ").trim()
      if (para && para.length > 20) description = para
    }
    seen.add(href)
    items.push({ title, href, description: description || undefined, sourceUrl: url })
  })

  return items.length ? items : null
}

function makeSearchHref(term: string) {
  return `https://www.myscheme.gov.in/search?q=${encodeURIComponent(`${term} Nagpur Maharashtra`)}`
}

const MOCK_NAGPUR_SCHEMES: SchemeItem[] = [
  {
    title: "Pradhan Mantri Awas Yojana (Urban)",
    href: makeSearchHref("Pradhan Mantri Awas Yojana Urban"),
    description: "Affordable housing benefits for eligible urban beneficiaries in Nagpur.",
  },
  {
    title: "Ayushman Bharat - PM-JAY",
    href: makeSearchHref("Ayushman Bharat PM-JAY"),
    description: "Health insurance coverage for eligible families.",
  },
  {
    title: "Pradhan Mantri Ujjwala Yojana",
    href: makeSearchHref("Pradhan Mantri Ujjwala Yojana"),
    description: "Subsidized LPG connections for eligible households.",
  },
  {
    title: "PM-KISAN Samman Nidhi",
    href: makeSearchHref("PM Kisan Samman Nidhi"),
    description: "Income support for eligible farmers.",
  },
  {
    title: "Atal Pension Yojana",
    href: makeSearchHref("Atal Pension Yojana"),
    description: "Voluntary pension scheme for unorganised sector workers.",
  },
  {
    title: "Pradhan Mantri Mudra Yojana",
    href: makeSearchHref("Pradhan Mantri Mudra Yojana"),
    description: "Loans for micro/small enterprises.",
  },
  {
    title: "Stand Up India Scheme",
    href: makeSearchHref("Stand Up India"),
    description: "Loans for women and SC/ST entrepreneurs.",
  },
  {
    title: "Sukanya Samriddhi Yojana",
    href: makeSearchHref("Sukanya Samriddhi Yojana"),
    description: "Savings scheme for the girl child.",
  },
  {
    title: "National Social Assistance Programme (Pension)",
    href: makeSearchHref("National Social Assistance Pension"),
    description: "Central pension support for eligible elderly/widow/disabled persons.",
  },
  {
    title: "Mahatma Jyotiba Phule Jan Arogya Yojana (MJPJAY)",
    href: makeSearchHref("Mahatma Jyotiba Phule Jan Arogya Yojana"),
    description: "Maharashtra state health insurance scheme.",
  },
  {
    title: "eShram Registration",
    href: makeSearchHref("eShram"),
    description: "National database for unorganised workers with benefits access.",
  },
  {
    title: "Swachh Bharat Mission - Urban",
    href: makeSearchHref("Swachh Bharat Mission Urban"),
    description: "Urban sanitation and cleanliness initiatives.",
  },
].map((i) => ({ ...i, sourceUrl: "https://www.myscheme.gov.in" }))

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || ""
  const district = req.nextUrl.searchParams.get("district") || ""
  if (!state) {
    return new Response(JSON.stringify({ items: [], note: "Missing state parameter" }), { status: 400 })
  }

  const query = district ? `${state} ${district}` : state
  const sourceUrl = searchUrl(query)

  try {
    console.log("[v0] /api/schemes: query =", query)

    if ((district || "").toLowerCase().includes("nagpur")) {
      console.log("[v0] /api/schemes: mock mode for Nagpur")
      return new Response(
        JSON.stringify({
          items: MOCK_NAGPUR_SCHEMES,
          sourceUrl,
          note: "Showing curated Nagpur schemes (mock data).",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    // 1) Prefer parsing __NEXT_DATA__ from the search page (avoids /_next/data 500/403)
    const jsonItems = await trySearchNextData(query)
    if (jsonItems?.length) {
      console.log("[v0] /api/schemes: next-data-from-html items =", jsonItems.length)
      return new Response(JSON.stringify({ items: jsonItems, sourceUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 2) Fallback to HTML anchors
    const htmlItems = await tryHtmlSearch(query)
    if (htmlItems?.length) {
      console.log("[v0] /api/schemes: html anchors items =", htmlItems.length)
      return new Response(JSON.stringify({ items: htmlItems, sourceUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 3) Graceful degradation
    console.log("[v0] /api/schemes: no items found, degrading")
    return new Response(
      JSON.stringify({
        items: [],
        sourceUrl,
        note: "Could not retrieve schemes programmatically right now. You can browse directly on myScheme using the link above.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    console.log("[v0] /api/schemes: unexpected error", err?.message)
    return new Response(
      JSON.stringify({
        items: [],
        sourceUrl,
        note: "Unexpected error while fetching data.",
        error: err?.message || "Unknown error",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
}
