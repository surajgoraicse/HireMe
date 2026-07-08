// Content script - runs on web pages

import { getTimeStamp } from "@/lib/utils";

// This file can be used to interact with page DOM and send messages to the background script
console.log(getTimeStamp(), "Content script loaded")
