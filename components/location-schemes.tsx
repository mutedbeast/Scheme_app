"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"

type Geo = { lat: number; lon: number }
type ResolvedLocation = {
  state: string | null
  district: string | null
  raw?: any
}
type SchemeItem = {
  title: string
  href: string
  description?: string
  sourceUrl?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export default function LocationSchemes() {
  const [geo, setGeo] = useState<Geo | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // Request location once on mount (or when retrying)
  useEffect(() => {
    let cancelled = false
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported on this device.")
      return
    }
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        })
      },
      (err) => {
        if (cancelled) return
        setGeoError(err.message || "Unable to retrieve your location.")
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60_000,
      },
    )
    return () => {
      cancelled = true
    }
  }, [retryKey])

  const {
    data: resolved,
    error: resolveErr,
    isLoading: resolving,
  } = useSWR<ResolvedLocation>(
    geo ? `/api/geo?lat=${encodeURIComponent(geo.lat)}&lon=${encodeURIComponent(geo.lon)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const stateParam = useMemo(() => {
    if (!resolved?.state) return null
    return resolved.state
  }, [resolved?.state])

  const searchLink = useMemo(() => {
    if (!resolved?.state) return null
    const q = resolved.district ? `${resolved.state} ${resolved.district}` : resolved.state
    return `https://www.myscheme.gov.in/search?q=${encodeURIComponent(q)}`
  }, [resolved?.state, resolved?.district])

  const {
    data: schemes,
    error: schemesErr,
    isLoading: loadingSchemes,
  } = useSWR<{ items: SchemeItem[]; sourceUrl?: string; note?: string }>(
    stateParam
      ? `/api/schemes?state=${encodeURIComponent(resolved!.state!)}${
          resolved?.district ? `&district=${encodeURIComponent(resolved.district)}` : ""
        }`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const onRetry = () => {
    setGeo(null)
    setRetryKey((k) => k + 1)
  }

  return (
    <section aria-labelledby="schemes-title" className={cn("flex flex-col gap-2")}>
      <div className="rounded-md border p-2">
        <div className="flex items-center justify-between">
          <h2 id="schemes-title" className="text-sm font-medium">
            Your location
          </h2>
          <button
            type="button"
            onClick={onRetry}
            className={cn("px-2 py-1 rounded-sm border", "text-xs", "active:scale-95 transition")}
            aria-label="Retry location"
          >
            Retry
          </button>
        </div>

        {!geo && !geoError && <p className="text-xs leading-5 mt-1">Requesting location…</p>}
        {geoError && <p className="text-xs leading-5 mt-1 text-[color:var(--destructive)]">{geoError}</p>}
        {geo && (
          <p className="text-[11px] leading-5 mt-1 opacity-80">
            Coords: {geo.lat.toFixed(3)}, {geo.lon.toFixed(3)}
          </p>
        )}
        {resolving && <p className="text-xs leading-5 mt-1">Resolving state/district…</p>}
        {resolveErr && (
          <p className="text-xs leading-5 mt-1 text-[color:var(--destructive)]">
            Could not resolve state from your location.
          </p>
        )}
        {resolved?.state && (
          <p className="text-sm leading-5 mt-1">
            State: <strong>{resolved.state}</strong>
            {resolved.district ? <span className="opacity-80"> • District: {resolved.district}</span> : null}
          </p>
        )}
      </div>

      <div className="rounded-md border p-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">Schemes for your region</h3>
          {stateParam ? (
            <a
              className="text-xs underline focus:outline-none"
              href={searchLink || `https://www.myscheme.gov.in/`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open myScheme website"
            >
              Open myScheme
            </a>
          ) : null}
        </div>

        {!stateParam && !resolving && <p className="text-xs leading-5">Waiting for your state to load…</p>}
        {loadingSchemes && stateParam && <p className="text-xs leading-5">Fetching schemes from myScheme…</p>}
        {schemesErr && (
          <p className="text-xs leading-5 text-[color:var(--destructive)]">
            Could not fetch schemes. Please try again.
          </p>
        )}
        {schemes?.note ? <p className="text-[11px] leading-5 mb-2 opacity-80">{schemes.note}</p> : null}

        {schemes?.items?.length ? (
          <ul className="mt-1 grid grid-cols-1 gap-2">
            {schemes.items.slice(0, 50).map((item) => (
              <li key={item.href} className="rounded-sm border p-2">
                <a
                  className="block"
                  href={item.href.startsWith("http") ? item.href : `https://www.myscheme.gov.in${item.href}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="text-sm font-medium leading-5 text-pretty">{item.title}</div>
                  {item.description ? (
                    <div className="text-[11px] leading-5 mt-1 opacity-80 line-clamp-3">{item.description}</div>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        ) : stateParam && !loadingSchemes && !schemesErr ? (
          <p className="text-xs leading-5">
            No schemes found via scraping right now. You can browse directly on myScheme above.
          </p>
        ) : null}
      </div>
    </section>
  )
}
