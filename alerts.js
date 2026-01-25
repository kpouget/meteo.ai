// Weather Alerts Engine
// Configuration is loaded from alerts-config.js

// Global debug mode state
var alertsDebugMode = false;

// Alert evaluation and display functions
function evaluateAlerts() {
    var activeAlerts = [];
    var currentMetricValues = getCurrentMetricValues();

    WEATHER_ALERTS.forEach(function(alert) {
        var metricValue = currentMetricValues[alert.metric];
        if (metricValue !== null && metricValue !== undefined) {

            // Handle multi-threshold alerts
            if (alert.thresholds) {
                var matchingThreshold = null;

                // Sort thresholds by value to find the highest applicable one
                var sortedThresholds = alert.thresholds.slice().sort(function(a, b) {
                    if (a.condition === "greater_than") return b.value - a.value; // Highest first
                    else return a.value - b.value; // Lowest first
                });

                for (var i = 0; i < sortedThresholds.length; i++) {
                    var threshold = sortedThresholds[i];
                    var conditionMet = false;

                    switch (threshold.condition) {
                        case "greater_than":
                            conditionMet = metricValue > threshold.value;
                            break;
                        case "less_than":
                            conditionMet = metricValue < threshold.value;
                            break;
                        case "equals":
                            conditionMet = metricValue === threshold.value;
                            break;
                    }

                    if (conditionMet) {
                        matchingThreshold = threshold;
                        break;
                    }
                }

                if (matchingThreshold) {
                    activeAlerts.push({
                        level: matchingThreshold.level,
                        message: matchingThreshold.message,
                        value: metricValue,
                        unit: alert.unit || '',
                        id: alert.id
                    });
                }
            } else {
                // Handle single-threshold alerts (backward compatibility)
                var conditionMet = false;

                switch (alert.condition) {
                    case "greater_than":
                        conditionMet = metricValue > alert.threshold;
                        break;
                    case "less_than":
                        conditionMet = metricValue < alert.threshold;
                        break;
                    case "equals":
                        conditionMet = metricValue === alert.threshold;
                        break;
                }

                if (conditionMet) {
                    activeAlerts.push({
                        level: alert.level,
                        message: alert.message,
                        value: metricValue,
                        unit: alert.unit || '',
                        id: alert.id
                    });
                }
            }
        }
    });

    // Sort by level (ALERT first, then WARN, then INFO)
    var levelOrder = { "ALERT": 0, "WARN": 1, "INFO": 2 };
    activeAlerts.sort(function(a, b) {
        if (a.level !== b.level) {
            return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
        }
        return 0;
    });

    return activeAlerts;
}

function getCurrentMetricValues() {
    // This function will collect current values from the UI
    // Returns an object with metric_name: value pairs
    var values = {};

    // Collect values from desktop elements
    ['wind_speed', 'rain_rate', 'temperature_ext', 'river_lot'].forEach(function(metric) {
        var element = document.getElementById('desktop-' + metric.replace(/_/g, '-'));
        if (element) {
            var valueElement = element.querySelector('.value');
            if (valueElement) {
                var textContent = valueElement.textContent || valueElement.innerHTML;
                // Extract numeric value from text like "25.3 km/h" or "12°C"
                var numericValue = parseFloat(textContent.replace(/[^\d.-]/g, ''));
                if (!isNaN(numericValue)) {
                    values[metric] = numericValue;
                }
            }
        }
    });

    return values;
}

function updateAlertsDisplay() {
    var alertsContainer = document.getElementById('weather-alerts');

    if (!alertsContainer) {
        return; // Container not found
    }

    var alertsToShow;

    if (alertsDebugMode) {
        // In debug mode, show all alerts with status
        var allStatuses = getAllAlertsStatus();
        alertsToShow = allStatuses;

        alertsContainer.style.display = 'block';
        alertsContainer.innerHTML = '';

        // Show all alerts with debug info
        allStatuses.forEach(function(alert) {
            if (alert.isMultiThreshold) {
                // Create section title with current value
                var sectionTitle = document.createElement('div');
                sectionTitle.className = 'debug-section-title';

                var currentValue = alert.currentValue !== null && alert.currentValue !== undefined ?
                                  alert.currentValue.toFixed(1) + ' ' + alert.unit : 'no data';

                sectionTitle.textContent = alert.metric + ' ==> ' + currentValue;
                sectionTitle.style.cursor = 'pointer';
                sectionTitle.title = 'Cliquer pour voir le détail';
                sectionTitle.addEventListener('click', function() {
                    scrollToMetric(alert.id);
                });

                alertsContainer.appendChild(sectionTitle);

                // Show individual thresholds
                alert.thresholds.forEach(function(threshold, index) {
                    var thresholdElement = document.createElement('div');

                    // Use alert level colors when active, otherwise use status colors
                    var statusClass;
                    if (threshold.status === 'active') {
                        statusClass = threshold.level; // Use INFO, WARN, or ALERT colors
                    } else if (threshold.status === 'no_data') {
                        statusClass = 'no-data';
                    } else {
                        statusClass = 'inactive';
                    }

                    thresholdElement.className = 'weather-alert weather-alert-debug weather-alert-' + statusClass + ' debug-sub-threshold clickable-alert';

                    var conditionText = threshold.condition === 'greater_than' ? 'supérieur à' :
                                       threshold.condition === 'less_than' ? 'inférieur à' :
                                       threshold.condition === 'equals' ? 'égal à' : threshold.condition;

                    var levelText = threshold.level.toUpperCase();
                    var levelClass = 'debug-level-' + threshold.level.toLowerCase();

                    thresholdElement.innerHTML = `
                        <span class="debug-level ${levelClass}">${levelText}</span>
                        <span class="debug-message">${threshold.message}</span>
                        <span class="debug-condition">${conditionText} ${threshold.value}${alert.unit}</span>
                    `;

                    thresholdElement.style.cursor = 'pointer';
                    thresholdElement.title = 'Cliquer pour voir le détail';
                    thresholdElement.addEventListener('click', function() {
                        scrollToMetric(alert.id);
                    });

                    alertsContainer.appendChild(thresholdElement);
                });

            } else {
                // Handle single-threshold alerts (backward compatibility)
                var alertElement = document.createElement('div');
                var statusClass = alert.status === 'active' ? 'active' :
                                 alert.status === 'no_data' ? 'no-data' : 'inactive';

                alertElement.className = 'weather-alert weather-alert-debug weather-alert-' + statusClass + ' clickable-alert';

                var currentValue = alert.currentValue !== null && alert.currentValue !== undefined ?
                                  alert.currentValue.toFixed(1) + alert.unit : 'no data';

                var conditionText = alert.condition === 'greater_than' ? 'supérieur à' :
                                   alert.condition === 'less_than' ? 'inférieur à' :
                                   alert.condition === 'equals' ? 'égal à' : alert.condition;

                var levelText = alert.level.toUpperCase();
                var levelClass = 'debug-level-' + alert.level.toLowerCase();

                alertElement.innerHTML = `
                    <span class="debug-level ${levelClass}">${levelText}</span>
                    <span class="debug-message">${alert.message}</span>
                    <span class="debug-current">${currentValue}</span>
                    <span class="debug-condition">${conditionText} ${alert.threshold}${alert.unit}</span>
                `;

                alertElement.style.cursor = 'pointer';
                alertElement.title = 'Cliquer pour voir le détail';
                alertElement.addEventListener('click', function() {
                    scrollToMetric(alert.id);
                });

                alertsContainer.appendChild(alertElement);
            }
        });
    } else {
        // Normal mode - only show active alerts
        var activeAlerts = evaluateAlerts();

        if (activeAlerts.length === 0) {
            alertsContainer.style.display = 'none';
            return;
        }

        alertsContainer.style.display = 'block';
        alertsContainer.innerHTML = '';

        // Show top 5 alerts to avoid overwhelming the UI
        activeAlerts.slice(0, 5).forEach(function(alert) {
            var alertElement = document.createElement('div');
            alertElement.className = 'weather-alert weather-alert-' + alert.level + ' clickable-alert';

            var alertText = alert.message;
            if (alert.value !== undefined && alert.unit) {
                alertText += ' (' + alert.value.toFixed(1) + alert.unit + ')';
            }

            alertElement.textContent = alertText;
            alertElement.style.cursor = 'pointer';
            alertElement.title = 'Cliquer pour voir le détail';

            // Add click handler to scroll to relevant metric
            alertElement.addEventListener('click', function() {
                scrollToMetric(alert.id);
            });

            alertsContainer.appendChild(alertElement);
        });
    }
}

// Debug functionality for alerts
function getAllAlertsStatus() {
    var currentMetricValues = getCurrentMetricValues();
    var allStatuses = [];

    WEATHER_ALERTS.forEach(function(alert) {
        var metricValue = currentMetricValues[alert.metric];

        if (alert.thresholds) {
            // Handle multi-threshold alerts - show as grouped structure
            var thresholdStatuses = [];
            var hasActiveThreshold = false;
            var overallStatus = 'inactive';

            alert.thresholds.forEach(function(threshold, index) {
                var conditionMet = false;
                var thresholdStatus = 'inactive';

                if (metricValue !== null && metricValue !== undefined) {
                    switch (threshold.condition) {
                        case "greater_than":
                            conditionMet = metricValue > threshold.value;
                            break;
                        case "less_than":
                            conditionMet = metricValue < threshold.value;
                            break;
                        case "equals":
                            conditionMet = metricValue === threshold.value;
                            break;
                    }

                    if (conditionMet) {
                        thresholdStatus = 'active';
                        hasActiveThreshold = true;
                    }
                } else {
                    thresholdStatus = 'no_data';
                }

                thresholdStatuses.push({
                    level: threshold.level,
                    condition: threshold.condition,
                    value: threshold.value,
                    message: threshold.message,
                    status: thresholdStatus
                });
            });

            if (metricValue === null || metricValue === undefined) {
                overallStatus = 'no_data';
            } else if (hasActiveThreshold) {
                overallStatus = 'active';
            }

            allStatuses.push({
                id: alert.id,
                metric: alert.metric,
                unit: alert.unit || '',
                currentValue: metricValue,
                status: overallStatus,
                isMultiThreshold: true,
                thresholds: thresholdStatuses
            });
        } else {
            // Handle single-threshold alerts (backward compatibility)
            var conditionMet = false;
            var status = 'inactive';

            if (metricValue !== null && metricValue !== undefined) {
                switch (alert.condition) {
                    case "greater_than":
                        conditionMet = metricValue > alert.threshold;
                        break;
                    case "less_than":
                        conditionMet = metricValue < alert.threshold;
                        break;
                    case "equals":
                        conditionMet = metricValue === alert.threshold;
                        break;
                }

                if (conditionMet) {
                    status = 'active';
                }
            } else {
                status = 'no_data';
            }

            allStatuses.push({
                id: alert.id,
                message: alert.message,
                level: alert.level,
                metric: alert.metric,
                condition: alert.condition,
                threshold: alert.threshold,
                unit: alert.unit || '',
                currentValue: metricValue,
                status: status
            });
        }
    });

    return allStatuses;
}

function showAlertsDebug() {
    var allStatuses = getAllAlertsStatus();
    console.log('=== ALERTS DEBUG ===');
    console.table(allStatuses);

    // Also create a visual debug overlay
    createDebugOverlay(allStatuses);
}

function createDebugOverlay(allStatuses) {
    // Remove existing debug overlay
    var existingOverlay = document.getElementById('alerts-debug-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Create new debug overlay
    var overlay = document.createElement('div');
    overlay.id = 'alerts-debug-overlay';
    overlay.style.cssText = `
        position: fixed; top: 50px; right: 20px; width: 400px; max-height: 80vh;
        background: white; border: 2px solid #333; border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000;
        font-family: monospace; font-size: 12px; overflow-y: auto;
    `;

    var header = document.createElement('div');
    header.style.cssText = 'padding: 10px; background: #f0f0f0; border-bottom: 1px solid #ccc; font-weight: bold;';
    header.innerHTML = 'Alerts Debug <button onclick="this.parentElement.parentElement.remove()" style="float:right;">×</button>';
    overlay.appendChild(header);

    var content = document.createElement('div');
    content.style.padding = '10px';

    allStatuses.forEach(function(alert) {
        var alertDiv = document.createElement('div');
        var statusColor = alert.status === 'active' ? '#4CAF50' :
                         alert.status === 'no_data' ? '#FF9800' : '#9E9E9E';

        alertDiv.style.cssText = `
            margin-bottom: 8px; padding: 8px; border-left: 4px solid ${statusColor};
            background: ${alert.level === 'extraordinary' ? '#FFF3E0' : '#F5F5F5'};
        `;

        var conditionText = alert.condition.replace('_', ' ') + ' ' + alert.threshold + alert.unit;
        var valueText = alert.currentValue !== null && alert.currentValue !== undefined ?
                       alert.currentValue.toFixed(1) + alert.unit : 'no data';

        alertDiv.innerHTML = `
            <div><strong>${alert.message}</strong> (${alert.status.toUpperCase()})</div>
            <div>Metric: ${alert.metric}</div>
            <div>Condition: ${conditionText}</div>
            <div>Current: ${valueText}</div>
            <div>Level: ${alert.level}</div>
        `;

        content.appendChild(alertDiv);
    });

    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// Scroll to the relevant metric when an alert is clicked
function scrollToMetric(alertId) {
    // Remove sub-alert index suffix (e.g., "wind_speed_0" -> "wind_speed")
    var baseAlertId = alertId.replace(/_\d+$/, '');

    // Find the alert configuration
    var alert = WEATHER_ALERTS.find(function(a) {
        return a.id === baseAlertId;
    });

    if (!alert) {
        console.warn('Alert not found:', alertId);
        return;
    }

    // Convert metric name to DOM element ID (e.g., "wind_speed" -> "desktop-wind-speed")
    var elementId = 'desktop-' + alert.metric.replace(/_/g, '-');
    var targetElement = document.getElementById(elementId);

    if (targetElement) {
        // Smooth scroll to the element
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Add temporary highlight effect
        targetElement.classList.add('metric-highlight');
        setTimeout(function() {
            targetElement.classList.remove('metric-highlight');
        }, 2000);
    } else {
        console.warn('DOM element not found for metric:', alert.metric);
    }
}

// Toggle debug mode
function toggleAlertsDebugMode() {
    alertsDebugMode = !alertsDebugMode;

    // Update button appearance
    var debugButton = document.getElementById('alerts-debug-toggle');
    if (debugButton) {
        if (alertsDebugMode) {
            debugButton.style.backgroundColor = '#007bff';
            debugButton.style.color = 'white';
            debugButton.style.borderRadius = '4px';
            debugButton.style.padding = '2px 6px';
            debugButton.title = 'Exit alerts debug mode';
        } else {
            debugButton.style.backgroundColor = 'transparent';
            debugButton.style.color = '';
            debugButton.style.borderRadius = '';
            debugButton.style.padding = '';
            debugButton.title = 'Toggle alerts debug';
        }
    }

    // Refresh alerts display
    updateAlertsDisplay();
}

// Initialize alerts when page loads and update periodically
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        // Update alerts every minute (initial update is handled by script.js when metrics load)
        setInterval(updateAlertsDisplay, 60000);

        // Add event listener for debug toggle button
        var debugButton = document.getElementById('alerts-debug-toggle');
        if (debugButton) {
            debugButton.addEventListener('click', toggleAlertsDebugMode);
        }
    });
}
