import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from "react"
import { Button } from "./components/ui/button"

export interface ScraperState {
  status: "idle" | "scraping" | "paused" | "completed" | "failed"
  tabId: number | null
  keyword: string
  timeFilter: string
  maxDepthPx: number
  currentDepth: number
  errorMessage?: string
}

function App() {
  const [keyword, setKeyword] = useState("hiring software engineer")
  const [timeFilter, setTimeFilter] = useState("1D")
  const [maxDepthPx, setMaxDepthPx] = useState(5000)
  const [scraperState, setScraperState] = useState<ScraperState | null>(null)

  // Poll status periodically (every 1000ms)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await chrome.runtime.sendMessage({
          action: "GET_SCRAPE_STATUS",
        })
        if (res && res.status === "Success") {
          setScraperState(res.scraperState)
          // If a task is active, sync form values (unless user has active focus)
          if (res.scraperState && res.scraperState.status === "scraping") {
            setKeyword(res.scraperState.keyword || "")
            setTimeFilter(res.scraperState.timeFilter || "default")
            setMaxDepthPx(res.scraperState.maxDepthPx || 5000)
          }
        }
      } catch (err) {
        console.error("Error fetching status:", err)
      }
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)
    return () => clearInterval(timer)
  }, [])

  const startScrape = async () => {
    try {
      setScraperState((prev) =>
        prev
          ? { ...prev, status: "scraping", keyword, timeFilter, maxDepthPx }
          : {
              status: "scraping",
              tabId: null,
              keyword,
              timeFilter,
              maxDepthPx,
              currentDepth: 0,
            }
      )
      const res = await chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        keyword,
        timeFilter,
        maxDepthPx,
      })
      console.log("Start response:", res)
    } catch (error) {
      console.error("Error starting scrape:", error)
    }
  }

  const stopScrape = async () => {
    try {
      const res = await chrome.runtime.sendMessage({
        action: "STOP_SCRAPE",
      })
      console.log("Stop response:", res)
    } catch (error) {
      console.error("Error stopping scrape:", error)
    }
  }

  const resetScrape = async () => {
    try {
      // Clear current state in storage so we can start fresh
      await chrome.storage.local.remove("linkedin_scraper_state")
      setScraperState(null)
    } catch (e) {
      console.error("Error resetting state:", e)
    }
  }

  // Calculate percentage
  const currentDepth = scraperState?.currentDepth || 0
  const totalDepth = scraperState?.maxDepthPx || maxDepthPx
  const percent = Math.min(100, Math.round((currentDepth / totalDepth) * 100))

  // Render status badge and pulsing LED
  const renderStatus = () => {
    const status = scraperState?.status || "idle"
    let colorClass = "bg-gray-400"
    let text = "Idle"
    let pulseClass = ""

    if (status === "scraping") {
      colorClass = "bg-sky-500"
      text = "Scraping"
      pulseClass = "animate-ping"
    } else if (status === "paused") {
      colorClass = "bg-amber-500"
      text = "Paused"
    } else if (status === "completed") {
      colorClass = "bg-emerald-500"
      text = "Completed"
    } else if (status === "failed") {
      colorClass = "bg-red-500"
      text = "Failed"
      pulseClass = "animate-pulse"
    }

    return (
      <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
        <span className="relative flex h-2 w-2">
          {pulseClass && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClass} ${pulseClass}`}
            ></span>
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`}
          ></span>
        </span>
        {text}
      </div>
    )
  }

  const isScraping = scraperState?.status === "scraping"
  const isPaused = scraperState?.status === "paused"

  return (
    <Card className="w-95 overflow-hidden border border-zinc-200 font-sans shadow-xl">
      <CardHeader className="bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-700 p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">
              HireMe Scraper
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs text-indigo-100">
              LinkedIn Infinite Search Feed Scraper
            </CardDescription>
          </div>
          {renderStatus()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Search Keyword
            </label>
            <input
              type="text"
              disabled={isScraping}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
              placeholder="e.g. software engineer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Time Filter
              </label>
              <select
                disabled={isScraping}
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-zinc-50 text-black"
              >
                <option value="default">Default</option>
                <option value="1D">Past 24 Hours</option>
                <option value="1W">Past Week</option>
                <option value="1M">Past Month</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Limit (Max Px)
              </label>
              <input
                type="number"
                disabled={isScraping}
                value={maxDepthPx}
                onChange={(e) => setMaxDepthPx(parseInt(e.target.value) || 0)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-zinc-50"
                min="100"
                step="500"
              />
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {scraperState?.status && scraperState.status !== "idle" ? (
          <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3.5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
              <span>Scrape Progress</span>
              <span>
                {currentDepth}px / {totalDepth}px ({percent}%)
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                style={{ width: `${percent}%` }}
                className="h-full bg-indigo-600 transition-all duration-300 ease-out"
              ></div>
            </div>

            {scraperState.errorMessage && (
              <div className="mt-2 rounded bg-red-50 p-2 text-xs wrap-break-word text-red-500">
                <strong>Error:</strong> {scraperState.errorMessage}
              </div>
            )}
          </div>
        ) : null}

        {/* Action Controls */}
        <div className="flex flex-col gap-2 pt-2">
          {isScraping ? (
            <Button
              onClick={stopScrape}
              className="w-full bg-amber-500 font-medium text-white shadow-sm transition hover:bg-amber-600"
            >
              Pause/Stop Scraping
            </Button>
          ) : isPaused ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={startScrape}
                className="cursor-pointer bg-emerald-600 font-medium text-white shadow-sm transition hover:bg-emerald-700"
              >
                Resume
              </Button>
              <Button
                onClick={resetScrape}
                variant="outline"
                className="cursor-pointer border-zinc-300 font-medium transition hover:bg-zinc-50"
              >
                Start Fresh
              </Button>
            </div>
          ) : (
            <Button
              onClick={startScrape}
              className="w-full cursor-pointer bg-indigo-600 font-medium text-white shadow-md transition hover:bg-indigo-700"
            >
              Start Scraping
            </Button>
          )}

          {/* Reset button for completed/failed/old states */}
          {(scraperState?.status === "completed" ||
            scraperState?.status === "failed") && (
            <Button
              onClick={resetScrape}
              variant="outline"
              className="w-full cursor-pointer border-zinc-300 font-medium transition hover:bg-zinc-50"
            >
              Clear Status
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default App
