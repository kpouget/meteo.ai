var METRICS = {
    "rain_rate": {
        "query": "max_over_time(rain{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "rate",
            "station_id": "{STATION_ID}"
        },
        "unit": "mm/h",
        "range": "3h"
    },
    "rain_total_day": {
        "query": "increase(rain{LABELS}[24h])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "total",
            "station_id": "{STATION_ID}"
        },
        "unit": "mm",
        "range": "24h"
    },
    "rain_total_week": {
        "query": "increase(rain{LABELS}[7d])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "total",
            "station_id": "{STATION_ID}"
        },
        "unit": "mm",
        "range": "7d"
    },
    "rain_total_month": {
        "query": "increase(rain{LABELS}[30d])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "total",
            "station_id": "{STATION_ID}"
        },
        "unit": "mm",
        "range": "30d"
    },
    "temperature_ext": {
        "query": "avg_over_time(temperature{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "actual",
            "station_id": "{STATION_ID}"
        },
        "unit": "&deg;C",
        "range": "1d"
    },
    "humidity_ext": {
        "query": "avg_over_time(humidity{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "station_id": "{STATION_ID}"
        },
        "unit": "%",
        "range": "1d"
    },
    "temperature_int": {
        "query": "avg_over_time(temperature{LABELS}[10m])",
        "labels": {
            "group": "pac",
            "instance": "home.972.ovh:35004",
            "job": "raspi sensors",
            "location": "pac_interieur"
        },
        "unit": "&deg;C",
        "range": "1d"
    },
    "temperature_e1_chauffage": {
        "query": "avg_over_time(temperature{LABELS}[10m])",
        "labels": {
            "group": "thermo",
            "instance": "home.972.ovh:35002",
            "job": "raspi sensors",
            "location": "e1_chauffage"
        },
        "unit": "&deg;C",
        "range": "1d"
    },
    "dew_point": {
        "query": "avg_over_time(temperature{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "dew_point",
            "station_id": "{STATION_ID}"
        },
        "unit": "&deg;C",
        "range": "1d"
    },
    "wind_speed": {
        "query": "avg_over_time(wind{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "speed",
            "station_id": "{STATION_ID}"
        },
        "unit": "km/h",
        "range": "1d"
    },
    "wind_gust": {
        "query": "avg_over_time(wind{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "mode": "gust",
            "station_id": "{STATION_ID}"
        },
        "unit": "km/h",
        "range": "1d"
    },
    "wind_dir": {
        "query": "avg_over_time(wind_dir{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "station_id": "{STATION_ID}"
        },
        "unit": "",
        "range": "1d"
    },
    "pressure": {
        "query": "avg_over_time(pressure{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "station_id": "{STATION_ID}"
        },
        "unit": "hPa",
        "range": "1d"
    },
    "sun_rad": {
        "query": "avg_over_time(sun_rad{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "station_id": "{STATION_ID}"
        },
        "unit": "J/m&sup2;",
        "range": "1d"
    },
    "uv_idx": {
        "query": "avg_over_time(uv_idx{LABELS}[10m])",
        "labels": {
            "instance": "wunderground.972.ovh:443",
            "job": "internet scraping",
            "station_id": "{STATION_ID}"
        },
        "unit": "/11",
        "range": "1d"
    },
    "pm1": {
        "query": "avg_over_time(PM1{LABELS}[10m])",
        "labels": {
            "instance": "home.972.ovh:35000",
            "job": "raspi sensors"
        },
        "unit": "&micro;g/m&sup3;",
        "range": "1d"
    },
    "pm25": {
        "query": "avg_over_time(PM25{LABELS}[10m]) - avg_over_time(PM1{LABELS}[10m])",
        "labels": {
            "instance": "home.972.ovh:35000",
            "job": "raspi sensors"
        },
        "unit": "&micro;g/m&sup3;",
        "range": "1d"
    },
    "pm10": {
        "query": "avg_over_time(PM10{LABELS}[10m]) - avg_over_time(PM25{LABELS}[10m])",
        "labels": {
            "instance": "home.972.ovh:35000",
            "job": "raspi sensors"
        },
        "unit": "&micro;g/m&sup3;",
        "range": "1d"
    },
    "river_lot": {
        "query": "avg_over_time(river_flow{LABELS}[10m])",
        "labels": {
            "instance": "riverflow.972.ovh:443",
            "job": "internet scraping",
            "name": "Lot"
        },
        "unit": "m&sup3;/s",
        "range": "7d"
    },
    "river_dordogne": {
        "query": "avg_over_time(river_flow{LABELS}[10m])",
        "labels": {
            "instance": "riverflow.972.ovh:443",
            "job": "internet scraping",
            "name": "Dordogne"
        },
        "unit": "m&sup3;/s",
        "range": "7d"
    }
};
