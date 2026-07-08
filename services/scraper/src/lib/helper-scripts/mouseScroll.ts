import { getRandomNumberInRange } from "../utils"
import { getScrollableContainerBounds } from "./getInfiniteScrollableContainer"

/**
 * Simulates a hardware-level mouse wheel scroll directly over the active feed container.
 * It uses getScrollableContainerBounds to find the scrollable container and then
 * scrolls within that container.
 * 
 * @param target chrome.debugger.Debuggee instance
 * @param scrollAmount number - Amount to scroll
 */
export async function mouseScroll(
  target: chrome.debugger.Debuggee,
  scrollAmount: number
) {
  // 1. Discover where the feed actually lives on the screen
  const bounds = await getScrollableContainerBounds(target)

  // 2. Calculate a safe "hover zone" inside this container.
  // We use a 20% margin padding to avoid accidentally hovering over
  // thin scrollbars, padding edges, or adjacent sticky elements.
  const safeXMin = bounds.x + bounds.width * 0.2
  const safeXMax = bounds.x + bounds.width * 0.8

  // We ensure the Y coordinate is within the visible viewport (e.g., below the navbar)
  // Assuming a standard navbar height of ~100px.
  const safeYMin = Math.max(bounds.y + bounds.height * 0.2, 100)
  const safeYMax = Math.max(bounds.y + bounds.height * 0.8, 200) // Keep cursor in upper half of screen

  // 3. Generate randomized coordinates within the safe zone

  const randomX = getRandomNumberInRange(safeXMin, safeXMax)
  const randomY = getRandomNumberInRange(safeYMin, safeYMax)

  // 4. Optionally simulate moving the mouse to this new location first
  // (adds realism before the wheel actually spins)
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(randomX),
    y: Math.round(randomY),
  })

  // Small pause to mimic physical finger reaction time
  await new Promise((res) => setTimeout(res, Math.random() * 50 + 20))

  // 5. Dispatch the physical wheel event
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: Math.round(randomX),
    y: Math.round(randomY),
    deltaX: 0,
    deltaY: scrollAmount,
  })
}
