// map.js

document.addEventListener("DOMContentLoaded", function () {
    // Karte initialisieren
    const map = L.map('map').setView([51.1657, 10.4515], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Marker-Cluster und Heatmap-Layer
    const markers = L.markerClusterGroup();
    const heatmapLayer = L.heatLayer([], {
        radius: 25,
        blur: 5,
        maxZoom: 10,
        gradient: {
            0.0: "blue",
            0.2: "cyan",
            0.4: "lime",
            0.6: "yellow",
            0.8: "orange",
            1.0: "red"
        }
    }).addTo(map);
    map.addLayer(markers);

    // Datenstrukturen
    let sensorData = {};   // { sensorId: [ { timestamp, temperature }, … ] }
    let timeStamps = [];   // alle einzigartigen Zeitstempel
    let sensors   = {};    // wird per API befüllt: { device_id: { lat, lon, name } }
    let firstLoad = true;

    // Slider-Elemente
    const timeSlider  = document.getElementById("time-slider");
    const timeDisplay = document.getElementById("selected-time");
    timeSlider.min = 0;

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
            <b>Messzeit:</b> ${new Date(timestamp * 1000).toLocaleString()}
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
            const sensorStatCard = statsGrid.querySelector('.stat-card:nth-child(2)');
            if (sensorStatCard) {
                const h3Element = sensorStatCard.querySelector('h3');
                if (h3Element) {
                    h3Element.textContent = activeCount.toString();
                }
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
            const tempStatCard = statsGrid.querySelector('.stat-card:nth-child(1)');
            if (tempStatCard) {
                const h3Element = tempStatCard.querySelector('h3');
                if (h3Element) {
                    h3Element.textContent = maxTemp !== null ? `${maxTemp.toFixed(1)}°C` : '--';
                }
            }
        }
        
        console.log(`Höchste gemessene Temperatur: ${maxTemp}`);
        return maxTemp;
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
            const diffStatCard = statsGrid.querySelector('.stat-card:nth-child(3)');
            if (diffStatCard) {
                const h3Element = diffStatCard.querySelector('h3');
                if (h3Element) {
                    h3Element.textContent = maxDiff !== null ? `${maxDiff.toFixed(1)}°C` : '--';
                }
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
            result.data.forEach(dev => {
                if (dev.latitude !== null && dev.longitude !== null) {
                    sensors[dev.device_id] = {
                        lat: dev.latitude,
                        lon: dev.longitude,
                        name: dev.name
                    };
                }
            });
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

    // Zeitraum: Anfang und Ende des aktuellen Tages
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startIso   = startOfDay.toISOString();
    const endIso     = endOfDay.toISOString();

    // Metrics-Request mit device_ids + Zeitfilter
    const metricsUrl = `https://api.quantum.hackerban.de/v2/metrics`
        + `?device_ids=${deviceIds.join(",")}`
        + `&start=${encodeURIComponent(startIso)}`
        + `&end=${encodeURIComponent(endIso)}`;

    try {
        const resp = await fetch(metricsUrl);
        if (!resp.ok) {
            console.error("Fehler beim Abruf der Metriken:", await resp.text());
            return;
        }
        const result  = await resp.json();
        const entries = result.data;

        // Reset
        sensorData = {};
        timeStamps = [];

        // Einträge gruppieren (nur für IDs, die in sensors existieren)
        entries.forEach(({ device_id, temperature, timestamp_server }) => {
            if (!(device_id in sensors)) return;

            const ts   = timestamp_server;
            const temp = parseFloat(temperature);
            if (!sensorData[device_id]) sensorData[device_id] = [];
            sensorData[device_id].push({ timestamp: ts, temperature: temp });

            if (!timeStamps.includes(ts)) {
                timeStamps.push(ts);
            }
        });

        // Zeitstempel sortieren und Slider-Range setzen
        timeStamps.sort((a, b) => a - b);
        timeSlider.max   = timeStamps.length - 1;
        timeSlider.value = timeSlider.max;

        // pro Sensor: readings sortieren (neuester zuerst)
        Object.keys(sensorData).forEach(id => {
            sensorData[id].sort((a, b) => b.timestamp - a.timestamp);
        });

        // Karte initial updaten
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
        timeDisplay.innerText = new Date(selTs * 1000).toLocaleString();

        markers.clearLayers();
        heatmapLayer.setLatLngs([]);

        Object.keys(sensorData).forEach(sensorId => {
            const readings = sensorData[sensorId];
            const sel      = readings.find(r => r.timestamp <= selTs);
            if (!sel) return;

            // hier nur die tatsächlich ältere Messung nehmen:
            const prev = readings.find(r => r.timestamp < sel.timestamp) || null;
            const trend = prev ? getTrendArrow(prev.temperature, sel.temperature) : "➖";

            const meta = sensors[sensorId];
            if (!meta) return;  // kein Mapping vorhanden => überspringen

            addClusteredMarker(meta.lat, meta.lon, sel.temperature, meta.name, trend, sel.timestamp);
            heatmapLayer.addLatLng([meta.lat, meta.lon, normalizeTemperature(sel.temperature)]);
        });

        if (firstLoad) {
            const coords = Object.values(sensors).map(s => [s.lat, s.lon]);
            if (coords.length) {
                const bounds = new L.LatLngBounds(coords);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
            firstLoad = false;
        }
        
        // Update der aktiven Sensoren-Anzahl
        updateActiveSensorsCount();
        // Update der höchsten Temperatur
        updateHighestTemperature();
        // Update des größten Temperaturunterschieds
        updateMaxTemperatureDifference();
    }

    // Event-Listener & Initialisierung
    timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    (async function init() {
        await loadSensorMetadata();      // 1x Metadata holen
        await loadTemperatureData();     // erste Meterik-Daten und Karte zeichnen
        setInterval(loadTemperatureData, 600000);  // dann alle 30 s nur die Metriken nachladen
    })();
});
