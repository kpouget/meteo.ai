var STATIONS = {
    "cahors": {
        "name": "Cahors",
        "station_id": "ICAHOR23",
        "default": true,
        "features": {
            "pm_sensors": true,
            "rivers": true
        }
    },
    "vayrac": {
        "name": "Vayrac",
        "station_id": "IVAYRA1",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": true
        }
    },
    "coublevie": {
        "name": "Coublevie",
        "station_id": "ICOUBL3",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
        }
    },
    "revel": {
        "name": "Revel",
        "station_id": "IREVEL54",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
        }
    },
    "pamplona": {
        "name": "Pamplune",
        "station_id": "IPAMPL52",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
        }
    },
    "mandeli": {
        "name": "Mandelieu",
        "station_id": "IMANDELI41",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
        }
    },
    "eastboston": {
        "name": "Boston",
        "station_id": "KMAEASTB68",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
        }
    },
    "tokyo": {
        "name": "Tokyo",
        "station_id": "ITOKYO63",
        "default": false,
        "features": {
            "pm_sensors": false,
            "rivers": false
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