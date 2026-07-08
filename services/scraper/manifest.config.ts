// manifest.config.ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
	manifest_version: 3,
	name: "Scraper",
	description:
		"Extract elements and data from any website into a clean sidebar workspace.",
	version: "1.0.0",

	icons: {
		"16": "public/icon.png",
		"48": "public/icon.png",
		"128": "public/icon.png",
	},

	// 1. Setup the default Sidebar interface page
	side_panel: {
		default_path: "sidepanel.html", // Points to your sidepanel HTML/React file layout
	},

	// 2. Configure the toolbar button to drop down the Side Panel instead of a Popup
	action: {
		default_title: "Open Scraper Workspace",
	},

	// 3. Register the central management Background engine
	background: {
		service_worker: "src/service-workers/background.ts",
		type: "module",
	},

	// 4. Inject the DOM-scraping worker script onto all target pages automatically
	content_scripts: [
		{
			matches: ["https://*.linkedin.com/*"],
			js: ["src/content-scripts/content.ts"],
			run_at: "document_end", // Injects right after DOM trees compile
		},
	],

	// 5. Explicit permissions required for scraping and persistence
	permissions: [
		"sidePanel", // Required to initialize and manage the sidebar framework
		"storage", // To cache scraped text, CSV tables, or user login files
		"activeTab", // High-privilege secure script access to the page you are viewing
		"scripting", // Allows the try/catch programmatic fallback injection engine to run
		"debugger",
		"webNavigation",
		"tabs",
		"webRequest"
	],
});
