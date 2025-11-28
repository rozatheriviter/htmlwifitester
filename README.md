# Chromebook WiFi Coverage Tester

A simple, browser-based tool to map WiFi connectivity, latency, and signal quality across a property. Designed to run on Chromebooks (or any device with a modern browser).

## Features

- **Real-time Status:** Monitors connection type (WiFi, Cellular, etc.), downlink speed, and RTT (Round Trip Time) using the Network Information API.
- **Active Latency Testing:** Pings a lightweight endpoint (Google's `generate_204`) to measure application-layer latency and detect packet drops.
- **Geolocation Mapping:** Tracks your physical location (Latitude/Longitude) to correlate network drops with specific areas.
- **Event Logging:** Records all pings, drops, and status changes in a table.
- **CSV Export:** Download your test session as a `.csv` file for analysis in spreadsheet software.

## How to Use

### Option 1: Hosted (GitHub Pages)
1. Navigate to the hosted URL (e.g., `https://your-username.github.io/wifi-coverage-tester`).
2. Allow **Location Access** when prompted (required for mapping).
3. Click **Start Recording**.
4. Walk around your property.
   - The tool will ping every 2 seconds.
   - If the network drops, it logs a "DROP" event.
5. Click **Stop Recording** when finished.
6. Click **Export CSV** to save your data.

### Option 2: Local
1. Clone this repository.
2. Serve the files using a local web server (Browsers may block Geolocation/Fetch on `file://` URLs).
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in Chrome.

## Requirements

- **Browser:** Google Chrome or a Chromium-based browser (Edge, Opera, Brave).
  - *Note:* Safari and Firefox have limited support for the Network Information API (`navigator.connection`).
- **Hardware:** GPS-enabled device recommended for accurate location tracking.

## License

MIT
