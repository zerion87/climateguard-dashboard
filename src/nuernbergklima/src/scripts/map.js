// map.js

document.addEventListener("DOMContentLoaded", function () {
    // Karte initialisieren
    const map = L.map('map').setView([51.1657, 10.4515], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Marker-Cluster und Custom Heatmap-Layer
    const markers = L.markerClusterGroup();
    map.addLayer(markers);
    
    // Custom Heatmap Canvas Layer
    const CustomHeatmapLayer = L.Layer.extend({
        initialize: function(options) {
            L.setOptions(this, options);
            this._data = [];
            this._canvas = null;
            this._ctx = null;
        },
        
        onAdd: function(map) {
            this._map = map;
            this._canvas = L.DomUtil.create('canvas', 'custom-heatmap-layer');
            this._ctx = this._canvas.getContext('2d');
            
            // Canvas styling
            this._canvas.style.position = 'absolute';
            this._canvas.style.top = '0';
            this._canvas.style.left = '0';
            this._canvas.style.pointerEvents = 'none';
            this._canvas.style.zIndex = '200';
            
            map.getPanes().overlayPane.appendChild(this._canvas);
            
            // Event listeners
            map.on('viewreset', this._reset, this);
            map.on('zoom', this._reset, this);
            map.on('move', this._reset, this);
            
            this._reset();
        },
        
        onRemove: function(map) {
            map.getPanes().overlayPane.removeChild(this._canvas);
            map.off('viewreset', this._reset, this);
            map.off('zoom', this._reset, this);
            map.off('move', this._reset, this);
        },
        
        setData: function(data) {
            this._data = data;
            this._redraw();
        },
        
        _reset: function() {
            const size = this._map.getSize();
            const bounds = this._map.getBounds();
            const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
            
            L.DomUtil.setPosition(this._canvas, topLeft);
            this._canvas.width = size.x;
            this._canvas.height = size.y;
            
            this._redraw();
        },
        
        _redraw: function() {
            if (!this._canvas || !this._ctx || this._data.length === 0) return;
            
            const ctx = this._ctx;
            const canvas = this._canvas;
            const zoom = this._map.getZoom();
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate radius based on zoom level (balanced size)
            const baseRadius = Math.max(12, 55 - zoom * 2);
            
            // Create temperature grid to prevent additive effects
            const gridSize = Math.max(5, baseRadius / 3);
            const grid = new Map();
            
            // Map each data point to grid cells and store max temperature per cell
            this._data.forEach(point => {
                const [lat, lng, temp] = point;
                const pixelPoint = this._map.latLngToContainerPoint([lat, lng]);
                
                if (pixelPoint.x >= 0 && pixelPoint.x <= canvas.width && 
                    pixelPoint.y >= 0 && pixelPoint.y <= canvas.height) {
                    
                    const gridX = Math.floor(pixelPoint.x / gridSize);
                    const gridY = Math.floor(pixelPoint.y / gridSize);
                    const gridKey = `${gridX},${gridY}`;
                    
                    // Use maximum temperature in each grid cell (prevents addition)
                    if (!grid.has(gridKey) || grid.get(gridKey).temp < temp) {
                        grid.set(gridKey, {
                            x: pixelPoint.x,
                            y: pixelPoint.y,
                            temp: temp
                        });
                    }
                }
            });
            
            // Draw heatmap points
            grid.forEach(point => {
                const color = this._getColorForTemperature(point.temp);
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, baseRadius
                );
                
                gradient.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.75)'));
                gradient.addColorStop(0.4, color.replace('rgb', 'rgba').replace(')', ', 0.5)'));
                gradient.addColorStop(0.8, color.replace('rgb', 'rgba').replace(')', ', 0.2)'));
                gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0)'));
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(point.x, point.y, baseRadius, 0, 2 * Math.PI);
                ctx.fill();
            });
        },
        
        _getColorForTemperature: function(temp) {
            // Normalize temperature (assuming -10°C to 40°C range)
            const normalized = Math.max(0, Math.min(1, (temp + 10) / 50));
            
            // Color gradient stops (balanced intensity)
            const colors = [
                { pos: 0.0, r: 30, g: 80, b: 255 },     // balanced blue
                { pos: 0.2, r: 0, g: 200, b: 255 },     // balanced cyan
                { pos: 0.4, r: 80, g: 255, b: 80 },     // balanced lime
                { pos: 0.6, r: 255, g: 220, b: 0 },     // balanced yellow
                { pos: 0.8, r: 255, g: 160, b: 0 },     // balanced orange
                { pos: 1.0, r: 255, g: 80, b: 80 }      // balanced red
            ];
            
            // Find the two colors to interpolate between
            let color1 = colors[0];
            let color2 = colors[colors.length - 1];
            
            for (let i = 0; i < colors.length - 1; i++) {
                if (normalized >= colors[i].pos && normalized <= colors[i + 1].pos) {
                    color1 = colors[i];
                    color2 = colors[i + 1];
                    break;
                }
            }
            
            // Interpolate
            const ratio = (normalized - color1.pos) / (color2.pos - color1.pos);
            const r = Math.round(color1.r + (color2.r - color1.r) * ratio);
            const g = Math.round(color1.g + (color2.g - color1.g) * ratio);
            const b = Math.round(color1.b + (color2.b - color1.b) * ratio);
            
            return `rgb(${r}, ${g}, ${b})`;
        }
    });
    
    // Create custom heatmap layer instance
    const customHeatmapLayer = new CustomHeatmapLayer();
    map.addLayer(customHeatmapLayer);

    // Datenstrukturen
    let sensorData = {};   // { sensorId: [ { timestamp, temperature }, … ] }
    let timeStamps = [];   // alle einzigartigen Zeitstempel
    let sensors   = {};    // wird per API befüllt: { device_id: { lat, lon, name } }
    let firstLoad = true;

    // Slider-Elemente
    const timeSlider  = document.getElementById("time-slider");
    const timeDisplay = document.getElementById("selected-time");
    timeSlider.min = 0;

    // --------------------------------------------------
    // Hilfsfunktion: Unix-Timestamp → Berlin-Zeit-String
    function formatBerlinTime(tsSeconds) {
      const date = new Date(tsSeconds * 1000);
      return date.toLocaleString("de-DE", {
        timeZone:   "Europe/Berlin",
        year:       "numeric",
        month:      "2-digit",
        day:        "2-digit",
        hour:       "2-digit",
        minute:     "2-digit",
        second:     "2-digit"
      });
    }

    // Hilfsfunktionen (unverändert)
    function normalizeTemperature(temp, minTemp = -10, maxTemp = 40) {
        return Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    }
    function getTrendArrow(previous, current) {
        const p = Math.round(previous);
        const c = Math.round(current);
        if (c > p) return "🔼";
        if (c < p) return "🔽";
        return "➖";
    }
    function addClusteredMarker(lat, lon, temp, name, trend, timestamp) {
        const rounded = Math.round(temp);
        const icon = L.divIcon({
            className: 'custom-temp-label',
            html: `<div style="font-size:14px;font-weight:bold;">${rounded}°C ${trend}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10]
        });
        const marker = L.marker([lat, lon], { icon });
        marker.bindTooltip(`
            <b>Sensor:</b> ${name}<br>
            <b>Temperatur:</b> ${rounded}°C<br>
            <b>Messzeit:</b> ${formatBerlinTime(timestamp)}
        `, { direction: 'top', offset: [0, -10] });
        markers.addLayer(marker);
    }

    // Funktion zum Zählen aktiver Sensoren und Update der Stat-Card
    function updateActiveSensorsCount() {
        // Zähle Sensoren, die sowohl Metadaten als auch aktuelle Daten haben
        const activeSensors = Object.keys(sensorData).filter(sensorId => {
            return sensors[sensorId] && sensorData[sensorId].length > 0;
        });
        
        const activeCount = activeSensors.length;
        
        // Update der Stat-Card "Sensoren aktiv"
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            const sensorStatCard = statsGrid.querySelector('.stat-card:nth-child(2) h3');
            if (sensorStatCard) {
                sensorStatCard.textContent = activeCount;
            }
        }
        
        console.log(`Aktive Sensoren: ${activeCount}`);
        return activeCount;
    }

    // Funktion zum Finden der höchsten gemessenen Temperatur und Update der Stat-Card
    function updateHighestTemperature() {
        let maxTemp = null;
        Object.values(sensorData).forEach(readings => {
            readings.forEach(r => {
                if (typeof r.temperature === 'number' && !isNaN(r.temperature)) {
                    if (maxTemp === null || r.temperature > maxTemp) {
                        maxTemp = r.temperature;
                    }
                }
            });
        });
        
        // Update der Stat-Card "Ø Temperatur heute"
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            const tempStatCard = statsGrid.querySelector('.stat-card:nth-child(1) h3');
            if (tempStatCard) {
                tempStatCard.textContent = maxTemp !== null ? `${maxTemp.toFixed(1)}°C` : '--';
            }
        }
        
        console.log(`Höchste gemessene Temperatur: ${maxTemp}`);
        return maxTemp;
    }

    // Funktion zum Finden der niedrigsten gemessenen Temperatur und Update der Stat-Card
function updateLowestTemperature() {
    let minTemp = null;

    // Über alle Sensor-Arrays iterieren und minimale Temperatur bestimmen
    Object.values(sensorData || {}).forEach(readings => {
        if (Array.isArray(readings)) {
            readings.forEach(r => {
                if (typeof r.temperature === 'number' && !isNaN(r.temperature)) {
                    if (minTemp === null || r.temperature < minTemp) {
                        minTemp = r.temperature;
                    }
                }
            });
        }
    });

    // Update der Stat-Card "Tiefstwert heute"
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        // Bevorzugt eine explizit markierte Karte, sonst 2. Karte als Fallback
        const target = statsGrid.querySelector('[data-stat="min-temp"] h3')
                  || statsGrid.querySelector('.stat-card:nth-child(4) h3');
        if (target) {
            target.textContent = (minTemp !== null) ? `${minTemp.toFixed(1)}°C` : '--';
        }
    }

    console.log(`Niedrigste gemessene Temperatur: ${minTemp}`);
    return minTemp;
}

    // Funktion zum Finden des größten Temperaturunterschieds in 10-Minuten-Intervallen und Update der Stat-Card
    function updateMaxTemperatureDifference() {
        // 1. Alle Messwerte in 10-Minuten-Buckets gruppieren
        const bucketTemps = {};
        Object.values(sensorData).forEach(readings => {
            readings.forEach(r => {
                if (typeof r.temperature === 'number' && !isNaN(r.temperature)) {
                    // 10-Minuten-Bucket berechnen (timestamp in Sekunden)
                    const bucket = Math.floor(r.timestamp / 600); // 600 Sekunden = 10 Minuten
                    if (!bucketTemps[bucket]) bucketTemps[bucket] = [];
                    bucketTemps[bucket].push(r.temperature);
                }
            });
        });
        // 2. Für jeden Bucket Differenz berechnen
        let maxDiff = null;
        Object.values(bucketTemps).forEach(temps => {
            if (temps.length > 1) {
                const min = Math.min(...temps);
                const max = Math.max(...temps);
                const diff = max - min;
                if (maxDiff === null || diff > maxDiff) {
                    maxDiff = diff;
                }
            }
        });
        // 3. Stat-Card aktualisieren
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            const diffStatCard = statsGrid.querySelector('.stat-card:nth-child(3) h3');
            if (diffStatCard) {
                diffStatCard.textContent = maxDiff !== null ? `${maxDiff.toFixed(1)}°C` : '--';
            }
        }
        console.log(`Größter Temperaturunterschied in 10-Minuten-Intervallen: ${maxDiff}`);
        return maxDiff;
    }

    // 1) Sensor-Metadaten laden
    async function loadSensorMetadata() {
        const devicesUrl = "https://api.quantum.hackerban.de/v2/devices?tag_name=Annapark";
        try {
            const resp = await fetch(devicesUrl);
            if (!resp.ok) {
                console.error("Fehler beim Abruf der Sensor-Metadaten:", await resp.text());
                return;
            }
            const result = await resp.json();
            sensors = {};

            // Nur Devices mit Lat/Lon übernehmen
            result.data.forEach(dev => {
                if (dev.latitude !== null && dev.longitude !== null) {
                    sensors[dev.device_id] = {
                        lat: dev.latitude,
                        lon: dev.longitude,
                        name: dev.name
                    };
                }
            });

            const count = Object.keys(sensors).length;
            if (count === 0) {
                console.warn("Keine gültigen Devices mit Tag 'Annapark' und Geodaten gefunden.");
            } else {
                console.log(`${count} Devices mit Geodaten geladen.`);
            }
        } catch (err) {
            console.error("Fetch-Error (Metadata):", err);
        }
    }

// 2) Temperatur-Daten laden und Karte updaten (nur heute, nur vorher geladene Sensors)
async function loadTemperatureData() {
    // Sensoren sicherstellen
    const deviceIds = Object.keys(sensors);
    if (deviceIds.length === 0) {
        console.warn("Keine Sensoren vorhanden. Bitte erst loadSensorMetadata() aufrufen.");
        return;
    }

// Zeitraum: Anfang und Ende des aktuellen Berliner Tages
const now         = new Date();
const startLocal  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
// Einen Tag drauf für Ende
const endLocal    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

// ISO-Strings (intern in UTC) und URL-encodiert
const minDateIso  = encodeURIComponent(startLocal.toISOString()); // z.B. "2025-07-19T22:00:00.000Z"
const maxDateIso  = encodeURIComponent(endLocal.toISOString());   // z.B. "2025-07-20T22:00:00.000Z"


    // Basis-URL mit den richtigen Parametern aus der Doku
    const baseUrl = `https://api.quantum.hackerban.de/v2/metrics`
        + `?device_ids=${deviceIds.join(",")}`
        + `&min_date=${minDateIso}`
        + `&max_date=${maxDateIso}`
        + `&limit=100`;

    let allEntries = [];
    let page       = 1;
    let hasNext    = true;

    try {
        // Pagination-Schleife
        while (hasNext) {
            const url  = `${baseUrl}&page=${page}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                console.error(`Fehler beim Abruf der Metriken (Seite ${page}):`, await resp.text());
                return;
            }
            const result = await resp.json();

            // Daten sammeln
            allEntries.push(...result.data);

            // pagination-Info auswerten
            const pag = result.pagination;
            console.log(`Seite ${pag.page}/${pag.total_pages} geladen – has_next=${pag.has_next}`);
            hasNext = pag.has_next;
            page += 1;
        }

        // Jetzt allEntries weiterverarbeiten wie zuvor:
        // → Reset, Gruppieren, Sortieren, Karte updaten
        console.group("🔍 Roh-Daten-Einträge");
        console.log(allEntries);
        console.groupEnd();
        console.group("🔍 Gruppierte Sensor-Daten (vorher)");
        console.log(sensorData);
        console.groupEnd();

        sensorData = {};
        timeStamps = [];
        allEntries.forEach(({ device_id, temperature, timestamp_server }) => {
            if (!(device_id in sensors)) return;
            const ts   = timestamp_server;
            const temp = parseFloat(temperature);
            if (!sensorData[device_id]) sensorData[device_id] = [];
            sensorData[device_id].push({ timestamp: ts, temperature: temp });
            if (!timeStamps.includes(ts)) timeStamps.push(ts);
        });

        timeStamps.sort((a, b) => a - b);
        timeSlider.max   = timeStamps.length - 1;
        timeSlider.value = timeSlider.max;
        Object.keys(sensorData).forEach(id => {
            sensorData[id].sort((a, b) => b.timestamp - a.timestamp);
        });
        updateMap(Number(timeSlider.value));
    }
    catch (err) {
        console.error("Fetch-Error (Metrics):", err);
    }
}


    // 3) Karte updaten auf Basis des Sliders
    function updateMap(timeIndex) {
        const idx   = Number(timeIndex);
        const selTs = timeStamps[idx];
        timeDisplay.innerText = formatBerlinTime(selTs);

        markers.clearLayers();
        
        // Collect temperature data for custom heatmap
        const heatmapData = [];

        Object.keys(sensorData).forEach(sensorId => {
            const readings = sensorData[sensorId];
            const sel      = readings.find(r => r.timestamp <= selTs);
            if (!sel) return;

            // Trend basierend auf vorheriger Messung
            const prev = readings.find(r => r.timestamp < sel.timestamp) || null;
            const trend = prev ? getTrendArrow(prev.temperature, sel.temperature) : "➖";

            const meta = sensors[sensorId];
            if (!meta) return;  

            addClusteredMarker(meta.lat, meta.lon, sel.temperature, meta.name, trend, sel.timestamp);
            
            // Add to custom heatmap data (lat, lng, actual temperature)
            heatmapData.push([meta.lat, meta.lon, sel.temperature]);
        });
        
        // Update custom heatmap with new data
        customHeatmapLayer.setData(heatmapData);

// Beim ersten Laden Bounds auf die sichtbaren Marker setzen
if (firstLoad) {
    const b = markers.getBounds(); // MarkerCluster-Bounds
    if (b && b.isValid()) {
        // Wenn nur 1 Marker: sinnvoll näher ran, sonst fitBounds
        if (b.getNorthEast().equals(b.getSouthWest())) {
            map.setView(b.getCenter(), 15); // ggf. Wunschzoom anpassen
        } else {
            map.fitBounds(b, { padding: [50, 50], maxZoom: 17 });
        }
    }
    firstLoad = false;
}
        
        // Statistiken aktualisieren
        updateActiveSensorsCount();
        updateHighestTemperature();
        updateMaxTemperatureDifference();
        updateLowestTemperature();
    }

    // Event-Listener & Initialisierung
    timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    (async function init() {
        await loadSensorMetadata();      // 1x Metadata holen
        await loadTemperatureData();     // erste Metrik-Daten und Karte zeichnen
        setInterval(loadTemperatureData, 600000);  // alle 10 Minuten erneut Metriken nachladen
    })();
});
