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
  console.log(getTimeStamp(), getTimeStamp(), "navigating to ", searchUrl.href)
  await waitForNetworkIdle({
    tabId: target.tabId,
    timeout: 4000,
    idleTime: 1000,
  })
  console.log(getTimeStamp(), getTimeStamp(), "network is idle")

  // step 2 : navigating to search post page
  searchUrl = baseSearchPostUrl
  searchUrl.searchParams.set("keywords", searchKeyword)
  searchUrl.searchParams.set("origin", "SWITCH_SEARCH_VERTICAL")
  await chrome.debugger.sendCommand(target, "Page.navigate", {
    url: searchUrl,
  })
  console.log(getTimeStamp(), getTimeStamp(), "navigating to ", searchUrl.href)
  await waitForNetworkIdle({
    tabId: target.tabId,
    timeout: 4000,
    idleTime: 1000,
  })
  console.log(getTimeStamp(), getTimeStamp(), "network is idle")
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
  await waitForNetworkIdle({
    tabId: target.tabId,
    timeout: 4000,
    idleTime: 1000,
  })
  console.log(getTimeStamp(), getTimeStamp(), "network is idle")
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

    // 2. Direct URL Navigation (Bypassing UI clicks)
    // We construct the LinkedIn Search URL for the Feed/Posts.
    if (!timeFilterSchema.safeParse(timeFilter).success) {
      timeFilter = "default"
    }

    await chrome.debugger.sendCommand(target, "Page.enable")
    await navigateMultiStepLinkedinSearchPage(target, searchKeyword, timeFilter)

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

    // 3. Human-Simulated Scrolling & Interaction loop
    let currentDepth = 0

    while (currentDepth < maxDepthPx) {
      // 1. Fetch real-time metrics before deciding to scroll
      const metrics = await getScrollMetrics(target)

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

      // Add random jitter delay after scrolling down
      await infiniteScrollSleep(config)

      // Decoy action: Randomly scroll up slightly
      // Example: A user scrolling past a post, realizing it was interesting, and scrolling slightly back up.
      if (Math.random() > 0.8) {
        console.log(
          getTimeStamp(),
          `[scrapeInfiniteSearchFeedLinkedin] : Decoy action: Scrolling up`
        )
        await mouseScroll(
          target,
          -1 *
            getRandomNumberInRange(config.minDecoyScroll, config.maxDecoyScroll)
        )
        await sleep(
          config.minInfiniteDecoyScrollSleep,
          config.maxInfiniteDecoyScrollSleep
        )
      }
    }

    // 4. Extract DOM via Runtime.evaluate
    // This executes JS directly in the V8 engine, returning the fully hydrated outerHTML
    // without needing to inject content scripts or parse complex DOM node IDs.
    const rawHtml = await extractDOM(target)

    // 5. Stream to S3 Storage
    await uploadToS3(rawHtml, searchKeyword)
    const finalMetrics = await getScrollMetrics(target)

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
  } finally {
    // It is critical to detach the debugger to free up browser memory and reset tab state.
    await chrome.debugger.detach(target)
    console.log(
      getTimeStamp(),
      "[scrapeInfiniteSearchFeedLinkedin] : Debugger detached from the target tab."
    )
  }
}
