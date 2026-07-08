import { timeFilterSchema, type TimeFilter } from "@/lib/types/types"
import { uploadToS3 } from "@/lib/uploadToS3"
import { getRandomNumberInRange, getTimeStamp, sleep } from "@/lib/utils"
import * as zod from "zod"
import type { Config } from "../config"
import { getScrollMetrics } from "../helper-scripts/domMetrics"
import { extractDOM } from "../helper-scripts/extractDOM"
import { mouseScroll } from "../helper-scripts/mouseScroll"
import { simulateHumanMovement } from "../helper-scripts/random-mouse-movement"
import { infiniteScrollSleep } from "../helper-scripts/sleep"
import {
  waitForInfinitePageLoadDuringScroll,
  waitForNetworkIdle,
} from "../helper-scripts/waitForNetworkIdle"

export interface ScraperState {
  status: "idle" | "scraping" | "paused" | "completed" | "failed"
  tabId: number | null
  keyword: string
  timeFilter: TimeFilter
  maxDepthPx: number
  currentDepth: number
  errorMessage?: string
}

const baseSearchAllUrl = new URL("https://www.linkedin.com/search/results/all/")
const baseSearchPostUrl = new URL(
  "https://www.linkedin.com/search/results/content/"
)
const timeFilterMap = {
  "1D": `["past-24h"]`,
  "1W": `["past-week"]`,
  "1M": `["past-month"]`,
}

/**
 * Returns the search URL for the given search keyword and time filter
 * @param searchKeyword - The keyword to search for
 * @param timeFilter - The time filter to use
 * @returns The search URL
 */
// function getSearchUrl(searchKeyword: string, timeFilter: TimeFilter) {
//   const searchUrl = baseSearchPostUrl
//   searchUrl.searchParams.set("keywords", searchKeyword)
//   searchUrl.searchParams.set("origin", "SWITCH_SEARCH_VERTICAL")
//   if (timeFilter !== "default") {
//     searchUrl.searchParams.set("datePosted", timeFilterMap[timeFilter])
//     searchUrl.searchParams.set("origin", "FACETED_SEARCH")
//   }
//   return searchUrl
// }

/**
 * Navigates to the multi-step linkedin search page
 * This mimics human behavior of navigating to the search page and applying the time filter
 * @param target - The target to navigate to
 * @param searchKeyword - The keyword to search for
 * @param timeFilter - The time filter to use
 * @returns void
 */
async function navigateMultiStepLinkedinSearchPage(
  target: { tabId: number },
  searchKeyword: string,
  timeFilter: TimeFilter
) {
  // step 1 : navigating to the search all page
  let searchUrl = baseSearchAllUrl
  searchUrl.searchParams.set("keywords", searchKeyword)
  searchUrl.searchParams.set("origin", "GLOBAL_SEARCH_HEADER")
  await chrome.debugger.sendCommand(target, "Page.navigate", {
    url: searchUrl.href,
  })
  try {
    console.log(
      getTimeStamp(),
      getTimeStamp(),
      "navigating to ",
      searchUrl.href
    )
    await waitForNetworkIdle({
      tabId: target.tabId,
      timeout: 5000,
      idleTime: 1000,
    })
    console.log(getTimeStamp(), getTimeStamp(), "network is idle")
  } catch (error: any) {
    console.error(getTimeStamp(), "timeout exceeded", error.message)
  }

  // step 2 : navigating to search post page
  searchUrl = baseSearchPostUrl
  searchUrl.searchParams.set("keywords", searchKeyword)
  searchUrl.searchParams.set("origin", "SWITCH_SEARCH_VERTICAL")
  await chrome.debugger.sendCommand(target, "Page.navigate", {
    url: searchUrl.href,
  })
  console.log(getTimeStamp(), getTimeStamp(), "navigating to ", searchUrl.href)
  try {
    await waitForNetworkIdle({
      tabId: target.tabId,
      timeout: 4000,
      idleTime: 1000,
    })
    console.log(getTimeStamp(), getTimeStamp(), "network is idle")
  } catch (error: any) {
    console.error(getTimeStamp(), "timeout exceeded", error.message)
  }
  if (timeFilter === "default") {
    return
  }

  // step 3 : applying the time filter in post page
  searchUrl = baseSearchPostUrl
  searchUrl.searchParams.set("keywords", searchKeyword)
  searchUrl.searchParams.set("datePosted", timeFilterMap[timeFilter])
  searchUrl.searchParams.set("origin", "FACETED_SEARCH")
  await chrome.debugger.sendCommand(target, "Page.navigate", {
    url: searchUrl.href,
  })
  console.log(getTimeStamp(), getTimeStamp(), "navigating to ", searchUrl.href)
  try {
    await waitForNetworkIdle({
      tabId: target.tabId,
      timeout: 4000,
      idleTime: 1000,
    })
    console.log(getTimeStamp(), getTimeStamp(), "network is idle")
  } catch (error: any) {
    console.error(getTimeStamp(), "timeout exceeded", error.message)
  }
  console.log(
    getTimeStamp(),
    "successfully applied the time filter and the url is ",
    searchUrl.href
  )
}

/**
 * Main function that executes the hybrid scraping strategy using chrome.debugger
 * @param tabId - The ID of the tab to scrape
 * @param searchKeyword - The keyword to search for
 * @param timeFilter - The time filter to use
 * @param config - The configuration for the scraper
 * @param maxDepthPx - The maximum depth to scrape in pixels
 * @returns The scraped data
 */
export async function scrapeInfiniteSearchFeedLinkedin(
  tabId: number,
  searchKeyword: string,
  timeFilter: TimeFilter = "default",
  config: Config,
  maxDepthPx: number = 40000
) {
  const target = { tabId }

  // validate maxDepthPx
  if (!zod.number().safeParse(maxDepthPx).success) {
    console.error("maxDepthPx must be a number")
    maxDepthPx = 40000
  }

  try {
    // 1. Attach the debugger to our target tab using CDP version 1.3
    await chrome.debugger.attach(target, "1.3")

    // Read the current state to check if we are resuming
    const storedState = await chrome.storage.local.get([
      "linkedin_scraper_state",
    ])
    const scraperState = (storedState.linkedin_scraper_state ||
      {}) as Partial<ScraperState>

    // Check if the saved configuration matches the current one and has progress
    const isResuming =
      scraperState.keyword === searchKeyword &&
      scraperState.timeFilter === timeFilter &&
      typeof scraperState.currentDepth === "number" &&
      scraperState.currentDepth > 0 &&
      scraperState.status === "paused"

    const initialDepth =
      isResuming && typeof scraperState.currentDepth === "number"
        ? scraperState.currentDepth
        : 0

    // 2. Direct URL Navigation (Bypassing UI clicks) if starting fresh
    if (!timeFilterSchema.safeParse(timeFilter).success) {
      timeFilter = "default"
    }

    await chrome.debugger.sendCommand(target, "Page.enable")
    await chrome.debugger.sendCommand(target, "Network.enable")

    if (!isResuming) {
      await navigateMultiStepLinkedinSearchPage(
        target,
        searchKeyword,
        timeFilter
      )

      try {
        console.log(
          getTimeStamp(),
          "[scrapeInfiniteSearchFeedLinkedin] : Waiting for network idle..."
        )
        await waitForNetworkIdle({
          tabId: tabId,
          idleTime: 500, // Wait for 0.5 second of total silence
          timeout: 6000, // Give up if 6 seconds pass
        })
        console.log(
          getTimeStamp(),
          "[scrapeInfiniteSearchFeedLinkedin] : Network is idle. Ready to simulate scrolling."
        )
      } catch (error: any) {
        console.error(getTimeStamp(), "timeout exceeded", error.message)
      }
    } else {
      console.log(
        getTimeStamp(),
        `[scrapeInfiniteSearchFeedLinkedin] : Resuming scroll from depth: ${initialDepth}px without re-navigating.`
      )
    }

    // Set the state in storage as active
    await chrome.storage.local.set({
      linkedin_scraper_state: {
        status: "scraping",
        tabId,
        keyword: searchKeyword,
        timeFilter,
        maxDepthPx,
        currentDepth: initialDepth,
      },
    })

    // 3. Human-Simulated Scrolling & Interaction loop
    let currentDepth = initialDepth
    let isPaused = false

    while (currentDepth < maxDepthPx) {
      // Before each step, check if the status has changed (e.g., to "paused")
      const currentStored = await chrome.storage.local.get([
        "linkedin_scraper_state",
      ])
      const currentState = (currentStored.linkedin_scraper_state ||
        {}) as Partial<ScraperState>
      if (currentState.status !== "scraping") {
        console.log(
          getTimeStamp(),
          `[scrapeInfiniteSearchFeedLinkedin] : Scraper paused or stopped by external command. Stopping loop at depth: ${currentDepth}px.`
        )
        isPaused = true
        break
      }

      // 1. Fetch real-time metrics before deciding to scroll
      const metrics = await getScrollMetrics(
        target,
        config.targetLinkedinInfiniteScrollableSelector
      )

      // Example: If we have less than 800px of scrollable space left,
      // it means we are near the bottom. LinkedIn's infinite scroll should be triggering.
      await waitForInfinitePageLoadDuringScroll(target, metrics, 800, 4000)

      // Simulate random mouse movement before scrolling to mimic a human reading
      if (Math.random() > 0.8) {
        await simulateHumanMovement(
          target,
          Math.floor(Math.random() * 800) + 100,
          Math.floor(Math.random() * 600) + 100
        )
      }

      // Determine a variable scroll amount for this specific tick
      const scrollStep = getRandomNumberInRange(
        config.minScroll,
        config.maxScroll
      )

      // Execute the scroll via mouseWheel
      // We pass the deltaY parameter in CSS pixels to dictate the vertical scroll distance.
      await mouseScroll(target, scrollStep)

      currentDepth += scrollStep

      // Update progress in chrome local storage
      await chrome.storage.local.set({
        linkedin_scraper_state: {
          ...currentState,
          currentDepth: currentDepth,
        },
      })

      // Add random jitter delay after scrolling down
      await infiniteScrollSleep(config)

      // Decoy action: Randomly scroll up slightly
      // Example: A user scrolling past a post, realizing it was interesting, and scrolling slightly back up.
      if (Math.random() > 0.8) {
        console.log(
          getTimeStamp(),
          `[scrapeInfiniteSearchFeedLinkedin] : Decoy action: Scrolling up`
        )
        const decoyScroll = getRandomNumberInRange(
          config.minDecoyScroll,
          config.maxDecoyScroll
        )
        await mouseScroll(target, -1 * decoyScroll)
        currentDepth = Math.max(0, currentDepth - decoyScroll)

        await chrome.storage.local.set({
          linkedin_scraper_state: {
            ...currentState,
            currentDepth: currentDepth,
          },
        })

        await sleep(
          config.minInfiniteDecoyScrollSleep,
          config.maxInfiniteDecoyScrollSleep
        )
      }
    }

    if (isPaused) {
      console.log(
        getTimeStamp(),
        `[scrapeInfiniteSearchFeedLinkedin] : Exiting execution loop cleanly due to pause request.`
      )
      return
    }

    // 4. Extract DOM via Runtime.evaluate
    // This executes JS directly in the V8 engine, returning the fully hydrated outerHTML
    // without needing to inject content scripts or parse complex DOM node IDs.
    const rawHtml = await extractDOM(target)

    // 5. Stream to S3 Storage
    await uploadToS3(rawHtml, searchKeyword)
    const finalMetrics = await getScrollMetrics(
      target,
      config.targetLinkedinInfiniteScrollableSelector
    )

    const finalStored = await chrome.storage.local.get([
      "linkedin_scraper_state",
    ])
    const finalState = (finalStored.linkedin_scraper_state ||
      {}) as Partial<ScraperState>
    await chrome.storage.local.set({
      linkedin_scraper_state: {
        ...finalState,
        status: "completed",
      },
    })

    console.log(
      getTimeStamp(),
      "[scrapeInfiniteSearchFeedLinkedin] : Scraping task completed successfully.\n",
      "Final metrics: ",
      finalMetrics
    )
  } catch (error) {
    console.error(
      "[scrapeInfiniteSearchFeedLinkedin] : Debugger execution failed:",
      error
    )
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStored = await chrome.storage.local.get([
      "linkedin_scraper_state",
    ])
    const errorState = (errorStored.linkedin_scraper_state ||
      {}) as Partial<ScraperState>
    await chrome.storage.local.set({
      linkedin_scraper_state: {
        ...errorState,
        status: "failed",
        errorMessage: errorMsg,
      },
    })
  } finally {
    // It is critical to detach the debugger to free up browser memory and reset tab state.
    await chrome.debugger.detach(target)
    console.log(
      getTimeStamp(),
      "[scrapeInfiniteSearchFeedLinkedin] : Debugger detached from the target tab."
    )
  }
}
