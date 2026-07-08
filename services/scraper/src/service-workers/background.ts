import { config } from "@/lib/config"
import { waitForNetworkIdle } from "@/lib/helper-scripts/waitForNetworkIdle"
import { scrapeInfiniteSearchFeedLinkedin } from "@/lib/scripts/scrap-infinite-linkedin"
import { getTimeStamp } from "@/lib/utils"

// Set panel behavior to open on action click
if (
  typeof chrome !== "undefined" &&
  chrome.sidePanel &&
  typeof chrome.sidePanel.setPanelBehavior === "function"
) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error))
}

console.log(getTimeStamp(), "Background service worker loaded")

import type { ScraperState } from "@/lib/scripts/scrap-infinite-linkedin"

/**
 * Handle START_SCRAPE message. Checks local storage for resume capabilities,
 * creates tabs if fresh, and schedules/initiates scraping.
 */
async function handleStartScrape(
  message: any,
  sendResponse: (response: any) => void
) {
  try {
    const keyword = message.keyword || "hiring software engineer"
    const timeFilter = message.timeFilter || "default"
    const maxDepthPx = message.maxDepthPx || 40000

    const stored = await chrome.storage.local.get(["linkedin_scraper_state"])
    const scraperState = (stored.linkedin_scraper_state ||
      {}) as Partial<ScraperState>

    let isResuming = false
    const tabId = scraperState.tabId

    if (
      scraperState.status === "paused" &&
      scraperState.keyword === keyword &&
      scraperState.timeFilter === timeFilter &&
      typeof tabId === "number"
    ) {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (tab && tab.id) {
          isResuming = true
        }
      } catch (e) {
        console.log(
          getTimeStamp(),
          "Paused tab was closed. Cannot resume. Will start fresh."
        )
      }
    }

    if (isResuming && typeof tabId === "number") {
      console.log(
        getTimeStamp(),
        `Resuming LinkedIn feed scraping on tab ID: ${tabId}`
      )
      await chrome.storage.local.set({
        linkedin_scraper_state: {
          ...scraperState,
          status: "scraping",
        },
      })
      scrapeInfiniteSearchFeedLinkedin(
        tabId,
        keyword,
        timeFilter,
        config,
        maxDepthPx
      )
      sendResponse({ status: "Resumed", tabId })
    } else {
      console.log(getTimeStamp(), "Starting fresh LinkedIn feed scraping task.")
      await chrome.storage.local.set({
        linkedin_scraper_state: {
          status: "scraping",
          tabId: null,
          keyword,
          timeFilter,
          maxDepthPx,
          currentDepth: 0,
        },
      })

      chrome.tabs.create({ url: "https://www.linkedin.com" }, async (tab) => {
        if (tab && tab.id) {
          const currentStored = await chrome.storage.local.get([
            "linkedin_scraper_state",
          ])
          const currentState = (currentStored.linkedin_scraper_state ||
            {}) as Partial<ScraperState>
          await chrome.storage.local.set({
            linkedin_scraper_state: {
              ...currentState,
              tabId: tab.id,
            },
          })

          try {
            console.log(
              getTimeStamp(),
              `Waiting for network idle on tab ${tab.id}`
            )
            await waitForNetworkIdle({ tabId: tab.id, timeout: 10000 })
            console.log(
              getTimeStamp(),
              "Network is idle, beginning scraping loop"
            )
            scrapeInfiniteSearchFeedLinkedin(
              tab.id,
              keyword,
              timeFilter,
              config,
              maxDepthPx
            )
          } catch (error) {
            console.error("Scraping workflow trigger failed:", error)
            const errorMsg =
              error instanceof Error ? error.message : String(error)
            await chrome.storage.local.set({
              linkedin_scraper_state: {
                ...currentState,
                tabId: tab.id,
                status: "failed",
                errorMessage: errorMsg,
              },
            })
          }
        }
      })
      sendResponse({ status: "Started" })
    }
  } catch (error) {
    console.error("Error in handleStartScrape:", error)
    sendResponse({ status: "failed", error: String(error) })
  }
}

/**
 * Handle STOP_SCRAPE message. Signals the running scraper to pause execution.
 */
async function handleStopScrape(sendResponse: (response: any) => void) {
  try {
    const stored = await chrome.storage.local.get(["linkedin_scraper_state"])
    const scraperState = (stored.linkedin_scraper_state ||
      {}) as Partial<ScraperState>

    if (scraperState.status === "scraping") {
      console.log(
        getTimeStamp(),
        `Signal pause/stop received for tab ID: ${scraperState.tabId}`
      )
      await chrome.storage.local.set({
        linkedin_scraper_state: {
          ...scraperState,
          status: "paused",
        },
      })
      sendResponse({ status: "Stopping" })
    } else {
      sendResponse({ status: "Not active", scraperState })
    }
  } catch (error) {
    console.error("Error in handleStopScrape:", error)
    sendResponse({ status: "failed", error: String(error) })
  }
}

/**
 * Handle GET_SCRAPE_STATUS message. Fetches current scraping metrics and progress.
 */
async function handleGetStatus(sendResponse: (response: any) => void) {
  try {
    const stored = await chrome.storage.local.get(["linkedin_scraper_state"])
    sendResponse({
      status: "Success",
      scraperState: stored.linkedin_scraper_state || null,
    })
  } catch (error) {
    console.error("Error in handleGetStatus:", error)
    sendResponse({ status: "failed", error: String(error) })
  }
}

/**
 * Listener that acts as the entry point for commands coming from our Scheduler/Dashboard.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "START_SCRAPE") {
    handleStartScrape(message, sendResponse)
    return true // Keep channel open for async response
  } else if (message.action === "STOP_SCRAPE") {
    handleStopScrape(sendResponse)
    return true // Keep channel open for async response
  } else if (message.action === "GET_SCRAPE_STATUS") {
    handleGetStatus(sendResponse)
    return true // Keep channel open for async response
  }
})

/**
 * Fallback to handle when target tab is closed by the user while scraping is running.
 */
if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const stored = await chrome.storage.local.get(["linkedin_scraper_state"])
      const scraperState = (stored.linkedin_scraper_state ||
        {}) as Partial<ScraperState>

      if (scraperState.tabId === tabId && scraperState.status === "scraping") {
        console.log(
          getTimeStamp(),
          `Scraper tab ${tabId} closed while active. Marking scraping failed.`
        )
        await chrome.storage.local.set({
          linkedin_scraper_state: {
            ...scraperState,
            status: "failed",
            errorMessage: "Scraper tab was closed by user.",
          },
        })
      }
    } catch (e) {
      console.error("Error in tabs.onRemoved listener:", e)
    }
  })
}
