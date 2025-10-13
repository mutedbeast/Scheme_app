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
        <header className="pt-1 pb-1">
          <h1 className="text-balance text-lg font-semibold leading-6">Government Schemes Near You</h1>
          <p className="text-xs leading-5 opacity-80">Uses your device location to find schemes for your region.</p>
        </header>

        <Suspense fallback={<div className="text-sm">Loading…</div>}>
          <LocationSchemes />
        </Suspense>

        <footer className="mt-auto pt-2 pb-2">
          <p className="text-[11px] leading-5 opacity-70">
            Data fetched from myScheme (Government of India). Accuracy may vary based on device location and source site
            availability.
          </p>
        </footer>
      </div>
    </main>
  )
}
