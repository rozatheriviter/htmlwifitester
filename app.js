// --- Charts & Visuals ---

class Gauge {
    constructor(containerId, maxVal = 100, unit = '') {
        this.container = document.getElementById(containerId);
        this.maxVal = maxVal;
        this.unit = unit;
        this.value = 0;
        this.render();
    }

    render() {
        // SVG Semi-circle gauge
        const radius = 60;
        const stroke = 10;
        const width = 150;
        const height = 80; // Half height
        const cx = width / 2;
        const cy = height - 5; // Bottom padding

        // Circumference of half circle = pi * r
        const circumference = Math.PI * radius;

        this.container.innerHTML = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <path class="gauge-bg" d="M${cx-radius},${cy} A${radius},${radius} 0 0,1 ${cx+radius},${cy}" />
                <path class="gauge-arc" id="${this.container.id}-arc"
                      d="M${cx-radius},${cy} A${radius},${radius} 0 0,1 ${cx+radius},${cy}"
                      stroke-dasharray="${circumference}"
                      stroke-dashoffset="${circumference}" />
            </svg>
        `;
        this.arc = document.getElementById(`${this.container.id}-arc`);
        this.circumference = circumference;
    }

    update(val, maxOverride = null) {
        if (maxOverride) this.maxVal = maxOverride;
        this.value = val;

        // Clamp value
        const displayVal = Math.min(Math.max(val, 0), this.maxVal);
        const percent = displayVal / this.maxVal;

        // Dash offset: 0 = full, circumference = empty
        const offset = this.circumference * (1 - percent);
        this.arc.style.strokeDashoffset = offset;

        // Color logic
        this.arc.className.baseVal = "gauge-arc";
        if (percent > 0.8) this.arc.classList.add('danger');
        else if (percent > 0.5) this.arc.classList.add('warning');
    }
}

class LineChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.data = []; // Array of values
        this.maxPoints = 60; // 60 seconds history
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Handle HIDPI
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
        this.draw();
    }

    addValue(val) {
        this.data.push(val);
        if (this.data.length > this.maxPoints) {
            this.data.shift();
        }
        this.draw();
    }

    draw() {
        if (this.data.length < 2) return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        const maxVal = Math.max(...this.data, 100) * 1.1; // Scale max + 10%
        const minVal = 0;
        const stepX = this.width / (this.maxPoints - 1);

        // Calculate points first
        const points = this.data.map((val, i) => ({
            x: i * stepX,
            y: this.height - ((val - minVal) / (maxVal - minVal) * this.height)
        }));

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#007aff'; // Apple Blue
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Smooth curve
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            // Use quadratic curve for smoothing, control point is p0 (approx)
            // Actually, simpler smoothing:
            // Just draw line for now, but use Bezier if we want perfect smoothness.
            // Let's stick to a slightly smoothed standard approach:
            // Curve from midpoint to midpoint.
            if (i === 0) {
                 this.ctx.lineTo(midX, midY);
            } else {
                 this.ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
            }
        }
        // Connect to last point
        this.ctx.lineTo(points[points.length-1].x, points[points.length-1].y);

        this.ctx.stroke();

        // Fill area with gradient
        this.ctx.lineTo(points[points.length-1].x, this.height);
        this.ctx.lineTo(0, this.height);
        this.ctx.closePath();

        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, 'rgba(0, 122, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 122, 255, 0.0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }
}


// --- Main App ---

class WifiTester {
    constructor() {
        this.isRecording = false;
        this.logs = [];
        this.pingIntervalId = null;
        this.currentLocation = { lat: null, lng: null, acc: null };

        // Stats
        this.pingHistory = [];
        this.successCount = 0;
        this.totalPings = 0;
        
        // Configuration
        this.pingUrl = 'https://www.google.com/generate_204';
        this.pingIntervalMs = 1000;

        this.bindElements();
        this.initVisuals();
        this.attachListeners();
        this.initNetworkMonitor();
        this.initGeoMonitor();
    }

    bindElements() {
        this.els = {
            netType: document.getElementById('net-type'),
            netDownlink: document.getElementById('net-downlink'),
            netSource: document.getElementById('net-source'),

            valLatency: document.getElementById('val-latency'),
            valJitter: document.getElementById('val-jitter'),
            valHealth: document.getElementById('val-health'),

            pingAvg: document.getElementById('ping-avg'),
            pingLoss: document.getElementById('ping-loss'),
            pingCount: document.getElementById('ping-count'),

            geoCoords: document.getElementById('geo-coords'),
            geoAcc: document.getElementById('geo-acc'),

            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            exportBtn: document.getElementById('export-btn'),
            logTableBody: document.querySelector('#log-table tbody')
        };
    }

    initVisuals() {
        this.gaugeLatency = new Gauge('gauge-latency', 500, 'ms');
        this.gaugeJitter = new Gauge('gauge-jitter', 100, 'ms');
        this.gaugeHealth = new Gauge('gauge-health', 100, '%');
        this.chartLatency = new LineChart('latency-chart');

        // Reverse colors for Health (Higher is better)
        // We'll handle this in update logic manually or modify class
    }

    attachListeners() {
        this.els.startBtn.addEventListener('click', () => this.startRecording());
        this.els.stopBtn.addEventListener('click', () => this.stopRecording());
        this.els.exportBtn.addEventListener('click', () => this.exportCsv());
    }

    initNetworkMonitor() {
        const updateConnectionInfo = () => {
            const conn = navigator.connection;
            if (!conn) {
                this.els.netType.textContent = 'Unknown';
                this.els.netSource.textContent = 'None';
                return;
            }

            // Prioritize 'type' (wifi, ethernet) which is often missing in standard Chrome.
            // If missing or unknown, just say 'Unknown' instead of misleading '4G'.
            let type = conn.type;

            if (!type || type === 'unknown') {
                type = 'Unknown'; // User requested to remove misleading 'Effective' fallback
            } else {
                type = type.charAt(0).toUpperCase() + type.slice(1);
            }

            this.els.netType.textContent = type;
            this.els.netDownlink.textContent = conn.downlink || '?';

            // Show where we got the info
            const source = (conn.type && conn.type !== 'unknown') ? 'Network API' : 'Network API (Limited)';
            this.els.netSource.textContent = source;
        };

        if (navigator.connection) {
            navigator.connection.addEventListener('change', updateConnectionInfo);
            // Polling to catch speed changes if event misses
            setInterval(updateConnectionInfo, 5000);
            updateConnectionInfo();
        } else {
            this.els.netType.textContent = 'Not Supported';
        }
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
                    this.els.geoCoords.textContent = `${this.currentLocation.lat}, ${this.currentLocation.lng}`;
                    this.els.geoAcc.textContent = this.currentLocation.acc;
                },
                (err) => {
                    this.els.geoAcc.textContent = 'Error';
                },
                { enableHighAccuracy: true }
            );
        }
    }

    startRecording() {
        this.isRecording = true;
        this.logs = [];
        this.els.logTableBody.innerHTML = '';
        
        this.els.startBtn.disabled = true;
        this.els.stopBtn.disabled = false;
        this.els.exportBtn.disabled = true;

        this.pingHistory = [];
        this.totalPings = 0;
        this.successCount = 0;

        this.pingIntervalId = setInterval(() => this.performPing(), this.pingIntervalMs);
        this.logEvent('START', 0, 0, 'Test started');
    }

    stopRecording() {
        this.isRecording = false;
        clearInterval(this.pingIntervalId);
        
        this.els.startBtn.disabled = false;
        this.els.stopBtn.disabled = true;
        this.els.exportBtn.disabled = false;
        
        this.logEvent('STOP', 0, 0, 'Test stopped');
    }

    async performPing() {
        const start = performance.now();
        const cacheBuster = `?t=${Date.now()}`;
        
        this.totalPings++;

        try {
            await fetch(this.pingUrl + cacheBuster, { mode: 'no-cors', cache: 'no-store' });
            
            const end = performance.now();
            const latency = Math.round(end - start);
            this.successCount++;
            
            this.updateStats(latency);
            
        } catch (error) {
            console.error('Ping failed:', error);
            this.updateStats(null, error);
        }
    }

    updateStats(latency, error = null) {
        let jitter = 0;
        let avg = 0;

        if (latency !== null) {
            this.pingHistory.push(latency);
            if (this.pingHistory.length > 20) this.pingHistory.shift();

            // Calculate Jitter (Standard Deviation of recent pings)
            const n = this.pingHistory.length;
            if (n > 1) {
                const mean = this.pingHistory.reduce((a, b) => a + b) / n;
                avg = Math.round(mean);
                const variance = this.pingHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
                jitter = Math.round(Math.sqrt(variance));
            } else {
                avg = latency;
            }

            // Update Visuals
            this.els.valLatency.textContent = latency;
            this.els.valJitter.textContent = jitter;

            this.gaugeLatency.update(latency);
            this.gaugeJitter.update(jitter);
            this.chartLatency.addValue(latency);

            this.logEvent('PING', latency, jitter, 'OK');

        } else {
            // Packet loss
            this.chartLatency.addValue(0); // or gap?
            this.logEvent('DROP', 0, 0, 'Timeout');
        }

        // Global Stats
        const loss = ((this.totalPings - this.successCount) / this.totalPings * 100).toFixed(1);
        this.els.pingLoss.textContent = loss;
        this.els.pingCount.textContent = this.totalPings;
        this.els.pingAvg.textContent = avg;

        const health = 100 - parseFloat(loss);
        this.els.valHealth.textContent = Math.round(health);
        this.gaugeHealth.update(health);

        // Custom color logic for Health Gauge (High is good)
        // We reuse the update logic but need to invert the "danger" perception manually or via CSS override?
        // Simpler: Just rely on value. If health < 50, it fills less, which is visually distinct.
        // Or we can flip the colors in CSS if needed.
        // For now, let's just accept 100% full is good (green).
        const healthArc = document.getElementById('gauge-health-arc');
        if (healthArc) {
            healthArc.classList.remove('danger', 'warning');
            if (health < 50) healthArc.classList.add('danger');
            else if (health < 80) healthArc.classList.add('warning');
        }
    }

    logEvent(type, latency, jitter, info) {
        if (!this.isRecording) return;

        const now = new Date();
        const isoTime = now.toISOString();
        const displayTime = now.toLocaleTimeString();

        const entry = {
            time: isoTime,
            type: type,
            latency: latency,
            jitter: jitter,
            info: info,
            loss: this.els.pingLoss.textContent,
            lat: this.currentLocation.lat,
            lng: this.currentLocation.lng
        };

        this.logs.push(entry);

        const tr = document.createElement('tr');
        if (type === 'DROP') tr.style.backgroundColor = '#ffebee';
        
        tr.innerHTML = `
            <td>${displayTime}</td>
            <td>${type}</td>
            <td>${latency > 0 ? latency : '-'}</td>
            <td>${jitter > 0 ? jitter : '-'}</td>
            <td>${info}</td>
        `;
        
        this.els.logTableBody.prepend(tr);
    }

    exportCsv() {
        if (this.logs.length === 0) return;

        const headers = ['Timestamp', 'Type', 'Latency', 'Jitter', 'Info', 'Loss %', 'Lat', 'Lng'];
        const rows = this.logs.map(log => [
            log.time, log.type, log.latency, log.jitter, log.info, log.loss, log.lat, log.lng
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'wifi_stats.csv';
        link.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WifiTester();
});
