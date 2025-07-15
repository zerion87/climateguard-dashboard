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

    // 1) Sensor-Metadaten laden
    async function loadSensorMetadata() {
        const devicesUrl = "https://api.quantum.hackerban.de/v2/devices";
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

    // 2) Temperatur-Daten laden und Karte updaten
    async function loadTemperatureData() {
        const metricsUrl = "https://api.quantum.hackerban.de/v2/metrics";
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

            // Einträge gruppieren
            entries.forEach(({ device_id, temperature, timestamp_server }) => {
                const id   = device_id;
                const ts   = timestamp_server;
                const temp = parseFloat(temperature);
                if (!sensorData[id]) sensorData[id] = [];
                sensorData[id].push({ timestamp: ts, temperature: temp });
                if (!timeStamps.includes(ts)) timeStamps.push(ts);
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
    }

    // Event-Listener & Initialisierung
    timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    (async function init() {
        await loadSensorMetadata();      // 1x Metadata holen
        await loadTemperatureData();     // erste Meterik-Daten und Karte zeichnen
        setInterval(loadTemperatureData, 600000);  // dann alle 30 s nur die Metriken nachladen
    })();
});
