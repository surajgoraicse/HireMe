import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "./components/ui/button"
import { loadConfig } from "./lib/config"

export const config = loadConfig()

async function scrapeLinkedinInfiniteSearchFeed() {
  try {
    console.log("Scraping linkedin infinite search feed")
    const res = await chrome.runtime.sendMessage({
      action: "SCRAPE_LINKEDIN_INFINITE_SEARCH_FEED",
      keyword: "software engineer",
      maxDepthPx: 40000,
    })
    console.log("Scraping linkedin infinite search feed result", res)
  } catch (error) {
    console.log("Error scraping linkedin infinite search feed", error)
  }
}

function App() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Project Overview</CardTitle>
        <CardDescription>
          Track progress and recent activity for your Vite app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={scrapeLinkedinInfiniteSearchFeed}>
          Scrape Linkedin Infinite Search Feed
        </Button>
      </CardContent>
    </Card>
  )
}

export default App
