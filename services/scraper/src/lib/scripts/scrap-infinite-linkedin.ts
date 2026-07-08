import { timeFilterSchema, type TimeFilter } from "@/lib/types/types"
import { uploadToS3 } from "@/lib/uploadToS3"
import { getRandomNumberInRange, sleep } from "@/lib/utils"
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
import logger from "../logger"

const baseUrl = new URL("https://www.linkedin.com/search/results/content/")
const timeFilterMap = {
  "1D": `["past-24h"]`,
  "1W": `["past-week"]`,
  "1M": `["past-month"]`,
}

function getSearchUrl(searchKeyword: string, timeFilter: TimeFilter) {
  const searchUrl = baseUrl
  searchUrl.searchParams.set("keywords", encodeURIComponent(searchKeyword))
  searchUrl.searchParams.set("origin", "SWITCH_SEARCH_VERTICAL")
  if (timeFilter !== "default") {
    searchUrl.searchParams.set(
      "datePosted",
      encodeURIComponent(timeFilterMap[timeFilter])
    )
    searchUrl.searchParams.set("origin", "FACETED_SEARCH")
  }
  return searchUrl.href
}

/**
 * Main function that executes the hybrid scraping strategy using chrome.debugger
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
    logger.error("maxDepthPx must be a number")
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
    const searchUrl = getSearchUrl(searchKeyword, timeFilter)

    await chrome.debugger.sendCommand(target, "Page.enable")
    await chrome.debugger.sendCommand(target, "Page.navigate", {
      url: searchUrl,
    })

    logger.info(
      "[scrapeInfiniteSearchFeedLinkedin] : Waiting for network idle..."
    )
    await waitForNetworkIdle({
      tabId: tabId,
      idleTime: 500, // Wait for 0.5 second of total silence
      timeout: 10000, // Give up if 10 seconds pass
    })
    logger.info(
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
        logger.info(
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

    logger.info(
      "[scrapeInfiniteSearchFeedLinkedin] : Scraping task completed successfully."
    )
  } catch (error) {
    logger.error(
      "[scrapeInfiniteSearchFeedLinkedin] : Debugger execution failed:",
      error
    )
  } finally {
    // It is critical to detach the debugger to free up browser memory and reset tab state.
    await chrome.debugger.detach(target)
    logger.info(
      "[scrapeInfiniteSearchFeedLinkedin] : Debugger detached from the target tab."
    )
  }
}
