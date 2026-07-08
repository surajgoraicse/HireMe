import log, { type Logger as LoggerInstance, type LogLevelDesc } from "loglevel"
import { config } from "./config"
import { getTimeStamp } from "./utils"

interface ILogger {
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}

// function newLogger(level: LogLevelDesc) {
//   try {
//     log.setLevel(level)
//   } catch (error) {
//     log.setLevel("debug")
//     console.error(
//       "Failed to set log level to",
//       level,
//       "setting to debug",
//       error
//     )
//   } finally {
//     return log
//   }
// }

// type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent"

/**
 * Logger class is the custom implementation of the loglevel package
 * It is used to log messages to the console with timestamp
 */
class Logger implements ILogger {
  private logInstance: LoggerInstance
  constructor(logInstance: LoggerInstance, level: LogLevelDesc) {
    this.logInstance = logInstance
    try {
      this.logInstance.setLevel(level)
    } catch (error) {
      this.logInstance.setLevel("debug")
      console.error(
        "Failed to set log level to",
        level,
        "setting to debug",
        error
      )
    }
  }
  info(message: string, ...args: any[]): void {
    this.logInstance.info(getTimeStamp(), message, ...args)
  }
  warn(message: string, ...args: any[]): void {
    this.logInstance.warn(getTimeStamp(), message, ...args)
  }
  error(message: string, ...args: any[]): void {
    this.logInstance.error(getTimeStamp(), message, ...args)
  }
  debug(message: string, ...args: any[]): void {
    this.logInstance.debug(getTimeStamp(), message, ...args)
  }
}

const logger = new Logger(log, config.logLevel as LogLevelDesc)

export default logger
