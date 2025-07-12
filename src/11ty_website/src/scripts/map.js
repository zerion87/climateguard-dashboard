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

        const sensors = {
            "lora3": { "lat": 49.440754, "lon": 10.942086, "name": "Lora3 Sensor" },
            "andis-sensor-an-heltech": { "lat": 49.448719, "lon": 11.08766, "name": "Andis Sensor" }
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

        function addClusteredMarker(lat, lon, temp, name, trend, sensorId, timestamp) {
            let roundedTemp = Math.round(temp);

            let tempLabel = L.divIcon({
                className: 'custom-temp-label',
                html: `<div style="font-size: 14px; font-weight: bold;">${roundedTemp}°C ${trend}</div>`,
                iconSize: [40, 20],
                iconAnchor: [20, 10]
            });

            let marker = L.marker([lat, lon], { icon: tempLabel });

            marker.bindTooltip(`
        <b>Sensor:</b> ${sensorId}<br>
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

                const jsonData = await response.json();
                console.log("Empfangene Sensordaten:", jsonData);

                sensorData = {};
                timeStamps = [];

                jsonData.forEach(entry => {
                    const sensorId = entry.device_id;
                    const temperature = parseFloat(entry.temperature);
                    const timestamp = entry.timestamp_server;

                    if (!sensorData[sensorId]) sensorData[sensorId] = [];
                    sensorData[sensorId].push({ timestamp, temperature });

                    if (!timeStamps.includes(timestamp)) timeStamps.push(timestamp);
                });

                timeStamps.sort();
                timeSlider.max = timeStamps.length - 1;
                timeSlider.value = timeSlider.max;

                updateMap(timeSlider.value);
            } catch (error) {
                console.error("Fehler beim Abrufen der Daten:", error);
            }
        }

        function updateMap(timeIndex) {
            markers.clearLayers();
            heatmapLayer.setLatLngs([]);

            let selectedTimestamp = timeStamps[timeIndex];
            timeDisplay.innerText = new Date(selectedTimestamp * 1000).toLocaleString();

            let bounds = new L.LatLngBounds();

            Object.keys(sensorData).forEach(sensorId => {
                let readings = sensorData[sensorId];

                let selectedReading = [...readings].reverse().find(r => r.timestamp <= selectedTimestamp);
                if (!selectedReading) return;

                let prevReadingIndex = Math.max(0, readings.findIndex(r => r.timestamp === selectedTimestamp) - 1);
                let prevReading = readings[prevReadingIndex];

                let trend = prevReading ? getTrendArrow(prevReading.temperature, selectedReading.temperature) : "➖";

                if (sensors[sensorId]) {
                    let lat = sensors[sensorId].lat;
                    let lon = sensors[sensorId].lon;
                    bounds.extend([lat, lon]);

                    addClusteredMarker(lat, lon, selectedReading.temperature, sensors[sensorId].name, trend, sensorId, selectedReading.timestamp);
                    heatmapLayer.addLatLng([lat, lon, normalizeTemperature(selectedReading.temperature)]);
                }
            });

            if (firstLoad && Object.keys(sensorData).length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
                firstLoad = false;
            }
        }

        timeSlider.addEventListener("input", () => updateMap(timeSlider.value));

        loadTemperatureData();
        setInterval(loadTemperatureData, 30000);
    });