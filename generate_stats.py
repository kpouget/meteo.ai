#!/usr/bin/env python3

import json
import os
from prometheus_api_client import PrometheusConnect
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from calendar import monthrange
from datetime import timedelta
import locale

# Configuration
PROMETHEUS_URL = "https://prometheus.972.ovh"
OUTPUT_JS_FILE = "stats.js"
WEEKLY_DATA_DIR = "weekly_data"

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

def get_sunday_week_bounds(target_date):
    """Get the Sunday-to-Sunday week bounds for a given date."""
    # Find the Sunday of the week containing target_date
    days_since_sunday = target_date.weekday() + 1 if target_date.weekday() != 6 else 0
    week_start = target_date - timedelta(days=days_since_sunday)

    # Convert to datetime if needed for end time calculation
    if isinstance(week_start, date) and not isinstance(week_start, datetime):
        week_start_dt = datetime.combine(week_start, datetime.min.time())
    else:
        week_start_dt = week_start

    week_end = week_start_dt + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_start, week_end

def get_week_identifier(target_date):
    """Get a week identifier string (e.g., '2024-W01') for a given date."""
    week_start, _ = get_sunday_week_bounds(target_date)
    # Use ISO year and calculate week number from Sunday
    year = week_start.year
    day_of_year = week_start.timetuple().tm_yday
    week_num = ((day_of_year - 1) // 7) + 1
    return f"{year}-W{week_num:02d}"

def get_weekly_data_filename(station_name):
    """Get the filename for storing weekly data for a station."""
    return os.path.join(WEEKLY_DATA_DIR, f"{station_name}_weekly_buckets.json")

def load_existing_weekly_data(station_name):
    """Load existing weekly data from file."""
    filename = get_weekly_data_filename(station_name)
    if os.path.exists(filename):
        try:
            with open(filename, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading weekly data: {e}")
    return {}

def save_weekly_data(station_name, weekly_data):
    """Save weekly data to file."""
    os.makedirs(WEEKLY_DATA_DIR, exist_ok=True)
    filename = get_weekly_data_filename(station_name)
    try:
        with open(filename, 'w') as f:
            json.dump(weekly_data, f, indent=2)
        print(f"Saved weekly data to {filename}")
    except Exception as e:
        print(f"Error saving weekly data: {e}")

def collect_weekly_sun_radiation_data(prom, station_name, station_config):
    """Collect weekly sun radiation data with incremental updates."""
    if not is_metric_available_for_station("sun_rad", station_name):
        print(f"Sun radiation not available for {station_name}")
        return {}

    print(f"\n=== Collecting weekly sun radiation data for {station_config['name']} ===")

    # Load existing data
    weekly_data = load_existing_weekly_data(station_name)

    # Define intensity buckets in W/m²
    intensity_buckets = [
        {"label": "Nuit", "min": 0, "max": 0.5},
        {"label": "< 40", "min": 0.5, "max": 40},
        {"label": "< 200", "min": 40, "max": 200},
        {"label": "< 500", "min": 200, "max": 500},
        {"label": "≥ 500", "min": 500, "max": float('inf')}
    ]

    # Determine weeks to collect
    today = date.today()

    # If no existing data, start from one year ago
    if not weekly_data:
        print("No existing weekly data found, initializing from one year ago")
        start_date = today - timedelta(days=365)
    else:
        # Find the latest week in existing data
        latest_week_id = max(weekly_data.keys()) if weekly_data else None
        if latest_week_id:
            # Parse latest week and start from the next week
            year, week = latest_week_id.split('-W')
            latest_week_start = datetime.strptime(f"{year} {week} 0", "%Y %W %w").date()
            start_date = latest_week_start + timedelta(days=7)
            print(f"Resuming from week after {latest_week_id}")
        else:
            start_date = today - timedelta(days=365)

    # Collect data for each complete week
    current_date = start_date
    weeks_processed = 0

    while current_date <= today:
        week_start, week_end = get_sunday_week_bounds(current_date)

        # Skip if this week is not complete yet
        week_end_date = week_end.date() if hasattr(week_end, 'date') else week_end
        if week_end_date > today:
            print(f"Skipping incomplete week starting {week_start.strftime('%Y-%m-%d')}")
            break

        week_id = get_week_identifier(current_date)

        # Skip if we already have this week
        if week_id in weekly_data:
            print(f"Week {week_id} already exists, skipping")
            current_date += timedelta(days=7)
            continue

        print(f"Processing week {week_id}: {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}")

        # Initialize bucket counters for the week
        week_bucket_hours = {bucket["label"]: 0 for bucket in intensity_buckets}
        total_week_hours = 0

        # Query data for each day in the week
        for day_offset in range(7):
            day_date = week_start + timedelta(days=day_offset)

            # Ensure we have datetime objects for hour/minute/second operations
            if isinstance(day_date, date) and not isinstance(day_date, datetime):
                day_start = datetime.combine(day_date, datetime.min.time())
                day_end = datetime.combine(day_date, datetime.max.time())
            else:
                day_start = day_date.replace(hour=0, minute=0, second=0)
                day_end = day_date.replace(hour=23, minute=59, second=59)

            # Try current data first
            current_query = get_query_for_station(METRICS_TO_QUERY['sun_rad'], station_config['station_id'])
            historical_query = METRICS_TO_QUERY['sun_rad']['historical_query'] if has_historical_data("sun_rad", station_name) else None

            day_bucket_hours = {bucket["label"]: 0 for bucket in intensity_buckets}

            for query_name, query in [("current", current_query), ("historical", historical_query)]:
                if query is None:
                    continue

                try:
                    result = prom.custom_query_range(
                        query=query,
                        start_time=day_start,
                        end_time=day_end,
                        step="1h"
                    )

                    if result and result[0]['values']:
                        for timestamp, value_str in result[0]['values']:
                            try:
                                value = float(value_str)

                                # Find which bucket this value falls into
                                for bucket in intensity_buckets:
                                    if bucket["min"] <= value < bucket["max"]:
                                        day_bucket_hours[bucket["label"]] += 1
                                        break
                            except (ValueError, TypeError):
                                continue

                        # If we got data from current source, don't try historical
                        break

                except Exception as e:
                    print(f"  - Error querying {query_name} data for {day_date.strftime('%Y-%m-%d')}: {e}")
                    continue

            # Add day's data to week totals
            day_total = sum(day_bucket_hours.values())
            if day_total > 0:
                # Normalize to 24 hours max if needed
                if day_total > 24:
                    scale_factor = 24.0 / day_total
                    for bucket_label in day_bucket_hours:
                        day_bucket_hours[bucket_label] = round(day_bucket_hours[bucket_label] * scale_factor)
                    day_total = 24

                for bucket_label in week_bucket_hours:
                    week_bucket_hours[bucket_label] += day_bucket_hours[bucket_label]
                total_week_hours += day_total

        # Store week data only if we have at least 100 hours of data
        if total_week_hours >= 100:
            # Normalize to 168 hours/week (7 days * 24 hours)
            normalization_factor = 168.0 / total_week_hours
            normalized_buckets = {}

            # First pass: calculate normalized values without rounding
            raw_normalized = {}
            for bucket_label, hours in week_bucket_hours.items():
                raw_normalized[bucket_label] = hours * normalization_factor

            # Second pass: round values and ensure total equals exactly 168
            total_rounded = 0
            for bucket_label, raw_value in raw_normalized.items():
                normalized_buckets[bucket_label] = round(raw_value, 1)
                total_rounded += normalized_buckets[bucket_label]

            # Adjust the largest bucket to make total exactly 168
            if total_rounded != 168.0:
                # Find the bucket with the largest raw value to adjust
                largest_bucket = max(raw_normalized.keys(), key=lambda k: raw_normalized[k])
                adjustment = 168.0 - total_rounded
                normalized_buckets[largest_bucket] = round(normalized_buckets[largest_bucket] + adjustment, 1)

            # Divide by 7 to get daily averages (24h per day instead of 168h per week)
            daily_average_buckets = {}
            for bucket_label, hours in normalized_buckets.items():
                daily_average_buckets[bucket_label] = round(hours / 7.0, 1)

            # Calculate actual total from daily averages (should be ~24)
            actual_daily_total = sum(daily_average_buckets.values())

            weekly_data[week_id] = {
                "week_start": week_start.strftime('%Y-%m-%d'),
                "week_end": week_end.strftime('%Y-%m-%d'),
                "buckets": daily_average_buckets,
                "total_hours": total_week_hours,
                "normalized_hours": actual_daily_total
            }
            print(f"  - Week {week_id}: {total_week_hours} hours -> daily avg {actual_daily_total}h, {daily_average_buckets}")
            weeks_processed += 1
        elif total_week_hours > 0:
            print(f"  - Week {week_id}: {total_week_hours} hours (< 100h minimum, skipping)")
        else:
            print(f"  - Week {week_id}: No data available")

        current_date += timedelta(days=7)

    print(f"Processed {weeks_processed} new weeks")

    # Save updated data
    save_weekly_data(station_name, weekly_data)

    # Return last 52 weeks for display
    sorted_weeks = sorted(weekly_data.keys())
    recent_weeks = sorted_weeks[-52:] if len(sorted_weeks) > 52 else sorted_weeks

    return {week_id: weekly_data[week_id] for week_id in recent_weeks}

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


    # Generate station-specific sun radiation buckets for last 7 days
    if is_metric_available_for_station("sun_rad", station_name):
        sun_rad_buckets = []
        # Define intensity buckets in W/m²
        intensity_buckets = [
            {"label": "Nuit", "min": 0, "max": 0.5},
            {"label": "< 40", "min": 0.5, "max": 40},
            {"label": "< 200", "min": 40, "max": 200},
            {"label": "< 500", "min": 200, "max": 500},
            {"label": "≥ 500", "min": 500, "max": float('inf')}
        ]

        for i in range(1, 8):  # 7 days for better chart visualization
            target_day = today - timedelta(days=i)
            day_name = target_day.strftime("%Y-%m-%d")
            start_of_day = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)

            print(f"Querying sun radiation buckets for '{day_name}' on {station_config['name']}...")

            # Initialize bucket counters (hours spent in each bucket)
            bucket_hours = {bucket["label"]: 0 for bucket in intensity_buckets}

            # Try current data first
            current_query = get_query_for_station(METRICS_TO_QUERY['sun_rad'], station_config['station_id'])
            historical_query = METRICS_TO_QUERY['sun_rad']['historical_query'] if has_historical_data("sun_rad", station_name) else None

            for query_name, query in [("current", current_query), ("historical", historical_query)]:
                if query is None:
                    continue

                try:
                    # Query hourly data for the day
                    range_query = f"{query}[1h:1h]"
                    result = prom.custom_query_range(
                        query=query,
                        start_time=start_of_day,
                        end_time=end_of_day,
                        step="1h"
                    )

                    if result:
                        print(f"  - Got {len(result[0]['values'])} hourly readings from {query_name} source")

                        for timestamp, value_str in result[0]['values']:
                            try:
                                # Convert W/m² value
                                value = float(value_str)

                                # Find which bucket this value falls into
                                for bucket in intensity_buckets:
                                    if bucket["min"] <= value < bucket["max"]:
                                        bucket_hours[bucket["label"]] += 1
                                        break
                            except (ValueError, TypeError):
                                continue

                        # If we got data from current source, don't try historical
                        break

                except Exception as e:
                    print(f"  - Error with {query_name} data: {e}")
                    continue

            # Only add data if we have some readings for the day
            total_hours = sum(bucket_hours.values())
            if total_hours > 0:
                # Safety check: normalize to 24 hours max if we got too much data
                if total_hours > 24:
                    print(f"  - Warning: Got {total_hours}h data, normalizing to 24h")
                    scale_factor = 24.0 / total_hours
                    for bucket_label in bucket_hours:
                        bucket_hours[bucket_label] = round(bucket_hours[bucket_label] * scale_factor)
                    total_hours = 24

                day_data = {
                    "day": day_name,
                    "buckets": bucket_hours,
                    "total_hours": total_hours
                }
                sun_rad_buckets.append(day_data)
                print(f"  - Bucketed {total_hours} hours: {bucket_hours}")
            else:
                print(f"  - No sun radiation data available for {day_name}")

        stats["sun_rad_buckets"] = sun_rad_buckets

    # Generate weekly sun radiation data
    weekly_sun_rad_data = collect_weekly_sun_radiation_data(prom, station_name, station_config)
    if weekly_sun_rad_data:
        # Convert to list format for JavaScript consumption
        weekly_list = []
        for week_id in sorted(weekly_sun_rad_data.keys()):
            week_data = weekly_sun_rad_data[week_id]
            weekly_list.append({
                "week_id": week_id,
                "week_start": week_data["week_start"],
                "week_end": week_data["week_end"],
                "buckets": week_data["buckets"],
                "total_hours": week_data["normalized_hours"]
            })
        stats["sun_rad_weekly_buckets"] = weekly_list

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
