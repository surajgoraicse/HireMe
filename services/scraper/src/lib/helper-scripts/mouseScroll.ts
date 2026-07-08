import { getSafeViewports } from "../utils"

export async function mouseScroll(
  target: chrome.debugger.Debuggee,
  scrollAmount: number
) {
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: getSafeViewports()[0],
    y: getSafeViewports()[1],
    deltaX: 0,
    deltaY: scrollAmount,
  })
}
