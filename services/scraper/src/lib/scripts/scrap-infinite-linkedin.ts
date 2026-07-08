import type { TIME_FILTER } from "@/lib/types"
import { uploadToS3 } from "@/lib/uploadToS3"
import { sleep } from "@/lib/utils"
import { waitForNetworkIdle } from "../../service-workers/utils/waitForNetworkIdle"
import { simulateHumanMovement } from "./random-mouse-movement"

const baseUrl = new URL("https://www.linkedin.com/search/results/content/")
const timeFilterMap = {
  "1D": `["past-24h"]`,
  "1W": `["past-week"]`,
  "1M": `["past-month"]`,
}

function getSearchUrl(searchKeyword: string, timeFilter: TIME_FILTER) {
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
  timeFilter: TIME_FILTER = "default",
  maxDepthPx: number
) {
  const target = { tabId }

  try {
    // 1. Attach the debugger to our target tab using CDP version 1.3
    await chrome.debugger.attach(target, "1.3")

    // 2. Direct URL Navigation (Bypassing UI clicks)
    // We construct the LinkedIn Search URL for the Feed/Posts.
    const searchUrl = getSearchUrl(searchKeyword, timeFilter)

    await chrome.debugger.sendCommand(target, "Page.enable")
    await chrome.debugger.sendCommand(target, "Page.navigate", {
      url: searchUrl,
    })

    console.log("Waiting for network idle...")
    await waitForNetworkIdle({
      tabId: tabId,
      idleTime: 500, // Wait for 1 second of total silence
      timeout: 10000, // Give up if 20 seconds pass
    })
    console.log("Network is idle. Ready to simulate scrolling.")

    // 3. Human-Simulated Scrolling & Interaction loop
    let currentDepth = 0

    while (currentDepth < maxDepthPx) {
      // Simulate random mouse movement before scrolling to mimic a human reading
      if (Math.random() > 0.8) {
        await simulateHumanMovement(
          target,
          Math.floor(Math.random() * 800) + 100,
          Math.floor(Math.random() * 600) + 100
        )
      }

      // Determine a variable scroll amount for this specific tick
      const scrollStep = Math.floor(Math.random() * 400) + 200 // Between 200px and 600px

      // Execute the scroll via mouseWheel
      // We pass the deltaY parameter in CSS pixels to dictate the vertical scroll distance.
      await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: 500, // Simulated cursor locked near the center of the screen
        y: 500, // Simulated cursor locked near the center of the screen
        deltaX: 0,
        deltaY: scrollStep,
      })

      currentDepth += scrollStep

      // Add random jitter delay after scrolling down
      await sleep(1500, 4000)

      // Decoy action: Randomly scroll up slightly
      // Example: A user scrolling past a post, realizing it was interesting, and scrolling slightly back up.
      if (Math.random() > 0.7) {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x: 500,
          y: 500,
          deltaX: 0,
          deltaY: -150,
        })
        await sleep(1000, 2000)
      }
    }

    // 4. Extract DOM via Runtime.evaluate
    // This executes JS directly in the V8 engine, returning the fully hydrated outerHTML
    // without needing to inject content scripts or parse complex DOM node IDs.
    const { result } = (await chrome.debugger.sendCommand(
      target,
      "Runtime.evaluate",
      {
        expression: "document.documentElement.outerHTML",
        returnByValue: true,
      }
    )) as any

    const rawHtml = result.value

    // 5. Stream to S3 Storage
    await uploadToS3(rawHtml, searchKeyword)

    console.log("Scraping task completed successfully.")
  } catch (error) {
    console.error("Debugger execution failed:", error)
  } finally {
    // It is critical to detach the debugger to free up browser memory and reset tab state.
    await chrome.debugger.detach(target)
  }
}

/**
 * Listener that acts as the entry point for commands coming from our Scheduler/Dashboard.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "SCRAPE_LINKEDIN_INFINITE_SEARCH_FEED") {
    // We open a fresh tab specifically for this scraping task to maintain a clean session
    if (!message.keyword || message.keyword === "") {
      sendResponse({ status: "Invalid Search Keyword" })
      return
    }
    if (!message.maxDepthPx || message.maxDepthPx <= 0) {
      message.maxDepthPx = 40000
    }
    chrome.tabs.create({ url: "https://www.linkedin.com" }, async (tab) => {
      if (tab.id) {
        try {
          await waitForNetworkIdle({ tabId: tab.id, timeout: 10000 })
          scrapeInfiniteSearchFeedLinkedin(
            tab.id,
            message.keyword,
            message.timeFilter || "default",
            message.maxDepthPx
          )
        } catch (error) {
          console.error("Scrapping Failed error:", error)
          sendResponse({ status: "Scrapping Failed", error: error })
        }
      }
    })
    sendResponse({ status: "Task Initiated" })
  }
})
