# the_floor_is_lava

## Description

This project visualizes temperature sensor data on an interactive map using the Leaflet library. The map displays clustered markers and heatmaps to represent temperature readings from various sensors. Users can explore temperature changes over the past 24 hours using a time slider, which updates the map in 10-minute intervals.

### Features

- **Interactive Map**: Displays temperature data from sensors on a map using clustered markers and heatmaps.
- **Time Slider**: Allows users to view temperature data at different times over the past 24 hours.
- **Real-time Updates**: The map and data are updated every 30 seconds to provide the latest temperature readings.
- **Temperature Trends**: Shows whether the temperature has increased, decreased, or remained the same with trend arrows.

### Technologies Used

- **Leaflet**: For creating the interactive map.
- **InfluxDB**: For storing and querying temperature data.
- **JavaScript**: For fetching data, updating the map, and handling user interactions.

### How It Works

1. **Data Fetching**: Temperature data is fetched from InfluxDB using a Flux query.
2. **Data Processing**: The data is processed to extract temperature readings and timestamps.
3. **Map Update**: The map is updated with clustered markers and heatmaps based on the selected time from the time slider.
4. **Real-time Updates**: The data fetching and map updating process is repeated every 30 seconds to ensure the map displays the latest temperature readings.

### Usage

- **Time Slider**: Move the slider to view temperature data at different times.
- **Markers and Heatmaps**: Click on markers to view temperature readings and trends.