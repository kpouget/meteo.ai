var STATIONS = {
    "cahors": {
        "name": "Cahors",
        "station_id": "ICAHOR23",
        "default": true,
        "features": {
            "pm_sensors": true
        }
    },
    "vayrac": {
        "name": "Vayrac",
        "station_id": "IVAYRA1",
        "default": false,
        "features": {
            "pm_sensors": false
        }
    }
};

// Current station (will be set by URL parameter or default)
var currentStation = null;

// Get current station configuration
function getCurrentStation() {
    if (!currentStation) {
        // Load from URL parameter or default
        loadStationFromSources();
    }
    return STATIONS[currentStation];
}

// Load station from URL parameter, then default
function loadStationFromSources() {
    // 1. Try URL parameter first
    var urlStation = getStationFromUrl();
    if (urlStation && STATIONS[urlStation]) {
        currentStation = urlStation;
        return;
    }

    // 2. Use default station
    for (var stationId in STATIONS) {
        if (STATIONS[stationId].default) {
            currentStation = stationId;
            break;
        }
    }
}

// Get station from URL parameter
function getStationFromUrl() {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('station');
}