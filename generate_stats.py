#!/usr/bin/env python3

import json
from prometheus_api_client import PrometheusConnect
from datetime import timedelta

# Configuration
PROMETHEUS_URL = "https://prometheus.972.ovh"
OUTPUT_JS_FILE = "stats.js"
METRICS_TO_QUERY = {
    "pressure": {
        "query": 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
        "unit": "hPa"
    },
    "temperature_ext": {
        "query": 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}',
        "unit": "°C"
    }
}

def main():
    """
    Connects to Prometheus, queries min/max stats over the last 7 days,
    and writes the result to a JavaScript file.
    """
    try:
        print(f"Connecting to Prometheus at {PROMETHEUS_URL}...")
        prom = PrometheusConnect(url=PROMETHEUS_URL, disable_ssl=False)
    except Exception as e:
        print(f"Error connecting to Prometheus: {e}")
        return

    stats = {}

    for name, details in METRICS_TO_QUERY.items():
        base_query = details["query"]
        print(f"Querying stats for '{name}'...")

        try:
            # Query for the minimum value over the last 7 days
            min_query = f"min_over_time({base_query}[7d])"
            min_result = prom.custom_query(query=min_query)
            min_value = round(float(min_result[0]['value'][1])) if min_result else None

            # Query for the maximum value over the last 7 days
            max_query = f"max_over_time({base_query}[7d])"
            max_result = prom.custom_query(query=max_query)
            max_value = round(float(max_result[0]['value'][1])) if max_result else None

            if min_value is not None and max_value is not None:
                stats[name] = {
                    "min": min_value,
                    "max": max_value,
                    "unit": details.get("unit", "")
                }
                print(f"  - Min: {min_value}, Max: {max_value}")
            else:
                print(f"  - Could not retrieve full min/max data for '{name}'.")

        except Exception as e:
            print(f"  - An error occurred while querying for '{name}': {e}")

    # Write the stats to the JavaScript file
    js_content = f"var STATS = {json.dumps(stats, indent=4)};"
    try:
        with open(OUTPUT_JS_FILE, "w") as f:
            f.write(js_content)
        print(f"\nSuccessfully wrote stats to {OUTPUT_JS_FILE}")
    except IOError as e:
        print(f"\nError writing to file {OUTPUT_JS_FILE}: {e}")

if __name__ == "__main__":
    main()
