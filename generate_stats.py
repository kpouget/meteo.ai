#!/usr/bin/env python3

import json
from prometheus_api_client import PrometheusConnect
from datetime import datetime
from dateutil.relativedelta import relativedelta
from calendar import monthrange
from datetime import timedelta
import locale

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
    },
    "river_lot": {
        "query": 'river_flow{name="Lot"}',
        "unit": "m³/s"
    },
    "river_dordogne": {
        "query": 'river_flow{name="Dordogne"}',
        "unit": "m³/s"
    },
    "sun_rad": {
        "query": 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
        "unit": "J/m²"
    },
    "rain_total_week": {
        "query": 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])',
        "unit": "mm"
    },
    "rain_total_month": {
        "query": 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[30d])',
        "unit": "mm"
    }
}

def main():
    """
    Connects to Prometheus, queries min/max stats over the last 7 days,
    and writes the result to a JavaScript file.
    """
    try:
        locale.setlocale(locale.LC_TIME, 'fr_FR.UTF-8')
        print(f"Connecting to Prometheus at {PROMETHEUS_URL}...")
        prom = PrometheusConnect(url=PROMETHEUS_URL, disable_ssl=False)
    except Exception as e:
        print(f"Error connecting to Prometheus: {e}")
        return

    stats = {}

    # Query rain totals for the last 6 months
    rain_last_6_months = []
    today = datetime.now()
    for i in range(1, 7):
        target_month_date = today - relativedelta(months=i)
        year = target_month_date.year
        month = target_month_date.month
        month_name = target_month_date.strftime("%B").lower()
        num_days = monthrange(year, month)[1]
        range_seconds = num_days * 24 * 3600
        end_of_month = datetime(year, month, num_days, 23, 59, 59)
        
        query = f'increase(rain{{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}}[{range_seconds}s])'
        
        print(f"Querying rain total for '{month_name}'...")
        try:
            result = prom.custom_query(query=query, params={'time': end_of_month.timestamp()})
            value = round(float(result[0]['value'][1])) if result else None
            if value is not None:
                rain_last_6_months.append({
                    "month": month_name,
                    "value": value,
                    "unit": "mm"
                })
                print(f"  - Value: {value}")
            else:
                print(f"  - Could not retrieve value for '{month_name}'.")
        except Exception as e:
            print(f"  - An error occurred while querying for '{month_name}': {e}")
    stats["rain_last_6_months"] = rain_last_6_months

    # Query rain totals for the last 6 days
    rain_last_6_days = []
    for i in range(1, 7):
        target_day = today - timedelta(days=i)
        day_name = target_day.strftime("%A (%d/%m)")
        
        start_of_day = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        query = f'increase(rain{{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}}[24h])'
        
        print(f"Querying rain total for '{day_name}'...")
        try:
            result = prom.custom_query(query=query, params={'time': end_of_day.timestamp()})
            value = round(float(result[0]['value'][1])) if result else None
            if value is not None:
                rain_last_6_days.append({
                    "day": day_name,
                    "value": value,
                    "unit": "mm"
                })
                print(f"  - Value: {value}")
            else:
                print(f"  - Could not retrieve value for '{day_name}'.")
        except Exception as e:
            print(f"  - An error occurred while querying for '{day_name}': {e}")
    stats["rain_last_6_days"] = rain_last_6_days

    for name, details in METRICS_TO_QUERY.items():
        base_query = details["query"]
        print(f"Querying stats for '{name}'...")

        try:
            if name in ["rain_total_week", "rain_total_month"]:
                # Single value query
                result = prom.custom_query(query=base_query)
                value = round(float(result[0]['value'][1])) if result else None
                if value is not None:
                    stats[name] = {
                        "value": value,
                        "unit": details.get("unit", "")
                    }
                    print(f"  - Value: {value}")
                else:
                    print(f"  - Could not retrieve value for '{name}'.")
            else:
                # Min/max or max-only query
                min_value = None
                if name != "sun_rad":
                    min_query = f"min_over_time({base_query}[7d])"
                    min_result = prom.custom_query(query=min_query)
                    min_value = round(float(min_result[0]['value'][1])) if min_result else None

                max_query = f"max_over_time({base_query}[7d])"
                max_result = prom.custom_query(query=max_query)
                max_value = round(float(max_result[0]['value'][1])) if max_result else None

                if max_value is not None:
                    stats[name] = {
                        "max": max_value,
                        "unit": details.get("unit", "")
                    }
                    if min_value is not None:
                        stats[name]["min"] = min_value

                    log_msg = f"  - Max: {max_value}"
                    if min_value is not None:
                        log_msg = f"  - Min: {min_value}, " + log_msg
                    print(log_msg)
                else:
                    print(f"  - Could not retrieve max data for '{name}'.")

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
