class WifiTester {
    constructor() {
        this.isRecording = false;
        this.logs = [];
        this.pingIntervalId = null;
        this.currentLocation = { lat: null, lng: null, acc: null };
        this.pingCount = 0;
        this.successCount = 0;
        
        // Configuration
        this.pingUrl = 'https://www.google.com/generate_204'; // Lightweight endpoint often used for connectivity checks
        this.pingIntervalMs = 2000; // Ping every 2 seconds

        this.bindElements();
        this.attachListeners();
        this.initNetworkMonitor();
        this.initGeoMonitor();
    }

    bindElements() {
        this.els = {
            status: document.getElementById('connection-status'),
            netType: document.getElementById('net-type'),
            netDownlink: document.getElementById('net-downlink'),
            netRtt: document.getElementById('net-rtt'),
            pingLatency: document.getElementById('ping-latency'),
            pingSuccess: document.getElementById('ping-success'),
            geoLat: document.getElementById('geo-lat'),
            geoLng: document.getElementById('geo-lng'),
            geoAcc: document.getElementById('geo-acc'),
            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            exportBtn: document.getElementById('export-btn'),
            logTableBody: document.querySelector('#log-table tbody')
        };
    }

    attachListeners() {
        this.els.startBtn.addEventListener('click', () => this.startRecording());
        this.els.stopBtn.addEventListener('click', () => this.stopRecording());
        this.els.exportBtn.addEventListener('click', () => this.exportCsv());
        
        window.addEventListener('online', () => this.updateStatus('Online', 'online'));
        window.addEventListener('offline', () => this.updateStatus('Offline', 'offline'));
    }

    initNetworkMonitor() {
        // navigator.connection is available in Chrome/Chromium
        if (navigator.connection) {
            const updateConnectionInfo = () => {
                const conn = navigator.connection;
                this.els.netType.textContent = conn.effectiveType || conn.type || 'unknown';
                this.els.netDownlink.textContent = conn.downlink || '?';
                this.els.netRtt.textContent = conn.rtt || '?';
            };
            
            navigator.connection.addEventListener('change', updateConnectionInfo);
            updateConnectionInfo();
        }

        this.updateStatus(navigator.onLine ? 'Online' : 'Offline', navigator.onLine ? 'online' : 'offline');
    }

    initGeoMonitor() {
        if ('geolocation' in navigator) {
            navigator.geolocation.watchPosition(
                (pos) => {
                    this.currentLocation = {
                        lat: pos.coords.latitude.toFixed(6),
                        lng: pos.coords.longitude.toFixed(6),
                        acc: pos.coords.accuracy.toFixed(1)
                    };
                    this.updateGeoDisplay();
                },
                (err) => {
                    console.error('Geo error:', err);
                    this.els.geoAcc.textContent = 'Error: ' + err.message;
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 10000,
                    timeout: 5000
                }
            );
        } else {
            this.els.geoAcc.textContent = 'Not supported';
        }
    }

    updateGeoDisplay() {
        this.els.geoLat.textContent = this.currentLocation.lat || '-';
        this.els.geoLng.textContent = this.currentLocation.lng || '-';
        this.els.geoAcc.textContent = this.currentLocation.acc || '-';
    }

    updateStatus(text, className) {
        this.els.status.textContent = text;
        this.els.status.className = 'status-indicator ' + className;
        
        if (this.isRecording && className === 'offline') {
            this.logEvent('DROP', 0);
        }
    }

    startRecording() {
        this.isRecording = true;
        this.logs = []; // Clear logs or keep? Let's clear for new session
        this.els.logTableBody.innerHTML = '';
        
        this.els.startBtn.disabled = true;
        this.els.stopBtn.disabled = false;
        this.els.exportBtn.disabled = true;

        this.pingCount = 0;
        this.successCount = 0;

        // Start ping loop
        this.pingIntervalId = setInterval(() => this.performPing(), this.pingIntervalMs);
        this.logEvent('START', 0);
    }

    stopRecording() {
        this.isRecording = false;
        clearInterval(this.pingIntervalId);
        
        this.els.startBtn.disabled = false;
        this.els.stopBtn.disabled = true;
        this.els.exportBtn.disabled = false;
        
        this.logEvent('STOP', 0);
    }

    async performPing() {
        const start = performance.now();
        const cacheBuster = `?t=${Date.now()}`;
        
        this.pingCount++;

        try {
            // mode: 'no-cors' allows us to ping domains that don't explicitly allow CORS.
            // We won't get content, but we will know if it succeeded or failed (network error).
            await fetch(this.pingUrl + cacheBuster, { mode: 'no-cors', cache: 'no-store' });
            
            const end = performance.now();
            const latency = Math.round(end - start);
            this.successCount++;
            
            this.els.pingLatency.textContent = latency;
            this.logEvent('PING', latency);
            
        } catch (error) {
            console.error('Ping failed:', error);
            this.els.pingLatency.textContent = 'Timeout/Err';
            this.logEvent('DROP', 0); // Network error considered a drop/packet loss
        }

        const rate = Math.round((this.successCount / this.pingCount) * 100);
        this.els.pingSuccess.textContent = rate;
    }

    logEvent(type, latency) {
        if (!this.isRecording) return;

        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        const isoTime = now.toISOString();

        const entry = {
            time: isoTime,
            type: type,
            latency: latency,
            lat: this.currentLocation.lat,
            lng: this.currentLocation.lng,
            acc: this.currentLocation.acc,
            netType: this.els.netType.textContent,
            downlink: this.els.netDownlink.textContent
        };

        this.logs.push(entry);
        this.addTableRow(entry, timestamp);
    }

    addTableRow(entry, displayTime) {
        const tr = document.createElement('tr');
        if (entry.type === 'DROP') {
            tr.style.backgroundColor = '#ffebee'; // Light red for drops
        }
        
        tr.innerHTML = `
            <td>${displayTime}</td>
            <td>${entry.type}</td>
            <td>${entry.latency > 0 ? entry.latency + 'ms' : '-'}</td>
            <td>${entry.lat ? `${entry.lat}, ${entry.lng}` : 'Pending...'}</td>
        `;
        
        // Prepend to show newest first
        this.els.logTableBody.prepend(tr);
    }

    exportCsv() {
        if (this.logs.length === 0) return;

        const headers = ['Timestamp', 'Event Type', 'Latency (ms)', 'Latitude', 'Longitude', 'Accuracy (m)', 'Network Type', 'Downlink (Mbps)'];
        const rows = this.logs.map(log => [
            log.time,
            log.type,
            log.latency,
            log.lat,
            log.lng,
            log.acc,
            log.netType,
            log.downlink
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'wifi_test_log.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new WifiTester();
});
