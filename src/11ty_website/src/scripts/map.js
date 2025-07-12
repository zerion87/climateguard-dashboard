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
    let firstLoad = true;

    // Slider-Elemente
    const timeSlider  = document.getElementById("time-slider");
    const timeDisplay = document.getElementById("selected-time");
    timeSlider.min = 0;

    // Mapping device_id → Position & Name
    const sensors = {
        1: { lat: 49.440754, lon: 10.942086, name: "Lora3 Sensor" },
        2: { lat: 49.448719, lon: 11.08766,  name: "Andis Sensor" }
    };

    // Hilfsfunktionen
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

    // Daten von API laden
    async function loadTemperatureData() {
        const apiUrl = "https://api.quantum.hackerban.de/v2/metrics";
        try {
            const resp = await fetch(apiUrl);
            if (!resp.ok) {
                console.error("Fehler beim Abruf:", await resp.text());
                return;
            }
            const result  = await resp.json();
            const entries = result.data;

            // Reset
            sensorData = {};
            timeStamps = [];

            // Einträge gruppieren
            entries.forEach(({ device_id, temperature, timestamp_server }) => {
                const id = device_id;
                const ts = timestamp_server;
                const temp = parseFloat(temperature);

                if (!sensorData[id]) sensorData[id] = [];
                sensorData[id].push({ timestamp: ts, temperature: temp });

                if (!timeStamps.includes(ts)) timeStamps.push(ts);
            });

            // Zeitstempel sortieren
            timeStamps.sort((a, b) => a - b);
            timeSlider.max   = timeStamps.length - 1;
            timeSlider.value = timeSlider.max;

            // pro Sensor: readings absteigend sortieren (neuester zuerst)
            Object.keys(sensorData).forEach(id => {
                sensorData[id].sort((a, b) => b.timestamp - a.timestamp);
            });

            // Karte initial updaten
            updateMap(Number(timeSlider.value));
        }
        catch (err) {
            console.error("Fetch-Error:", err);
        }
    }

    // Karte updaten auf Basis des Sliders
    function updateMap(timeIndex) {
        const idx = Number(timeIndex);
        const selTs = timeStamps[idx];
        timeDisplay.innerText = new Date(selTs * 1000).toLocaleString();

        markers.clearLayers();
        heatmapLayer.setLatLngs([]);

        Object.keys(sensorData).forEach(sensorId => {
            const readings = sensorData[sensorId];
            // erstes Reading (absteigend sortiert), das <= selektiertem Timestamp ist
            const sel = readings.find(r => r.timestamp <= selTs);
            if (!sel) return;

            // Trend berechnen: nächster (älterer) Eintrag in der absteigend sortierten Liste
            const i = readings.indexOf(sel);
            const prev = i >= 1 ? readings[i - 1] : null;
            const trend = prev ? getTrendArrow(prev.temperature, sel.temperature) : "➖";

            const { lat, lon, name } = sensors[sensorId] || {};
            if (!lat) return;  // kein Mapping vorhanden

            addClusteredMarker(lat, lon, sel.temperature, name, trend, sel.timestamp);
            heatmapLayer.addLatLng([lat, lon, normalizeTemperature(sel.temperature)]);
        });

        // Beim ersten Mal an alle Sensor-Positionen anpassen
        if (firstLoad) {
            const bounds = new L.LatLngBounds(
                Object.values(sensors).map(s => [s.lat, s.lon])
            );
            map.fitBounds(bounds, { padding: [50, 50] });
            firstLoad = false;
        }
    }

    // Event-Listener
    timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    // Initial laden & Intervall-Refresh
    loadTemperatureData();
    setInterval(loadTemperatureData, 30000);
});
