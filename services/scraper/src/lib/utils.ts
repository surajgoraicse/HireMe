import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility function to sleep for a random duration between min and max milliseconds.
 * This is crucial for our jitter and human-simulation.
 */
export const sleep = (min: number, max: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  )

export const getRandomNumberInRange = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

export function getSafeViewports(): [number, number] {
  return [
    500 + getRandomNumberInRange(-100, 100),
    500 + getRandomNumberInRange(-100, 100),
  ]
}

export function getTimeStamp(): string {
  return new Date().toLocaleString()
}
