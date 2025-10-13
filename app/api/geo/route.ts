// Server route: Reverse-geocode lat/lon to Indian State/District
// Uses Nominatim (OpenStreetMap). This avoids CORS issues on KaiOS browsers.

import type { NextRequest } from "next/server"

// Minimal normalization for common UT/State naming mismatches
const STATE_NORMALIZE: Record<string, string> = {
  "NCT of Delhi": "Delhi",
  "National Capital Territory of Delhi": "Delhi",
  "Jammu and Kashmir": "Jammu & Kashmir",
  "Andaman and Nicobar Islands": "Andaman & Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu": "Dadra & Nagar Haveli and Daman & Diu",
  Odisha: "Odisha", // keep
  Orissa: "Odisha",
  Puducherry: "Puducherry",
  Pondicherry: "Puducherry",
}

function normalizeStateName(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  return STATE_NORMALIZE[trimmed] ?? trimmed
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat")
  const lon = req.nextUrl.searchParams.get("lon")
  if (!lat || !lon) {
    return new Response(JSON.stringify({ state: null, district: null, error: "Missing lat/lon" }), { status: 400 })
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("lat", lat)
    url.searchParams.set("lon", lon)
    url.searchParams.set("zoom", "10")
    url.searchParams.set("addressdetails", "1")

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "v0-myscheme-locator/1.0 (https://v0.app)",
        Accept: "application/json",
      },
      // Nominatim requires GET; rate-limit friendly
      cache: "no-store",
    })
    if (!res.ok) {
      return new Response(
        JSON.stringify({ state: null, district: null, error: `Reverse geocode failed: ${res.status}` }),
        { status: 502 },
      )
    }
    const data = await res.json()
    const addr = data?.address || {}
    // District keys vary in OSM data: state_district, county, district
    const district = addr.state_district || addr.district || addr.county || null
    const state = normalizeStateName(addr.state || null)

    return new Response(JSON.stringify({ state, district, raw: { address: addr } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ state: null, district: null, error: err?.message || "Reverse geocode error" }),
      { status: 500 },
    )
  }
}
