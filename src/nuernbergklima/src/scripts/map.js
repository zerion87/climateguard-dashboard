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

    // Zeitraum: Anfang und Ende des aktuellen Berliner Tages in UTC convertiert
    const now      = new Date();
    const startOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startUtc = new Date(startOfDayLocal.getTime() - startOfDayLocal.getTimezoneOffset() * 60000);
    const endUtc   = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    const minDateIso = encodeURIComponent(startUtc.toISOString());
    const maxDateIso = encodeURIComponent(endUtc.toISOString());

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
        heatmapLayer.setLatLngs([]);

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
            heatmapLayer.addLatLng([meta.lat, meta.lon, normalizeTemperature(sel.temperature)]);
        });

        // Beim ersten Laden Bounds setzen
        if (firstLoad) {
            const coords = Object.values(sensors).map(s => [s.lat, s.lon]);
            if (coords.length) {
                const bounds = new L.LatLngBounds(coords);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
            firstLoad = false;
        }
        
        // Statistiken aktualisieren
        updateActiveSensorsCount();
        updateHighestTemperature();
        updateMaxTemperatureDifference();
    }

    // Event-Listener & Initialisierung
    timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    (async function init() {
        await loadSensorMetadata();      // 1x Metadata holen
        await loadTemperatureData();     // erste Metrik-Daten und Karte zeichnen
        setInterval(loadTemperatureData, 600000);  // alle 10 Minuten erneut Metriken nachladen
    })();
});
