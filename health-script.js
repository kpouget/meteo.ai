// Health Dashboard JavaScript
// Monitors weather station and river flow exporter health

// Configuration
const PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';
const PROMETHEUS_UI_URL = 'https://prometheus.972.ovh';
const REFRESH_INTERVAL = 30000; // 30 seconds
const STALE_THRESHOLD = 300; // 5 minutes
const OLD_THRESHOLD = 900; // 15 minutes

// Health metrics to monitor
const HEALTH_METRICS = {
    weather: {
        vayrac: {
            station_id: 'IVAYRA1',
            display_name: 'Vayrac'
        },
        cahors: {
            station_id: 'ICAHOR23',
            display_name: 'Cahors'
        },
        coublevie: {
            station_id: 'ICOUBL3',
            display_name: 'Coublevie'
        },
        revel: {
            station_id: 'IREVEL54',
            display_name: 'Revel'
        },
        pamplona: {
            station_id: 'IPAMPL52',
            display_name: 'Pamplona'
        },
        mandeli: {
            station_id: 'IMANDELI41',
            display_name: 'Mandeli'
        },
        eastboston: {
            station_id: 'KMAEASTB68',
            display_name: 'East Boston'
        },
        tokyo: {
            station_id: 'ITOKYO63',
            display_name: 'Tokyo'
        }
    },
    rivers: {
        lot: {
            river_name: 'Lot',
            station: 'Cahors',
            station_id: 'O823153002',
            display_name: 'Lot (Cahors)'
        },
        dordogne: {
            river_name: 'Dordogne',
            station: 'Souillac',
            station_id: 'P230001001',
            display_name: 'Dordogne (Souillac)'
        },
        dordogne_carennac: {
            river_name: 'Dordogne',
            station: 'Carennac',
            station_id: 'P207002002',
            display_name: 'Dordogne (Carennac)'
        }
    }
};

// Health status tracking
let healthData = {
    weather: {},
    rivers: {},
    lastUpdate: null,
    alerts: []
};

// Initialize dashboard
function init() {
    console.log('Initializing health dashboard...');

    // Setup event listeners
    document.getElementById('refresh-button').addEventListener('click', refreshData);

    // Test Prometheus connectivity first
    testPrometheusConnection();

    // Start monitoring
    refreshData();
    setInterval(refreshData, REFRESH_INTERVAL);

    console.log('Health dashboard initialized');
}

// Test Prometheus connection and available metrics
async function testPrometheusConnection() {
    console.log('Testing Prometheus connection...');

    try {
        // Test basic connectivity
        const response = await fetch(PROMETHEUS_URL + '?query=up');
        console.log('Prometheus response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Prometheus responded successfully. Available "up" metrics:', data.data.result.length);

            // Check for health metrics
            await checkHealthMetricsAvailable();
        } else {
            console.error('Prometheus not accessible:', response.statusText);
        }
    } catch (error) {
        console.error('Failed to connect to Prometheus:', error);
    }
}

// Check if health metrics are available
async function checkHealthMetricsAvailable() {
    const testQueries = [
        'last_fetch_time',
        'last_fetch_duration',
        'successful_requests_total',
        'station_data_age',
        'river_last_fetch_time',
        'river_last_fetch_duration',
        'river_successful_requests_total',
        'river_data_last_change',
        'river_flow',
        'river_height'
    ];

    for (const metric of testQueries) {
        try {
            const response = await fetch(PROMETHEUS_URL + `?query=${metric}`);
            const data = await response.json();

            if (data.data.result && data.data.result.length > 0) {
                console.log(`✅ Found metric: ${metric}`, data.data.result);
            } else {
                console.log(`❌ Missing metric: ${metric}`);
            }
        } catch (error) {
            console.error(`Error checking metric ${metric}:`, error);
        }
    }
}

// Main refresh function
function refreshData() {
    console.log('Refreshing health data...');
    updateLastUpdateTime();
    showLoadingStatus();

    // Fetch health data for all services
    Promise.all([
        fetchWeatherHealth(),
        fetchRiverHealth()
    ]).then(() => {
        updateOverview();
        updateAlerts();
        console.log('Health data refresh completed');
    }).catch(error => {
        console.error('Error refreshing health data:', error);
        showAlert('system', 'Error refreshing data: ' + error.message, 'critical');
    });
}

// Update last update timestamp
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('last-update').textContent =
        'Last updated: ' + now.toLocaleTimeString();
    healthData.lastUpdate = now;
}

// Show loading status
function showLoadingStatus() {
    // Update all status elements to show "LOADING"
    const statusElements = [
        'vayrac-status', 'cahors-status', 'coublevie-status', 'revel-status',
        'pamplona-status', 'mandeli-status', 'eastboston-status', 'tokyo-status',
        'lot-status', 'dordogne-status', 'dordogne_carennac-status'
    ];

    statusElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = 'LOADING...';
            el.className = 'health-status unknown';
        }
    });
}

// Fetch weather station health metrics
async function fetchWeatherHealth() {
    const promises = [];

    for (const [stationKey, station] of Object.entries(HEALTH_METRICS.weather)) {
        promises.push(fetchStationHealth(stationKey, station));
    }

    await Promise.all(promises);
}

// Fetch individual weather station health
async function fetchStationHealth(stationKey, station) {
    console.log(`Fetching health for ${station.display_name} (${station.station_id})`);

    try {
        const metrics = {};

        // Fetch all health metrics for this station
        const queries = [
            { name: 'last_fetch_time', query: `last_fetch_time{station_id="${station.station_id}"}` },
            { name: 'last_fetch_duration', query: `last_fetch_duration{station_id="${station.station_id}"}` },
            { name: 'requests_rate_per_hour', query: `rate(successful_requests_total{station_id="${station.station_id}"}[30m]) * 3600` },
            { name: 'station_data_age', query: `station_data_age{station_id="${station.station_id}"}` },
            { name: 'current_temperature', query: `temperature{station_id="${station.station_id}"}` }
        ];

        for (const metric of queries) {
            try {
                console.log(`Querying: ${metric.query}`);
                const value = await queryPrometheus(metric.query);
                console.log(`Result for ${metric.name}:`, value);
                metrics[metric.name] = value;
            } catch (error) {
                console.warn(`Failed to fetch ${metric.name} for ${station.display_name}:`, error);
                metrics[metric.name] = null;
            }
        }

        // Calculate health status
        const health = calculateWeatherHealth(metrics);
        health.queries = {
            last_fetch_time: generatePrometheusQuery('last_fetch_time', { station_id: station.station_id }),
            last_fetch_duration: generatePrometheusQuery('last_fetch_duration', { station_id: station.station_id }),
            requests_rate_per_hour: `rate(successful_requests_total{station_id="${station.station_id}"}[30m]) * 3600`,
            station_data_age: generatePrometheusQuery('station_data_age', { station_id: station.station_id })
        };

        healthData.weather[stationKey] = health;

        console.log(`Health calculated for ${station.display_name}:`, health);

        // Update UI
        updateWeatherStationUI(stationKey, health);

    } catch (error) {
        console.error(`Error fetching health for ${station.display_name}:`, error);

        // Show error status
        const errorHealth = {
            status: 'critical',
            error: error.message,
            calculated: {
                lastFetch: 'Error',
                duration: 'Error',
                successRate: 'Error',
                tempChange: 'Error',
                dataAgeFormatted: 'Error'
            }
        };

        healthData.weather[stationKey] = errorHealth;
        updateWeatherStationUI(stationKey, errorHealth);
    }
}

// Fetch river flow health metrics
async function fetchRiverHealth() {
    const promises = [];

    for (const [riverKey, river] of Object.entries(HEALTH_METRICS.rivers)) {
        promises.push(fetchRiverStationHealth(riverKey, river));
    }

    await Promise.all(promises);
}

// Fetch individual river health
async function fetchRiverStationHealth(riverKey, river) {
    try {
        const metrics = {};

        // Fetch river health metrics
        const queries = [
            { name: 'last_fetch_time', query: `river_last_fetch_time{river="${river.river_name}",station="${river.station}"}` },
            { name: 'last_fetch_duration', query: `river_last_fetch_duration{river="${river.river_name}",station="${river.station}"}` },
            { name: 'requests_rate_per_hour', query: `rate(river_successful_requests_total{river="${river.river_name}",station="${river.station}"}[30m]) * 3600` },
            { name: 'flow_last_change', query: `river_data_last_change{river="${river.river_name}",station="${river.station}"}` },
            { name: 'river_flow', query: `river_flow{river="${river.river_name}",station="${river.station}"}` },
            { name: 'river_height', query: `river_height{river="${river.river_name}",station="${river.station}"}` }
        ];

        for (const metric of queries) {
            try {
                const value = await queryPrometheus(metric.query);
                metrics[metric.name] = value;
            } catch (error) {
                console.warn(`Failed to fetch ${metric.name} for ${river.display_name}:`, error);
                metrics[metric.name] = null;
            }
        }

        // Calculate health status
        const health = calculateRiverHealth(metrics);
        health.queries = {
            last_fetch_time: generatePrometheusQuery('river_last_fetch_time', { river: river.river_name, station: river.station }),
            last_fetch_duration: generatePrometheusQuery('river_last_fetch_duration', { river: river.river_name, station: river.station }),
            requests_rate_per_hour: `rate(river_successful_requests_total{river="${river.river_name}",station="${river.station}"}[30m]) * 3600`,
            flow_last_change: generatePrometheusQuery('river_data_last_change', { river: river.river_name, station: river.station })
        };

        healthData.rivers[riverKey] = health;

        // Update UI
        updateRiverStationUI(riverKey, health);

    } catch (error) {
        console.error(`Error fetching health for ${river.display_name}:`, error);

        // Show error status
        const errorHealth = {
            status: 'critical',
            error: error.message,
            calculated: {
                lastFetch: 'Error',
                duration: 'Error',
                successRate: 'Error',
                flowChange: 'Error',
                dataAgeFormatted: 'Error'
            }
        };

        healthData.rivers[riverKey] = errorHealth;
        updateRiverStationUI(riverKey, errorHealth);
    }
}

// Query Prometheus for a metric
async function queryPrometheus(query) {
    const url = `${PROMETHEUS_URL}?query=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status !== 'success') {
        throw new Error(`Prometheus query failed: ${data.error || 'Unknown error'}`);
    }

    if (!data.data.result || data.data.result.length === 0) {
        return null;
    }

    // Return the first result value
    return parseFloat(data.data.result[0].value[1]);
}

// Calculate weather station health status
function calculateWeatherHealth(metrics) {
    const now = Math.floor(Date.now() / 1000);
    const health = {
        status: 'unknown',
        metrics: metrics,
        calculated: {}
    };

    // Calculate data age
    if (metrics.last_fetch_time) {
        health.calculated.dataAge = now - metrics.last_fetch_time;
        health.calculated.dataAgeFormatted = formatDuration(health.calculated.dataAge);

        // Calculate station data staleness
        const stationDataAge = metrics.station_data_age || 0;
        const fetchAge = health.calculated.dataAge;

        // Determine status based on both fetch age and station data age
        // Degraded if either last fetch OR station data is more than 5 minutes old
        if (fetchAge > OLD_THRESHOLD || stationDataAge > OLD_THRESHOLD) {
            health.status = 'critical';
        } else if (fetchAge > STALE_THRESHOLD || stationDataAge > STALE_THRESHOLD) {
            health.status = 'warning';
        } else {
            health.status = 'healthy';
        }
    } else {
        health.status = 'critical';
        health.calculated.dataAge = null;
        health.calculated.dataAgeFormatted = 'Unknown';
    }

    // Format other metrics
    health.calculated.lastFetch = formatTimeAgo(metrics.last_fetch_time);

    health.calculated.duration = metrics.last_fetch_duration ?
        `${metrics.last_fetch_duration.toFixed(2)}s` : 'Unknown';

    health.calculated.successRate = metrics.requests_rate_per_hour ?
        `${Math.round(metrics.requests_rate_per_hour)}/hour` : 'No data';

    health.calculated.dataUpdate = metrics.station_data_age !== null && metrics.station_data_age !== undefined ?
        formatDuration(metrics.station_data_age) : 'Unknown';

    health.calculated.currentTemperature = metrics.current_temperature !== null && metrics.current_temperature !== undefined ?
        `${metrics.current_temperature.toFixed(1)}°C` : 'No data';

    return health;
}

// Calculate river health status (similar to weather but for rivers)
function calculateRiverHealth(metrics) {
    const now = Math.floor(Date.now() / 1000);
    const health = {
        status: 'unknown',
        metrics: metrics,
        calculated: {}
    };

    // Calculate data age
    if (metrics.last_fetch_time) {
        health.calculated.dataAge = now - metrics.last_fetch_time;
        health.calculated.dataAgeFormatted = formatDuration(health.calculated.dataAge);

        // Calculate flow staleness
        const flowAge = metrics.flow_last_change ? (now - metrics.flow_last_change) : Infinity;
        const fetchAge = health.calculated.dataAge;

        // River-specific thresholds: 5 hours for flow changes, 30 minutes for fetch
        const RIVER_FLOW_WARNING = 5 * 60 * 60; // 5 hours = 18000 seconds
        const RIVER_FLOW_CRITICAL = 12 * 60 * 60; // 12 hours = 43200 seconds
        const RIVER_FETCH_CRITICAL = OLD_THRESHOLD * 2; // 30 minutes
        const RIVER_FETCH_WARNING = STALE_THRESHOLD * 2; // 10 minutes

        // Determine status: critical if fetch is very old OR flow is very old
        if (fetchAge > RIVER_FETCH_CRITICAL || flowAge > RIVER_FLOW_CRITICAL) {
            health.status = 'critical';
        } else if (fetchAge > RIVER_FETCH_WARNING || flowAge > RIVER_FLOW_WARNING) {
            health.status = 'warning';
        } else {
            health.status = 'healthy';
        }
    } else {
        health.status = 'critical';
        health.calculated.dataAge = null;
        health.calculated.dataAgeFormatted = 'Unknown';
    }

    // Format metrics
    health.calculated.lastFetch = formatTimeAgo(metrics.last_fetch_time);

    health.calculated.duration = metrics.last_fetch_duration ?
        `${metrics.last_fetch_duration.toFixed(2)}s` : 'Unknown';

    health.calculated.successRate = metrics.requests_rate_per_hour ?
        `${Math.round(metrics.requests_rate_per_hour)}/hour` : 'No data';

    health.calculated.flowChange = formatTimeAgo(metrics.flow_last_change);

    health.calculated.riverFlow = metrics.river_flow !== null && metrics.river_flow !== undefined ?
        `${metrics.river_flow.toFixed(2)} m³/s` : 'No data';

    health.calculated.riverHeight = metrics.river_height !== null && metrics.river_height !== undefined ?
        `${metrics.river_height.toFixed(2)} m` : 'No data';

    return health;
}

// Update weather station UI
function updateWeatherStationUI(stationKey, health) {
    const prefix = stationKey; // 'vayrac' or 'cahors'

    // Update status
    const statusEl = document.getElementById(`${prefix}-status`);
    if (statusEl) {
        statusEl.textContent = health.status.toUpperCase();
        statusEl.className = `health-status ${health.status}`;
    }

    // Update station container class
    const containerEl = document.getElementById(`${prefix}-health`);
    if (containerEl) {
        containerEl.className = `station-health ${health.status}`;
    }

    // Update individual metrics with clickable links
    updateElementWithLink(`${prefix}-last-fetch`, health.calculated?.lastFetch || 'Error',
                         health.queries?.last_fetch_time);
    updateElementWithLink(`${prefix}-duration`, health.calculated?.duration || 'Error',
                         health.queries?.last_fetch_duration);
    updateElementWithLink(`${prefix}-success-rate`, health.calculated?.successRate || 'Error',
                         health.queries?.requests_rate_per_hour);
    updateElementWithLink(`${prefix}-data-update`, health.calculated?.dataUpdate || 'Error',
                         health.queries?.station_data_age);
    updateElementWithLink(`${prefix}-current-temperature`, health.calculated?.currentTemperature || 'Error',
                         generatePrometheusQuery('temperature', { station_id: HEALTH_METRICS.weather[stationKey]?.station_id }));
    updateElement(`${prefix}-data-age`, health.calculated?.dataAgeFormatted || 'Error');
}

// Update river station UI
function updateRiverStationUI(riverKey, health) {
    const prefix = riverKey; // 'lot' or 'dordogne'

    // Update status
    const statusEl = document.getElementById(`${prefix}-status`);
    if (statusEl) {
        statusEl.textContent = health.status.toUpperCase();
        statusEl.className = `health-status ${health.status}`;
    }

    // Update container class
    const containerEl = document.getElementById(`${prefix}-health`);
    if (containerEl) {
        containerEl.className = `station-health ${health.status}`;
    }

    // Update individual metrics with clickable links
    updateElementWithLink(`${prefix}-last-fetch`, health.calculated?.lastFetch || 'Error',
                         health.queries?.last_fetch_time);
    updateElementWithLink(`${prefix}-duration`, health.calculated?.duration || 'Error',
                         health.queries?.last_fetch_duration);
    updateElementWithLink(`${prefix}-success-rate`, health.calculated?.successRate || 'Error',
                         health.queries?.requests_rate_per_hour);
    updateElementWithLink(`${prefix}-flow-change`, health.calculated?.flowChange || 'Error',
                         health.queries?.flow_last_change);
    updateElementWithLink(`${prefix}-river-flow`, health.calculated?.riverFlow || 'Error',
                         generatePrometheusQuery('river_flow', { river: HEALTH_METRICS.rivers[riverKey]?.river_name, station: HEALTH_METRICS.rivers[riverKey]?.station }));
    updateElementWithLink(`${prefix}-river-height`, health.calculated?.riverHeight || 'Error',
                         generatePrometheusQuery('river_height', { river: HEALTH_METRICS.rivers[riverKey]?.river_name, station: HEALTH_METRICS.rivers[riverKey]?.station }));
    updateElement(`${prefix}-data-age`, health.calculated?.dataAgeFormatted || 'Error');
}

// Update system overview
function updateOverview() {
    const allServices = [...Object.values(healthData.weather), ...Object.values(healthData.rivers)];

    const counts = {
        total: allServices.length,
        healthy: allServices.filter(s => s.status === 'healthy').length,
        warning: allServices.filter(s => s.status === 'warning').length,
        critical: allServices.filter(s => s.status === 'critical').length
    };

    updateElement('total-services', counts.total);
    updateElement('healthy-services', counts.healthy);
    updateElement('warning-services', counts.warning);
    updateElement('critical-services', counts.critical);

    // Apply color classes to overview items
    const healthyElement = document.getElementById('healthy-services');
    const warningElement = document.getElementById('warning-services');
    const criticalElement = document.getElementById('critical-services');

    if (healthyElement) {
        const healthyContainer = healthyElement.closest('.overview-item');
        if (healthyContainer) {
            healthyContainer.className = 'overview-item healthy';
        }
    }

    if (warningElement) {
        const warningContainer = warningElement.closest('.overview-item');
        if (warningContainer) {
            warningContainer.className = 'overview-item warning';
        }
    }

    if (criticalElement) {
        const criticalContainer = criticalElement.closest('.overview-item');
        if (criticalContainer) {
            criticalContainer.className = 'overview-item critical';
        }
    }
}

// Get specific reasons for weather station alerts
function getWeatherAlertReasons(health) {
    const reasons = [];
    const now = Math.floor(Date.now() / 1000);

    if (health.metrics && health.metrics.last_fetch_time) {
        const fetchAge = now - health.metrics.last_fetch_time;
        const stationDataAge = health.metrics.station_data_age || 0;

        // Check fetch age
        if (fetchAge > OLD_THRESHOLD) {
            reasons.push(`data fetch very old (${formatDuration(fetchAge)})`);
        } else if (fetchAge > STALE_THRESHOLD) {
            reasons.push(`data fetch stale (${formatDuration(fetchAge)})`);
        }

        // Check station data age
        if (stationDataAge > OLD_THRESHOLD) {
            reasons.push(`station data very old (${formatDuration(stationDataAge)})`);
        } else if (stationDataAge > STALE_THRESHOLD) {
            reasons.push(`station data stale (${formatDuration(stationDataAge)})`);
        }
    } else {
        reasons.push('no fetch data available');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'unknown issue';
}

// Get specific reasons for river station alerts
function getRiverAlertReasons(health) {
    const reasons = [];
    const now = Math.floor(Date.now() / 1000);

    if (health.metrics && health.metrics.last_fetch_time) {
        const fetchAge = now - health.metrics.last_fetch_time;
        const flowAge = health.metrics.flow_last_change ? (now - health.metrics.flow_last_change) : Infinity;

        const RIVER_FETCH_CRITICAL = OLD_THRESHOLD * 2; // 30 minutes
        const RIVER_FETCH_WARNING = STALE_THRESHOLD * 2; // 10 minutes
        const RIVER_FLOW_WARNING = 5 * 60 * 60; // 5 hours
        const RIVER_FLOW_CRITICAL = 12 * 60 * 60; // 12 hours

        // Check fetch age
        if (fetchAge > RIVER_FETCH_CRITICAL) {
            reasons.push(`data fetch very old (${formatDuration(fetchAge)})`);
        } else if (fetchAge > RIVER_FETCH_WARNING) {
            reasons.push(`data fetch stale (${formatDuration(fetchAge)})`);
        }

        // Check flow change age
        if (flowAge > RIVER_FLOW_CRITICAL) {
            reasons.push(`flow unchanged for ${formatDuration(flowAge)}`);
        } else if (flowAge > RIVER_FLOW_WARNING) {
            reasons.push(`flow not updated for ${formatDuration(flowAge)}`);
        }
    } else {
        reasons.push('no fetch data available');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'unknown issue';
}

// Update alerts section
function updateAlerts() {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;

    // Clear existing alerts
    alertsContainer.innerHTML = '';

    // Check for service issues and create alerts
    const now = new Date();

    // Check weather stations
    for (const [key, station] of Object.entries(HEALTH_METRICS.weather)) {
        const health = healthData.weather[key];
        if (health && health.status !== 'healthy') {
            const reasons = getWeatherAlertReasons(health);
            const message = `${station.display_name}: ${health.status.toUpperCase()} - ${reasons}`;
            showAlert(`weather-${key}`, message, health.status);
        }
    }

    // Check rivers
    for (const [key, river] of Object.entries(HEALTH_METRICS.rivers)) {
        const health = healthData.rivers[key];
        if (health && health.status !== 'healthy') {
            const reasons = getRiverAlertReasons(health);
            const message = `${river.display_name}: ${health.status.toUpperCase()} - ${reasons}`;
            showAlert(`river-${key}`, message, health.status);
        }
    }

    // If no alerts, show status message
    if (alertsContainer.children.length === 0) {
        const noAlertsDiv = document.createElement('div');
        noAlertsDiv.className = 'alert-item';
        noAlertsDiv.innerHTML = `
            <span class="alert-time">${now.toLocaleTimeString()}</span>
            <span class="alert-service">System</span>
            <span class="alert-message">All services healthy</span>
        `;
        alertsContainer.appendChild(noAlertsDiv);
    }
}

// Show an alert
function showAlert(serviceId, message, severity) {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;

    const now = new Date();
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-item ${severity}`;
    alertDiv.innerHTML = `
        <span class="alert-time">${now.toLocaleTimeString()}</span>
        <span class="alert-service">${serviceId}</span>
        <span class="alert-message">${message}</span>
    `;

    // Add to beginning of container
    alertsContainer.insertBefore(alertDiv, alertsContainer.firstChild);

    // Limit to 20 alerts
    while (alertsContainer.children.length > 20) {
        alertsContainer.removeChild(alertsContainer.lastChild);
    }
}

// Utility functions
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateElementWithLink(id, value, query) {
    const element = document.getElementById(id);
    if (element) {
        if (query && value !== 'Error' && value !== 'Unknown') {
            // Make it a clickable link
            const prometheusUrl = `${PROMETHEUS_UI_URL}/graph?g0.expr=${encodeURIComponent(query)}&g0.tab=1`;
            element.innerHTML = `<a href="${prometheusUrl}" target="_blank" title="Open in Prometheus">${value}</a>`;
        } else {
            element.textContent = value;
        }
    }
}

function generatePrometheusQuery(metricName, labels) {
    let query = metricName;

    if (labels && Object.keys(labels).length > 0) {
        const labelPairs = Object.entries(labels).map(([key, value]) => `${key}="${value}"`);
        query += `{${labelPairs.join(',')}}`;
    }

    return query;
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return 'Unknown';

    // Round to the nearest second
    seconds = Math.round(seconds);

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';

    const now = Math.floor(Date.now() / 1000);
    const secondsAgo = Math.floor(now - timestamp);

    if (secondsAgo < 0) return 'In the future';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;

    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;

    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
}


// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);