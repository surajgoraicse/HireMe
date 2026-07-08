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

/**
 * This is used for scraping the linkedin infinite search feed.
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
          console.log(getTimeStamp(), "Waiting for network idle")
          await waitForNetworkIdle({ tabId: tab.id, timeout: 10000 })
          console.log(getTimeStamp(), "Network is now idle")
          scrapeInfiniteSearchFeedLinkedin(
            tab.id,
            message.keyword,
            message.timeFilter || "default",
            config,
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
