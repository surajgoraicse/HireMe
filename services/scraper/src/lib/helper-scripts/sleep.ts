import type { Config } from "../config"
import logger from "../logger"
import { sleep } from "../utils"

/**
 * This function is used to simulate the random delay between scroll actions
 * 
 * It does long sleep for 30% of the time and short sleep for 70% of the time
 */
export function infiniteScrollSleep(config: Config) {
  if (Math.random() < 0.7) {
    logger.info(`[infiniteScrollSleep] : Short sleep`)
    return sleep(
      config.minInfiniteScrollShortSleep,
      config.maxInfiniteScrollShortSleep
    )
  } else {
    logger.info(`[infiniteScrollSleep] : Long sleep`)
    return sleep(
      config.minInfiniteScrollLongSleep,
      config.maxInfiniteScrollLongSleep
    )
  }
}
