document.addEventListener("DOMContentLoaded", function () {
    var map = L.map('map').setView([51.1657, 10.4515], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let markers = L.markerClusterGroup();
    let heatmapLayer = L.heatLayer([], {
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

    let sensorData = {};
    let timeStamps = [];
    let timeSlider = document.getElementById("time-slider");
    let timeDisplay = document.getElementById("selected-time");
    let firstLoad = true;

    timeSlider.min = 0;

    // Nun mit numerischen Device-IDs
    const sensors = {
        1: { lat: 49.440754, lon: 10.942086, name: "Lora3 Sensor" },
        2: { lat: 49.448719, lon: 11.08766,  name: "Andis Sensor" }
    };

    function normalizeTemperature(temp, minTemp = -10, maxTemp = 40) {
        return Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    }

    function getTrendArrow(previous, current) {
        let prevRounded = Math.round(previous);
        let currentRounded = Math.round(current);
        if (currentRounded > prevRounded) return "🔼";
        if (currentRounded < prevRounded) return "🔽";
        return "➖";
    }

    function addClusteredMarker(lat, lon, temp, name, trend, timestamp) {
        let roundedTemp = Math.round(temp);
        let tempLabel = L.divIcon({
            className: 'custom-temp-label',
            html: `<div style="font-size: 14px; font-weight: bold;">${roundedTemp}°C ${trend}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, 10]
        });
        let marker = L.marker([lat, lon], { icon: tempLabel });
        marker.bindTooltip(`
            <b>Sensor:</b> ${name}<br>
            <b>Temperatur:</b> ${roundedTemp}°C<br>
            <b>Messzeit:</b> ${new Date(timestamp * 1000).toLocaleString()}
        `, { permanent: false, direction: "top", offset: [0, -10] });
        markers.addLayer(marker);
    }

    async function loadTemperatureData() {
        const apiUrl = "https://api.quantum.hackerban.de/v2/metrics";
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                console.error("Fehler beim Abrufen der Sensordaten:", await response.text());
                return;
            }
            // Neue Struktur: payload.data enthält das Array
            const result = await response.json();
            const entries = result.data;
            console.log("Empfangene Sensordaten:", entries);

            sensorData = {};
            timeStamps = [];

            entries.forEach(entry => {
                const sensorId = entry.device_id;               // jetzt eine Zahl
                const temperature = parseFloat(entry.temperature);
                const timestamp   = entry.timestamp_server;     // Unix-Zeit in Sekunden

                if (!sensorData[sensorId]) sensorData[sensorId] = [];
                sensorData[sensorId].push({ timestamp, temperature });

                if (!timeStamps.includes(timestamp)) timeStamps.push(timestamp);
            });

            timeStamps.sort((a, b) => a - b);
            timeSlider.max = timeStamps.length - 1;
            timeSlider.value = timeSlider.max;

            updateMap(timeSlider.value);
        } catch (error) {
            console.error("Fehler beim Abrufen der Daten:", error);
        }
    }

    function updateMap(timeIndex) {
  console.clear();
  console.log("→ updateMap called with timeIndex:", timeIndex, typeof timeIndex);
  
  const selectedTimestamp = timeStamps[timeIndex];
  console.log("   selectedTimestamp:", selectedTimestamp);
  console.log("   sensorData keys:", Object.keys(sensorData));
  
  markers.clearLayers();
  heatmapLayer.setLatLngs([]);
  
  // überprüfe pro Sensor:
  Object.keys(sensorData).forEach(sensorId => {
    const readings = sensorData[sensorId];
    const sel = [...readings]
                   .reverse()
                   .find(r => r.timestamp <= selectedTimestamp);
    
    console.group(`Sensor ${sensorId}`);
    console.log("  readings count:", readings.length);
    console.log("  sel.timestamp:", sel ? sel.timestamp : "<none>");
    
    if (!sensors[sensorId]) {
      console.warn(`  ⚠️ kein Mapping für sensors[${sensorId}] gefunden`);
    } else if (sel) {
      const { lat, lon, name } = sensors[sensorId];
      console.log(`  mapping found → ${name} @ (${lat},${lon})`);
      
      // und hier die eigentliche Hinzufügung:
      addClusteredMarker(lat, lon, sel.temperature, name, "?", sensorId, sel.timestamp);
      heatmapLayer.addLatLng([lat, lon, normalizeTemperature(sel.temperature)]);
    }
    console.groupEnd();
  });
  
  // wie viele Marker liegen jetzt im Cluster?
  console.log("→ marker count:", markers.getLayers().length);
  // und wie viele Heatmap-Punkte?
  console.log("→ heatmap points:", heatmapLayer._latlngs?.length || heatmapLayer._latlngs?.length);
  
  if (firstLoad && Object.keys(sensorData).length > 0) {
    map.fitBounds(new L.LatLngBounds(Object.values(sensors).map(s => [s.lat, s.lon])), { padding: [50,50] });
    firstLoad = false;
  }
}

    //timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

    timeSlider.addEventListener("input", () => {
    console.log("Slider moved, value =", timeSlider.value);
    updateMap(timeSlider.value);
    });

    loadTemperatureData();
    // alle 30 Sek. neu laden
    setInterval(loadTemperatureData, 30000);
});
