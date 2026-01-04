# Weather Services Health Dashboard

A comprehensive monitoring dashboard for weather station and river flow exporters.

## Overview

The health dashboard provides real-time monitoring of:
- **Weather Stations**: Vayrac (IVAYRA1) and Cahors (ICAHOR23)
- **River Flow**: Lot and Dordogne rivers
- **System Overview**: Overall service health statistics
- **Alerts**: Recent service issues and status changes

## Files Created

### 1. `health.html`
- Main dashboard page based on `index.html` structure
- Clean, responsive layout with sections for each service type
- Extensible structure for future Prometheus services monitoring

### 2. `health-style.css`
- Complete styling for the health dashboard
- Color-coded status indicators (green/orange/red)
- Responsive design for mobile and desktop
- Hover effects and loading states

### 3. `health-script.js`
- JavaScript logic for fetching and displaying health metrics
- Queries Prometheus for health data
- Calculates service health status based on data freshness
- Auto-refresh every 30 seconds
- Alert management system

### 4. `HEALTH_DASHBOARD.md` (this file)
- Documentation and usage instructions

## Metrics Monitored

### Weather Stations (Vayrac & Cahors)
- **last_fetch_time{station_id="..."}**: When data was last successfully retrieved
- **last_fetch_duration{station_id="..."}**: How long the last API request took
- **successful_requests_total{station_id="..."}**: Total successful requests
- **station_data_age{station_id="..."}**: Age of last data received from station (in seconds)

### River Flow (Lot & Dordogne)
- **last_fetch_time{river_name="..."}**: When data was last successfully retrieved
- **last_fetch_duration{river_name="..."}**: How long the last API request took
- **successful_requests_total{river_name="..."}**: Total successful requests
- **flow_last_change{river_name="..."}**: When flow rate last changed

Each river section includes a direct link to the official Vigicrue monitoring page:
- **Lot River**: Station O823153002 (https://www.vigicrues.gouv.fr/station/O823153002)
- **Dordogne River**: Station P207002002 (https://www.vigicrues.gouv.fr/station/P207002002)

## Health Status Logic

### Status Levels
- **🟢 Healthy**: Data is fresh (< 5 minutes for weather, < 10 minutes fetch + < 5 hours flow change for rivers)
- **🟡 Warning**: Data is getting stale (5-15 minutes for weather, 10-30 minutes fetch OR 5-12 hours flow change for rivers)
- **🔴 Critical**: Data is very old (> 15 minutes for weather, > 30 minutes fetch OR > 12 hours flow change for rivers)
- **⚪ Unknown**: Unable to fetch health metrics

### Thresholds
```javascript
// Weather stations
STALE_THRESHOLD = 300;  // 5 minutes
OLD_THRESHOLD = 900;    // 15 minutes

// River monitoring - separate thresholds for fetch vs flow changes
RIVER_FETCH_WARNING = 600;     // 10 minutes
RIVER_FETCH_CRITICAL = 1800;   // 30 minutes
RIVER_FLOW_WARNING = 18000;    // 5 hours
RIVER_FLOW_CRITICAL = 43200;   // 12 hours
```

## Usage

### 1. Access the Dashboard
```
http://your-server/health.html
```

### 2. Navigation
- **Refresh Button (↻)**: Manually refresh all health data
- **Dashboard Button (📊)**: Return to main weather dashboard
- **Auto-refresh**: Updates every 30 seconds automatically

### 3. Understanding the Display

#### Service Status Cards
Each service shows:
- **Status**: Current health level (HEALTHY/WARNING/CRITICAL)
- **Last Fetch**: When data was last successfully retrieved
- **Fetch Duration**: How long the last API request took
- **Success Count**: Total successful requests since startup
- **Data Change**: When the primary metric (temp/flow) last changed
- **Data Age**: How old the current data is

#### System Overview
- **Total Services**: Number of monitored services (4)
- **Healthy Services**: Services in good state
- **Warning Services**: Services with stale data
- **Critical Services**: Services with very old data

#### Recent Alerts
- Shows recent issues and status changes
- Color-coded by severity
- Auto-removes old alerts (keeps last 20)

## Configuration

### Adding New Services

To monitor additional services, update `health-script.js`:

```javascript
const HEALTH_METRICS = {
    weather: {
        // Add new weather stations here
        new_station: {
            station_id: 'STATION_ID',
            display_name: 'Display Name'
        }
    },
    rivers: {
        // Add new rivers here
        new_river: {
            river_name: 'River Name',
            display_name: 'Display Name'
        }
    }
};
```

Then add corresponding HTML elements in `health.html`.

### Adjusting Thresholds

Modify the constants at the top of `health-script.js`:

```javascript
const REFRESH_INTERVAL = 30000; // Dashboard refresh rate
const STALE_THRESHOLD = 300;    // Warning threshold
const OLD_THRESHOLD = 900;      // Critical threshold
```

## Prometheus Integration

The dashboard expects your exporters to provide these metrics. If using the monitoring framework from `exporter_monitoring.py`, these metrics will be automatically available.

### Example Exporter Metrics
```
# Weather station metrics
last_fetch_time{station_id="IVAYRA1"} 1704067200
last_fetch_duration{station_id="IVAYRA1"} 2.34
successful_requests_total{station_id="IVAYRA1"} 1440
station_data_age{station_id="IVAYRA1"} 330

# River flow metrics
last_fetch_time{river_name="Lot"} 1704067200
last_fetch_duration{river_name="Lot"} 1.87
successful_requests_total{river_name="Lot"} 288
flow_last_change{river_name="Lot"} 1704066900
```

## Future Enhancements

### Planned Features
1. **Prometheus Services Section**: Monitor Prometheus itself, alertmanager, etc.
2. **Historical Charts**: Show health metrics over time
3. **Email/SMS Alerts**: Send notifications when services go critical
4. **Custom Dashboards**: User-configurable monitoring views
5. **API Endpoint**: REST API for health data

### Adding Prometheus Services

The HTML already includes a placeholder section:

```html
<div class="health-section" id="prometheus-section" style="display: none;">
    <h2>Prometheus Services</h2>
    <div class="service-health-container">
        <!-- Future Prometheus service monitoring will go here -->
    </div>
</div>
```

To enable, set `style="display: block;"` and add the monitoring logic.

## Troubleshooting

### Dashboard Shows All Critical
- Check Prometheus URL in `health-script.js`
- Verify exporters are running and exposing metrics
- Check browser console for JavaScript errors

### Metrics Not Updating
- Verify auto-refresh is working (check console logs)
- Check network requests in browser DevTools
- Ensure Prometheus is accessible from the browser

### Status Always Unknown
- Metrics may not exist yet (exporters haven't run)
- Check metric names match exactly
- Verify Prometheus query syntax

## Security Notes

- Dashboard makes direct calls to Prometheus from browser
- Ensure Prometheus has appropriate CORS headers
- Consider adding authentication if needed
- Monitor dashboard access in production

---

The health dashboard provides comprehensive monitoring capabilities to help you detect and diagnose issues with your weather data exporters before they cause service outages.