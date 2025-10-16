import { Suspense } from "react"
import { cn } from "@/lib/utils"
import LocationSchemes from "@/components/location-schemes"

export default function Page() {
  return (
    <main className={cn("min-h-dvh w-full", "flex items-stretch justify-center", "bg-background text-foreground")}>
      <div
        className={cn(
          // Mobile-first, optimized for 240x320 devices (KaiOS)
          "w-full max-w-[320px] min-h-dvh",
          "flex flex-col gap-2",
          "p-2",
        )}
      >
        <div className="win-surface overflow-hidden">
          <div className={cn("win-toolbar", "h-10 flex items-center gap-2 px-3")}>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            <span className="text-sm font-medium text-pretty">Government Schemes Near You</span>
          </div>

          <div className="p-2">
            <header className="pt-1 pb-1">
              <p className="text-xs leading-5 opacity-80 text-pretty">
                Uses your device location to find schemes for your region.
              </p>
            </header>

            <Suspense fallback={<div className="text-sm">Loading…</div>}>
              <LocationSchemes />
            </Suspense>

            <footer className="mt-2 pt-2 border-t">
              <p className="text-[11px] leading-5 opacity-70">
                Data fetched from myScheme (Government of India). Accuracy may vary based on device location and source
                site availability.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  )
}
