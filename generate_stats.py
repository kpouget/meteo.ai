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

# Station configuration
STATIONS = {
    "cahors": {
        "name": "Cahors",
        "station_id": "ICAHOR23",
        "features": {"pm_sensors": True, "rivers": True}
    },
    "vayrac": {
        "name": "Vayrac",
        "station_id": "IVAYRA1",
        "features": {"pm_sensors": False, "rivers": True}
    },
    "coublevie": {
        "name": "Coublevie",
        "station_id": "ICOUBL3",
        "features": {"pm_sensors": False, "rivers": False}
    },
    "revel": {
        "name": "Revel",
        "station_id": "IREVEL54",
        "features": {"pm_sensors": False, "rivers": False}
    },
    "pamplona": {
        "name": "Pamplune",
        "station_id": "IPAMPL52",
        "features": {"pm_sensors": False, "rivers": False}
    },
    "mandeli": {
        "name": "Mandelieu",
        "station_id": "IMANDELI41",
        "features": {"pm_sensors": False, "rivers": False}
    },
    "eastboston": {
        "name": "Boston",
        "station_id": "KMAEASTB68",
        "features": {"pm_sensors": False, "rivers": False}
    },
    "tokyo": {
        "name": "Tokyo",
        "station_id": "ITOKYO63",
        "features": {"pm_sensors": False, "rivers": False}
    }
}

# Base metrics configuration (current + historical data sources)
METRICS_TO_QUERY = {
    "pressure": {
        "query_template": 'pressure{{instance="wunderground.972.ovh:443", job="internet scraping", station_id="{station_id}"}}',
        "historical_query": 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
        "unit": "hPa",
        "has_historical": ["cahors"]
    },
    "temperature_ext": {
        "query_template": 'temperature{{instance="wunderground.972.ovh:443", job="internet scraping", mode="actual", station_id="{station_id}"}}',
        "historical_query": 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}',
        "unit": "°C",
        "has_historical": ["cahors"]
    },
    "river_lot": {
        "query_template": 'river_flow{{river="Lot", station="Cahors"}}',
        "unit": "m³/s",
        "available_for": ["cahors", "vayrac"]
    },
    "river_dordogne": {
        "query_template": 'river_flow{{river="Dordogne", station="Carennac"}}',
        "unit": "m³/s",
        "available_for": ["cahors", "vayrac"]
    },
    "river_lot_height": {
        "query_template": 'river_height{{river="Lot", station="Cahors"}}',
        "unit": "m",
        "available_for": ["cahors", "vayrac"]
    },
    "river_dordogne_height": {
        "query_template": 'river_height{{river="Dordogne", station="Carennac"}}',
        "unit": "m",
        "available_for": ["cahors", "vayrac"]
    },
    "sun_rad": {
        "query_template": 'sun_rad{{instance="wunderground.972.ovh:443", job="internet scraping", station_id="{station_id}"}}',
        "historical_query": 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
        "unit": "J/m²",
        "has_historical": ["cahors"]
    },
    "rain_total_week": {
        "query_template": 'increase(rain{{instance="wunderground.972.ovh:443", job="internet scraping", mode="total", station_id="{station_id}"}}[1w])',
        "historical_query": 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])',
        "unit": "mm",
        "has_historical": ["cahors"]
    },
    "rain_total_month": {
        "query_template": 'increase(rain{{instance="wunderground.972.ovh:443", job="internet scraping", mode="total", station_id="{station_id}"}}[30d])',
        "historical_query": 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[30d])',
        "unit": "mm",
        "has_historical": ["cahors"]
    },
    "pm1": {
        "query_template": 'PM1{{instance="home.972.ovh:35000", job="raspi sensors"}}',
        "unit": "μg/m³",
        "available_for": ["cahors"]
    },
    "pm25": {
        "query_template": 'PM25{{instance="home.972.ovh:35000", job="raspi sensors"}}',
        "unit": "μg/m³",
        "available_for": ["cahors"]
    },
    "pm10": {
        "query_template": 'PM10{{instance="home.972.ovh:35000", job="raspi sensors"}}',
        "unit": "μg/m³",
        "available_for": ["cahors"]
    }
}

def get_query_for_station(metric_config, station_id):
    """Generate station-specific query from template."""
    return metric_config["query_template"].format(station_id=station_id)

def has_historical_data(metric_name, station_name):
    """Check if metric has historical data for given station."""
    metric_config = METRICS_TO_QUERY[metric_name]
    return "has_historical" in metric_config and station_name in metric_config["has_historical"]

def is_metric_available_for_station(metric_name, station_name):
    """Check if metric is available for given station. Defaults to True if 'available_for' is not specified."""
    metric_config = METRICS_TO_QUERY[metric_name]
    if "available_for" not in metric_config:
        return True  # Default: available for all stations
    return station_name in metric_config["available_for"]

def query_metric_with_historical(prom, metric_name, station_name, station_config, query_func):
    """Query metric from both current and historical sources, return combined result."""
    metric_config = METRICS_TO_QUERY[metric_name]

    print(f"  - Station: {station_name} ({station_config['station_id']})")
    print(f"  - Has historical data: {has_historical_data(metric_name, station_name)}")

    # Query current data
    current_query = get_query_for_station(metric_config, station_config["station_id"])
    print(f"  - Current query: {current_query}")
    current_result = None
    try:
        current_result = query_func(current_query)
        if current_result:
            print(f"  - Current data: {current_result}")
    except Exception as e:
        print(f"  - Error with current data: {e}")

    # Query historical data if available
    historical_result = None
    if has_historical_data(metric_name, station_name):
        print(f"  - Historical query: {metric_config['historical_query']}")
        try:
            historical_result = query_func(metric_config["historical_query"])
            if historical_result:
                print(f"  - Historical data: {historical_result}")
        except Exception as e:
            print(f"  - Error with historical data: {e}")
    else:
        print(f"  - No historical data configured for {station_name}")

    # Combine results (prefer current, fallback to historical only for same station, or merge for min/max)
    if current_result is not None and historical_result is not None:
        # For min/max queries, take the actual min/max across both sources
        if isinstance(current_result, dict) and ("min" in current_result or "max" in current_result):
            combined = {}
            if "min" in current_result and "min" in historical_result:
                combined["min"] = min(current_result["min"], historical_result["min"])
            elif "min" in current_result:
                combined["min"] = current_result["min"]
            elif "min" in historical_result:
                combined["min"] = historical_result["min"]

            if "max" in current_result and "max" in historical_result:
                combined["max"] = max(current_result["max"], historical_result["max"])
            elif "max" in current_result:
                combined["max"] = current_result["max"]
            elif "max" in historical_result:
                combined["max"] = historical_result["max"]

            if "unit" in current_result:
                combined["unit"] = current_result["unit"]
            print(f"  - Combined result: {combined}")
            return combined
        else:
            # For single values, prefer current
            return current_result
    elif current_result is not None:
        print(f"  - Using current data only: {current_result}")
        return current_result
    elif historical_result is not None:
        print(f"  - Using historical data only: {historical_result}")
        return historical_result
    else:
        print(f"  - No data available")
        return None

def generate_station_data(prom, station_name, station_config):
    """Generate stats for a specific station."""
    print(f"\n=== Generating data for {station_config['name']} ===")
    stats = {}

    # Generate station-specific rain data for last 6 months
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

        print(f"Querying rain total for '{month_name}' on {station_config['name']}...")

        # Use dual-source query approach to properly combine current and historical data
        def monthly_rain_query(query):
            try:
                result = prom.custom_query(query=query, params={'time': end_of_month.timestamp()})
                return round(float(result[0]['value'][1])) if result else None
            except:
                return None

        # Create a temporary metric config for this monthly query
        monthly_metric_config = {
            "query_template": f'increase(rain{{instance="wunderground.972.ovh:443", job="internet scraping", mode="total", station_id="{station_config["station_id"]}"}}[{range_seconds}s])',
            "historical_query": f'increase(rain{{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}}[{range_seconds}s])'
        }

        # Get current query
        current_query = monthly_metric_config["query_template"]
        historical_query = monthly_metric_config["historical_query"] if has_historical_data("rain_total_month", station_name) else None

        current_value = monthly_rain_query(current_query)
        historical_value = monthly_rain_query(historical_query) if historical_query else None

        # Choose the best value: prefer non-zero values, then current over historical
        value = None
        if current_value is not None and current_value > 0:
            value = current_value
            print(f"  - Using current data: {value}")
        elif historical_value is not None and historical_value > 0:
            value = historical_value
            print(f"  - Using historical data: {value}")
        elif current_value is not None:
            value = current_value
            print(f"  - Using current data (zero): {value}")
        elif historical_value is not None:
            value = historical_value
            print(f"  - Using historical data (zero): {value}")

        if value is not None:
            rain_last_6_months.append({
                "month": month_name,
                "value": value,
                "unit": "mm"
            })
        else:
            print(f"  - Could not retrieve value for '{month_name}'.")

    stats["rain_last_6_months"] = rain_last_6_months

    # Generate station-specific rain data for last 6 days
    rain_last_6_days = []
    for i in range(1, 7):
        target_day = today - timedelta(days=i)
        day_name = target_day.strftime("%A (%d/%m)")
        end_of_day = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)

        print(f"Querying rain total for '{day_name}' on {station_config['name']}...")

        # Use dual-source query approach to properly combine current and historical data
        def daily_rain_query(query):
            try:
                result = prom.custom_query(query=query, params={'time': end_of_day.timestamp()})
                return round(float(result[0]['value'][1])) if result else None
            except:
                return None

        # Get current and historical queries
        current_query = f'increase(rain{{instance="wunderground.972.ovh:443", job="internet scraping", mode="total", station_id="{station_config["station_id"]}"}}[24h])'
        historical_query = f'increase(rain{{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}}[24h])' if has_historical_data("rain_total_week", station_name) else None

        current_value = daily_rain_query(current_query)
        historical_value = daily_rain_query(historical_query) if historical_query else None

        # Choose the best value: prefer non-zero values, then current over historical
        value = None
        if current_value is not None and current_value > 0:
            value = current_value
            print(f"  - Using current data: {value}")
        elif historical_value is not None and historical_value > 0:
            value = historical_value
            print(f"  - Using historical data: {value}")
        elif current_value is not None:
            value = current_value
            print(f"  - Using current data (zero): {value}")
        elif historical_value is not None:
            value = historical_value
            print(f"  - Using historical data (zero): {value}")

        if value is not None:
            rain_last_6_days.append({
                "day": day_name,
                "value": value,
                "unit": "mm"
            })
        else:
            print(f"  - Could not retrieve value for '{day_name}'.")

    stats["rain_last_6_days"] = rain_last_6_days

    # Generate station-specific sun radiation for last 6 days
    if is_metric_available_for_station("sun_rad", station_name):
        sun_rad_last_6_days = []
        for i in range(1, 7):
            target_day = today - timedelta(days=i)
            day_name = target_day.strftime("%A (%d/%m)")
            end_of_day = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)
            unit = "KJ/m²"

            print(f"Querying sun radiation for '{day_name}' on {station_config['name']}...")

            # Try current data first
            current_query = f"increase({get_query_for_station(METRICS_TO_QUERY['sun_rad'], station_config['station_id'])}[24h])"
            value = None

            try:
                result = prom.custom_query(query=current_query, params={'time': end_of_day.timestamp()})
                value = round(float(result[0]['value'][1]) / 100) / 10 if result else None
                if value is not None:
                    print(f"  - Current data: {value}")
            except Exception as e:
                print(f"  - Error with current data: {e}")

            # Try historical data if current failed and historical is available for this station
            if value is None and has_historical_data("sun_rad", station_name):
                try:
                    historical_query = "increase(" + METRICS_TO_QUERY['sun_rad']['historical_query'] + "[24h])"
                    result = prom.custom_query(query=historical_query, params={'time': end_of_day.timestamp()})
                    value = round(float(result[0]['value'][1]) / 100) / 10 if result else None
                    if value is not None:
                        print(f"  - Historical data: {value}")
                except Exception as e:
                    print(f"  - Error with historical data: {e}")

            if value is not None:
                sun_rad_last_6_days.append({
                    "day": day_name,
                    "value": value,
                    "unit": unit
                })
            else:
                print(f"  - Could not retrieve sun radiation data for '{day_name}'.")

        stats["sun_rad_last_6_days"] = sun_rad_last_6_days

    # Generate metrics stats for this station
    for name, details in METRICS_TO_QUERY.items():
        if not is_metric_available_for_station(name, station_name):
            print(f"Skipping '{name}' - not available for {station_config['name']}")
            continue

        print(f"Querying stats for '{name}' on {station_config['name']}...")

        try:
            if name in ["rain_total_week", "rain_total_month"]:
                # Single value query with dual source support
                def single_value_query(query):
                    result = prom.custom_query(query=query)
                    return {"value": round(float(result[0]['value'][1])), "unit": details.get("unit", "")} if result else None

                result = query_metric_with_historical(prom, name, station_name, station_config, single_value_query)
                if result:
                    stats[name] = result
                else:
                    print(f"  - Could not retrieve value for '{name}'.")
            else:
                # Min/max queries with dual source support
                def minmax_query(query):
                    result_data = {}

                    # Query min value (except for sun_rad)
                    if name != "sun_rad":
                        try:
                            min_query = f"min_over_time({query}[7d])"
                            min_result = prom.custom_query(query=min_query)
                            if min_result:
                                result_data["min"] = round(float(min_result[0]['value'][1]))
                        except:
                            pass

                    # Query max value
                    try:
                        max_query = f"max_over_time({query}[7d])"
                        max_result = prom.custom_query(query=max_query)
                        if max_result:
                            result_data["max"] = round(float(max_result[0]['value'][1]))
                    except:
                        pass

                    if result_data:
                        result_data["unit"] = details.get("unit", "")
                        return result_data
                    return None

                result = query_metric_with_historical(prom, name, station_name, station_config, minmax_query)
                if result:
                    stats[name] = result
                else:
                    print(f"  - Could not retrieve data for '{name}'.")

        except Exception as e:
            print(f"  - An error occurred while querying for '{name}': {e}")

    return stats

def main():
    """
    Connects to Prometheus, queries min/max stats for both stations,
    and writes the result to a JavaScript file.
    """
    try:
        locale.setlocale(locale.LC_TIME, 'fr_FR.UTF-8')
        print(f"Connecting to Prometheus at {PROMETHEUS_URL}...")
        prom = PrometheusConnect(url=PROMETHEUS_URL, disable_ssl=False)
    except Exception as e:
        print(f"Error connecting to Prometheus: {e}")
        return

    # Generate station-aware stats
    station_stats = {}
    for station_name, station_config in STATIONS.items():
        station_stats[station_name] = generate_station_data(prom, station_name, station_config)

    # Write the station-aware stats to the JavaScript file
    js_content = f"var STATION_STATS = {json.dumps(station_stats, indent=4)};\n"

    # For backward compatibility, expose the default station's stats as STATS
    default_station = "cahors"  # Default to Cahors
    if default_station in station_stats:
        js_content += f"\n// Backward compatibility - expose default station stats as STATS\n"
        js_content += f"var STATS = STATION_STATS.{default_station};\n"

    try:
        with open(OUTPUT_JS_FILE, "w") as f:
            f.write(js_content)
        print(f"\nSuccessfully wrote station-aware stats to {OUTPUT_JS_FILE}")
        print(f"Available stations: {', '.join(station_stats.keys())}")
    except IOError as e:
        print(f"\nError writing to file {OUTPUT_JS_FILE}: {e}")

if __name__ == "__main__":
    main()
