// lib/mouse-simulator.ts

import logger from "../logger"
import { sleep } from "../utils"

/**
 * Calculates a point on a cubic Bézier curve based on progression t (0 to 1).
 */
function getCubicBezierPoint(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t
  return (
    Math.pow(u, 3) * p0 +
    3 * Math.pow(u, 2) * t * p1 +
    3 * u * Math.pow(t, 2) * p2 +
    Math.pow(t, 3) * p3
  )
}

/**
 * Generates an array of coordinates representing a curved, human-like path.
 */
function generateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number
) {
  // We randomly offset the control points to ensure the curve maintains a smooth, consistent arc, much like a human hand would naturally sweep.
  const control1X = startX + (endX - startX) * 0.3 + (Math.random() * 100 - 50)
  const control1Y = startY + (endY - startY) * 0.1 + (Math.random() * 100 - 50)
  const control2X = startX + (endX - startX) * 0.7 + (Math.random() * 100 - 50)
  const control2Y = startY + (endY - startY) * 0.9 + (Math.random() * 100 - 50)

  const path = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps

    // We introduce stochastic micro-adjustments akin to hand tremors.
    const jitterX = Math.random() * 2 - 1
    const jitterY = Math.random() * 2 - 1

    const x =
      getCubicBezierPoint(t, startX, control1X, control2X, endX) + jitterX
    const y =
      getCubicBezierPoint(t, startY, control1Y, control2Y, endY) + jitterY

    path.push({ x: Math.round(x), y: Math.round(y) })
  }
  return path
}

/**
 * Simulates a human moving the mouse to trace text while reading.
 * @param target chrome.debugger.Debuggee instance
 * @param startX number - Starting X coordinate of the mouse in viewport
 * @param startY number - Starting Y coordinate of the mouse in viewport
 */
export async function simulateHumanMovement(
  target: chrome.debugger.Debuggee,
  startX: number,
  startY: number
) {
  logger.info(
    `[simulateHumanMovement ${Date.now().toLocaleString()}] : Simulating human movement from (${startX}, ${startY})`
  )

  // A human reading might move left to right, down a few lines, and pause.
  // Example: Reading a paragraph consisting of 2 to 4 lines.
  const readingLines = Math.floor(Math.random() * 3) + 2

  let currentX = startX
  let currentY = startY

  for (let line = 0; line < readingLines; line++) {
    // 1. Move across the screen (left to right) simulating reading a sentence
    const endX = currentX + Math.floor(Math.random() * 300) + 200 // Move 200-500px right
    const endY = currentY + Math.floor(Math.random() * 10) - 5 // Slight vertical drift

    // We discretize the curve into steps. Modern implementations account for mouse speed variations by altering these steps.
    const steps = Math.floor(Math.random() * 15) + 25
    const path = generateBezierPath(currentX, currentY, endX, endY, steps)

    for (const point of path) {
      await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: point.x,
        y: point.y,
      })

      // Variable speed profile: we apply a randomized delay between events to mimic realistic motion models.
      await sleep(5, 15)
    }

    currentX = endX
    currentY = endY

    // 2. Pause at the end of the line/paragraph
    // Example: Taking a moment to comprehend the sentence before moving on.
    await sleep(400, 1200)

    // 3. Snap back to the left and slightly down for the next line
    if (line < readingLines - 1) {
      const nextLineX = startX + Math.floor(Math.random() * 40) - 20 // Rough return to left
      const nextLineY = currentY + Math.floor(Math.random() * 30) + 20 // Move down 20-50px

      const returnSteps = Math.floor(Math.random() * 10) + 10 // Faster return sweep
      const returnPath = generateBezierPath(
        currentX,
        currentY,
        nextLineX,
        nextLineY,
        returnSteps
      )

      for (const point of returnPath) {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: point.x,
          y: point.y,
        })
        await sleep(3, 8)
      }

      currentX = nextLineX
      currentY = nextLineY

      await sleep(200, 600)
    }
  }
  logger.info("[simulateHumanMovement] : Human movement simulation completed")
}
