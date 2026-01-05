function loadStatsAndRunMain() {
    var script = document.createElement('script');
    var date = new Date();
    var timestamp = '' + date.getFullYear() + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
    script.src = 'stats.js?v=' + timestamp;
    script.onload = main;
    document.head.appendChild(script);
}

var PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

// Chart instances for cleanup
var chartInstances = {
    pressure: null,
    rivers: null,
    pm: null
};

// Station-aware functions
function getMetricForStation(metricKey) {
    var metric = METRICS[metricKey];
    if (!metric) return null;

    var station = getCurrentStation();

    // Create metric copy with resolved labels
    var resolvedMetric = {
        query: metric.query,
        labels: JSON.parse(JSON.stringify(metric.labels)), // Deep copy
        unit: metric.unit,
        range: metric.range
    };

    // Substitute station_id if present
    if (resolvedMetric.labels.station_id === '{STATION_ID}') {
        resolvedMetric.labels.station_id = station.station_id;
    }

    return resolvedMetric;
}

function isMetricAvailableForStation(metricKey) {
    var metric = METRICS[metricKey];
    if (!metric) return false;

    // Check if metric has station_availability restriction
    if (metric.station_availability && metric.station_availability.length > 0) {
        return metric.station_availability.indexOf(currentStation) !== -1;
    }

    // For PM sensors, check station features
    if (metricKey.indexOf('pm') === 0) {
        var station = getCurrentStation();
        return station.features.pm_sensors;
    }

    // For internal temperatures, only available for Cahors
    if (metricKey === 'temperature_int' || metricKey === 'temperature_e1_chauffage') {
        return currentStation === 'cahors';
    }

    return true;
}

function updateTitlesWithStation() {
    var station = getCurrentStation();
    if (station) {
        var stationTitle = 'Données météo de ' + station.name;

        // Update page title
        var pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = stationTitle;
        }

        // Update main H1
        var mainTitle = document.getElementById('main-title');
        if (mainTitle) {
            mainTitle.textContent = stationTitle;
        }
    }
}

function updateStationSwitcher() {
    var station = getCurrentStation();
    var stationSwitcher = document.getElementById('station-switcher');
    if (stationSwitcher && station) {
        // Show current station and indicate what clicking will switch to
        var otherStationName = (currentStation === 'cahors') ? 'Vayrac' : 'Cahors';
        stationSwitcher.textContent = otherStationName;
        stationSwitcher.title = 'Basculer vers ' + otherStationName;
    }
}

function switchToStation(stationName) {
    // Update the URL with the new station parameter
    var currentUrl = new URL(window.location);
    if (stationName === 'cahors') {
        currentUrl.searchParams.delete('station'); // Cahors is default
    } else {
        currentUrl.searchParams.set('station', stationName);
    }

    // Reload the page with the new station
    window.location.href = currentUrl.toString();
}

function updateStationSpecificVisibility() {
    // Hide/show PM chart container based on station features
    var station = getCurrentStation();
    var pmChartContainer = document.getElementById('pm-chart-container');
    if (pmChartContainer) {
        pmChartContainer.style.display = station.features.pm_sensors ? 'block' : 'none';
    }

    // Hide/show Maison group based on station (only for Cahors)
    var maisonGroup = document.getElementById('maison-group');
    if (maisonGroup) {
        maisonGroup.style.display = (currentStation === 'cahors') ? 'block' : 'none';
    }

    // Hide/show metrics not available for current station
    for (var metricKey in METRICS) {
        var isAvailable = isMetricAvailableForStation(metricKey);
        var kindleElement = document.getElementById(metricKey.replace(/_/g, '-'));
        var desktopElement = document.getElementById('desktop-' + metricKey.replace(/_/g, '-'));

        if (kindleElement) {
            kindleElement.style.display = isAvailable ? 'block' : 'none';
        }
        if (desktopElement) {
            desktopElement.style.display = isAvailable ? 'block' : 'none';
        }
    }
}

function formatLabels(labelsDict) {
    var labelPairs = [];
    for (var key in labelsDict) {
        if (labelsDict.hasOwnProperty(key)) {
            labelPairs.push(key + '="' + labelsDict[key] + '"');
        }
    }
    return labelPairs.join(', ');
}

function processQuery(queryTemplate, labelsDict) {
    var formattedLabels = formatLabels(labelsDict);
    return queryTemplate.replace(/{LABELS}/g, '{' + formattedLabels + '}');
}

function generatePlotUrl(query, range) {
    return 'https://prometheus.972.ovh/graph?g0.expr=' + encodeURIComponent(query) + '&g0.tab=0&g0.range_input=' + range;
}

function humiditeRessentie(dewPoint) {
  if (dewPoint < 0) {
    return "Air très sec (froid piquant, peau sèche)";
  } else if (dewPoint < 10) {
    return "Agréable et confortable (air sec à légèrement humide)";
  } else if (dewPoint < 15) {
    return "Humidité modérée (air un peu lourd)";
  } else if (dewPoint < 18) {
    return "Assez humide (sensation moite)";
  } else if (dewPoint < 21) {
    return "Très humide (air lourd, collant)";
  } else {
    return "Oppressant (forte humidité, inconfort marqué)";
  }
}

var currentPage = 1;
var currentView = isKindle() ? 'kindle' : 'desktop';
var kindleTimer;

function degreesToCardinal(deg) {
    var cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var index = Math.round(deg / 22.5) % 16;
    return cardinals[index];
}

function isKindle() {
    return /Kindle|Silk/i.test(navigator.userAgent);
}

function fetchMetric(metricName, callback) {
    var resolvedMetric = getMetricForStation(metricName);
    if (!resolvedMetric) {
        console.error('Metric ' + metricName + ' not available for current station');
        callback(null);
        return;
    }
    var query = processQuery(resolvedMetric.query, resolvedMetric.labels);
    if (!query) {
        console.error('Failed to process query for metric ' + metricName);
        callback(null);
        return;
    }
    var url = PROMETHEUS_URL + '?query=' + encodeURIComponent(query);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        callback(data.data.result[0].value[1]);
                    } else {
                        callback(null);
                    }
                } catch (error) {
                    console.error('Error parsing response for ' + metricName + ':', error);
                    callback(null);
                }
            } else {
                console.error('Error fetching ' + metricName + ': ' + xhr.statusText);
                callback(null);
            }
        }
    };
    xhr.onerror = function () {
        console.error('Network error fetching ' + metricName);
        callback(null);
    };
    xhr.send();
}

function updateUI() {
    for (var metric in METRICS) {
        // Skip metrics not available for current station
        if (!isMetricAvailableForStation(metric)) {
            continue;
        }

        (function(metric) {
            fetchMetric(metric, function(value) {
                if (value !== null) {
                    var formattedValue;
                    var resolvedMetric = getMetricForStation(metric);

                    if (metric === 'wind_dir') {
                        formattedValue = degreesToCardinal(parseFloat(value));
                    } else if (metric === 'dew_point') {
                        var numericValue = parseFloat(value).toFixed(1);
                        var textValue = humiditeRessentie(parseFloat(value));
                        var unit = resolvedMetric.unit || '';
                        formattedValue = numericValue + unit + '<span class="dew-point-text">' + textValue + '</span>';
                    } else {
                        if (metric.indexOf('rain_') === 0 || metric.indexOf('wind_') === 0 || metric.indexOf('river_') === 0 || metric === 'uv_idx' || metric.indexOf('pm') === 0 || metric.indexOf('temperature_') === 0 || metric.indexOf('humidity_') === 0 || metric === 'sun_rad') {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else if (metric === 'pressure') {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else {
                            formattedValue = parseFloat(value).toFixed(2);
                        }
                        if (resolvedMetric.unit) {
                            formattedValue += ' ' + resolvedMetric.unit;
                        }
                    }

                    var kindleElement = document.getElementById(metric.replace(/_/g, '-'));
                    if (kindleElement) {
                        var valueElement = kindleElement.querySelector('.value');
                        valueElement.innerHTML = formattedValue;
                    }
                    var desktopElement = document.getElementById('desktop-' + metric.replace(/_/g, '-'));
                    if (desktopElement) {
                        var valueElement = desktopElement.querySelector('.value');
                        valueElement.innerHTML = formattedValue;

                        if (resolvedMetric.range) {
                            var link = desktopElement.querySelector('a');
                            if (!link) {
                                link = document.createElement('a');
                                link.href = generatePlotUrl(processQuery(resolvedMetric.query, resolvedMetric.labels), resolvedMetric.range);
                                link.target = '_blank';
                                link.rel = 'noopener noreferrer';

                                while (desktopElement.firstChild) {
                                    link.appendChild(desktopElement.firstChild);
                                }
                                desktopElement.appendChild(link);
                            }
                        }
                    }
                }
            });
        })(metric);
    }

    // Refresh the linear charts
    fetchPressureData(function(pressureData) {
        if (pressureData) {
            renderPressureChart(pressureData);
        }
    });

    fetchRiversData(function(riversData) {
        if (riversData) {
            renderRiversChart(riversData);
        }
    });

    fetchPMData(function(pmData) {
        if (pmData) {
            renderPMChart(pmData);
        }
    });

    // Refresh sun radiation distribution
    fetchSunRadDistribution(function(sunRadData) {
        if (sunRadData) {
            var distributionData = processSunRadDistribution(sunRadData);
            renderSunRadDistribution(distributionData);
        }
    });
}

function updateUrlAnchor() {
    var hash = 'view=' + currentView;
    if (currentView === 'kindle') {
        hash += '&page=' + currentPage;
    }
    window.location.hash = hash;
}

function setupKindleView() {
    document.getElementById('kindle-view').style.display = 'block';
    document.getElementById('desktop-view').style.display = 'none';
    document.getElementById('view-switcher').textContent = '⌨';
    var totalPages = 5;

    for (var i = 1; i <= totalPages; i++) {
        document.getElementById('kindle-page-' + i).style.display = 'none';
    }
    document.getElementById('kindle-page-' + currentPage).style.display = 'block';


    var nextPage = function() {
        document.getElementById('kindle-page-' + currentPage).style.display = 'none';
        currentPage = (currentPage % totalPages) + 1;
        document.getElementById('kindle-page-' + currentPage).style.display = 'block';
        // updateUrlAnchor(); // Disabled to keep clean URLs
    };

    var prevPage = function() {
        document.getElementById('kindle-page-' + currentPage).style.display = 'none';
        currentPage = (currentPage - 2 + totalPages) % totalPages + 1;
        document.getElementById('kindle-page-' + currentPage).style.display = 'block';
        // updateUrlAnchor(); // Disabled to keep clean URLs
    };

    var resetTimer = function() {
        clearInterval(kindleTimer);
        kindleTimer = setInterval(nextPage, 10000);
    };

    document.getElementById('next-page').addEventListener('click', function() {
        nextPage();
        resetTimer();
    });
    document.getElementById('prev-page').addEventListener('click', function() {
        prevPage();
        resetTimer();
    });

    resetTimer();
}

function setupDesktopView() {
    document.getElementById('desktop-view').style.display = 'block';
    var kindleView = document.getElementById('kindle-view');
    kindleView.style.display = 'none';
    document.getElementById('view-switcher').textContent = '⌨';
    clearInterval(kindleTimer);
}

function readUrlAnchor() {
    var hash = window.location.hash.substring(1);
    var params = {};
    var parts = hash.split('&');
    for (var i = 0; i < parts.length; i++) {
        var keyValue = parts[i].split('=');
        if (keyValue.length === 2) {
            params[keyValue[0]] = keyValue[1];
        }
    }

    var view = params['view'];
    var page = params['page'];

    if (view) {
        currentView = view;
    }
    if (page) {
        currentPage = parseInt(page, 10);
    }
}

function getStatsForCurrentStation() {
    // Use station-aware stats if available, fallback to STATS for backward compatibility
    if (typeof STATION_STATS !== 'undefined' && currentStation && STATION_STATS[currentStation]) {
        console.log('Using station-aware stats for:', currentStation);
        return STATION_STATS[currentStation];
    }
    if (typeof STATS !== 'undefined') {
        console.log('Using backward compatibility STATS');
        return STATS;
    }
    console.log('No stats available');
    return null;
}

function fetch24hTemperatureStats(callback) {
    var station = getCurrentStation();
    if (!station) {
        callback(null);
        return;
    }

    // Query for 24-hour min and max temperature
    var baseLabels = {
        "instance": "wunderground.972.ovh:443",
        "job": "internet scraping",
        "mode": "actual",
        "station_id": station.station_id
    };

    var minQuery = processQuery('min_over_time(temperature{LABELS}[24h])', baseLabels);
    var maxQuery = processQuery('max_over_time(temperature{LABELS}[24h])', baseLabels);

    var urls = [
        PROMETHEUS_URL + '?query=' + encodeURIComponent(minQuery),
        PROMETHEUS_URL + '?query=' + encodeURIComponent(maxQuery)
    ];

    var results = [];
    var completedRequests = 0;

    var handleResponse = function(index, xhr) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        results[index] = parseFloat(data.data.result[0].value[1]);
                    } else {
                        results[index] = null;
                    }
                } catch (error) {
                    console.error('Error parsing 24h temperature data:', error);
                    results[index] = null;
                }
            } else {
                console.error('Error fetching 24h temperature data:', xhr.status, xhr.statusText);
                results[index] = null;
            }
            completedRequests++;
            if (completedRequests === urls.length) {
                if (results[0] !== null && results[1] !== null) {
                    callback({
                        min24h: results[0],
                        max24h: results[1]
                    });
                } else {
                    callback(null);
                }
            }
        }
    };

    for (var i = 0; i < urls.length; i++) {
        (function(index) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[index], true);
            xhr.onreadystatechange = function() {
                handleResponse(index, xhr);
            };
            xhr.onerror = function() {
                console.error('Network error fetching 24h temperature data');
                results[index] = null;
                completedRequests++;
                if (completedRequests === urls.length) {
                    callback(null);
                }
            };
            xhr.send();
        })(i);
    }
}

function updateStaticUI() {
    var stats = getStatsForCurrentStation();
    if (!stats) {
        return;
    }

    // Clear existing chart containers to prevent duplicates when switching stations
    var rainChartContainer = document.getElementById('rain-chart-container');
    if (rainChartContainer) {
        rainChartContainer.innerHTML = '<h3>Précipitations des 6 derniers mois</h3>';
    }

    var rainChartDailyContainer = document.getElementById('rain-chart-daily-container');
    if (rainChartDailyContainer) {
        rainChartDailyContainer.innerHTML = '<h3>Précipitations des 6 derniers jours</h3>';
    }

    var sunRadChartContainer = document.getElementById('sun-rad-chart-daily-container');
    if (sunRadChartContainer) {
        sunRadChartContainer.innerHTML = '<h3>Radiation solaire des 6 derniers jours</h3>';
    }

    for (var metric in stats) {
        var stat = stats[metric];
        var desktopElement = document.getElementById('desktop-' + metric.replace(/_/g, '-'));

        if (desktopElement) {
            if (stat.value !== undefined) { // For single-value metrics like rain
                var formattedValue = stat.value.toFixed(0) + ' ' + (stat.unit || '');
                desktopElement.querySelector('.value').textContent = formattedValue;

                var kindleElement = document.getElementById(metric.replace(/_/g, '-'));
                if (kindleElement) {
                    kindleElement.querySelector('.value').innerHTML = formattedValue;
                }

            } else { // For subtitle metrics
                var subtitleElement = desktopElement.querySelector('.subtitle');
                if (subtitleElement && metric === 'temperature_ext') {
                    // Special handling for temperature_ext with 24h data
                    // Capture the element in closure scope to avoid async reference issues
                    (function(tempElement, tempStat) {
                        fetch24hTemperatureStats(function(temp24h) {
                            var subtitleText = '';
                            if (tempStat.max !== undefined) {
                                var finalMin, finalMax;

                                if (temp24h) {
                                    // Use min(STATS.temp.min, temp[24h]) and max(STATS.temp.max, temp[24h])
                                    finalMin = Math.min(tempStat.min, temp24h.min24h);
                                    finalMax = Math.max(tempStat.max, temp24h.max24h);
                                } else {
                                    // Fallback to stats values if 24h fetch fails
                                    finalMin = tempStat.min;
                                    finalMax = tempStat.max;
                                }

                                if (finalMin !== undefined && Math.abs(finalMin) >= 1) {
                                    // Show range when min absolute value is >= 1 (works for negative temps)
                                    subtitleText = Math.round(finalMin) + '..' + Math.round(finalMax);
                                } else if (finalMin !== undefined) {
                                    // Show range for small positive values or when min is very close to 0
                                    subtitleText = Math.round(finalMin) + '..' + Math.round(finalMax);
                                } else {
                                    // Show only max when min is undefined
                                    subtitleText = '' + Math.round(finalMax);
                                }
                                if (tempStat.unit) {
                                    subtitleText += ' ' + tempStat.unit + ' (24h+7j)';
                                }
                            }
                            tempElement.textContent = subtitleText;
                        });
                    })(subtitleElement, stat);
                } else if (subtitleElement) {
                    // Regular subtitle handling for non-temperature metrics
                    var subtitleText = '';
                    if (stat.max !== undefined) {
                        if (stat.min !== undefined && Math.abs(stat.min) >= 1) {
                            // Show range when min absolute value is >= 1 (works for negative temps)
                            subtitleText = stat.min + '..' + stat.max;
                        } else if (stat.min !== undefined) {
                            // Show range for small positive values or when min is very close to 0
                            subtitleText = stat.min + '..' + stat.max;
                        } else {
                            // Show only max when min is undefined
                            subtitleText = '' + stat.max;
                        }
                        if (stat.unit) {
                            subtitleText += ' ' + stat.unit + ' (7j)';
                        }
                    }
                    subtitleElement.textContent = subtitleText;
                }
            }
        }
    }

    if (stats.rain_last_6_months) {
        var chartContainer = document.getElementById('rain-chart-container');

        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRain = 0;
        for (var i = 0; i < stats.rain_last_6_months.length; i++) {
            if (stats.rain_last_6_months[i].value > maxRain) {
                maxRain = stats.rain_last_6_months[i].value;
            }
        }

        for (var i = stats.rain_last_6_months.length - 1; i >= 0; i--) {
            var monthData = stats.rain_last_6_months[i];
            var barContainer = document.createElement('div');
            barContainer.className = 'bar-container';

            var bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = (monthData.value / maxRain * 100) + 'px';

            var monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = monthData.month.charAt(0).toUpperCase() + monthData.month.slice(1);

            var valueLabel = document.createElement('div');
            valueLabel.className = 'value-label';
            valueLabel.textContent = monthData.value + ' ' + monthData.unit;

            barContainer.appendChild(bar);
            barContainer.appendChild(monthLabel);
            barContainer.appendChild(valueLabel);
            chart.appendChild(barContainer);
        }
        chartContainer.appendChild(chart);
    }

    if (stats.rain_last_6_days) {
        var chartContainer = document.getElementById('rain-chart-daily-container');
        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRain = 0;
        for (var i = 0; i < stats.rain_last_6_days.length; i++) {
            if (stats.rain_last_6_days[i].value > maxRain) {
                maxRain = stats.rain_last_6_days[i].value;
            }
        }
        for (var i = 0; i < stats.rain_last_6_days.length; i++) {
            var dayData = stats.rain_last_6_days[i];
            var barContainer = document.createElement('div');
            barContainer.className = 'bar-container';

            var bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = (dayData.value / maxRain * 100) + 'px';

            var dayLabel = document.createElement('div');
            dayLabel.className = 'month-label';
            dayLabel.textContent = dayData.day;

            var valueLabel = document.createElement('div');
            valueLabel.className = 'value-label';
            valueLabel.textContent = dayData.value + ' ' + dayData.unit;

            barContainer.appendChild(bar);
            barContainer.appendChild(dayLabel);
            barContainer.appendChild(valueLabel);
            chart.appendChild(barContainer);
        }
        chartContainer.appendChild(chart);
    }

    if (stats.sun_rad_last_6_days) {
        var chartContainer = document.getElementById('sun-rad-chart-daily-container');
        chartContainer.innerHTML = '<h3>Radiation solaire des 6 derniers jours</h3>';
        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRad = 0;
        for (var i = 0; i < stats.sun_rad_last_6_days.length; i++) {
            if (stats.sun_rad_last_6_days[i].value > maxRad) {
                maxRad = stats.sun_rad_last_6_days[i].value;
            }
        }

        for (var i = 0; i < stats.sun_rad_last_6_days.length; i++) {
            var dayData = stats.sun_rad_last_6_days[i];
            var barContainer = document.createElement('div');
            barContainer.className = 'bar-container';

            var bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = (dayData.value / maxRad * 100) + 'px';

            var dayLabel = document.createElement('div');
            dayLabel.className = 'month-label';
            dayLabel.textContent = dayData.day;

            var valueLabel = document.createElement('div');
            valueLabel.className = 'value-label';
            valueLabel.innerHTML = Math.round(dayData.value) + ' ' + dayData.unit;

            barContainer.appendChild(bar);
            barContainer.appendChild(dayLabel);
            barContainer.appendChild(valueLabel);
            chart.appendChild(barContainer);
        }
        chartContainer.appendChild(chart);
    }
}

function fetchWindData(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 24 * 60 * 60;
    var step = 60 * 10; // 10 minutes

    // Get current station for station-aware queries
    var station = getCurrentStation();
    if (!station) {
        console.error('No station available for wind data');
        callback(null);
        return;
    }

    // Use new Wunderground labels with station_id
    var speedQuery = 'avg_over_time(wind{instance="wunderground.972.ovh:443", job="internet scraping", mode="speed", station_id="' + station.station_id + '"}[10m])';
    var gustQuery = 'avg_over_time(wind{instance="wunderground.972.ovh:443", job="internet scraping", mode="gust", station_id="' + station.station_id + '"}[10m])';
    var dirQuery = 'avg_over_time(wind_dir{instance="wunderground.972.ovh:443", job="internet scraping", station_id="' + station.station_id + '"}[10m])';

    console.log('Fetching wind data for station:', station.station_id);

    var urls = [
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(speedQuery) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(gustQuery) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(dirQuery) + '&start=' + start + '&end=' + end + '&step=' + step
    ];

    var results = [];
    var completedRequests = 0;

    var handleResponse = function(index, xhr) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        results[index] = data;
                    } else {
                        console.error('Error in Prometheus response for wind data:', data);
                        results[index] = null;
                    }
                } catch (error) {
                    console.error('Error parsing response for wind data:', error);
                    results[index] = null;
                }
            } else {
                console.error('Error fetching wind data:', xhr.status, xhr.statusText);
                results[index] = null;
            }
            completedRequests++;
            if (completedRequests === urls.length) {
                if (results.indexOf(null) === -1) {
                    var speedData = results[0].data.result[0].values;
                    var gustData = results[1].data.result[0].values;
                    var dirData = results[2].data.result[0].values;

                    var windData = [];
                    for (var i = 0; i < speedData.length; i++) {
                        windData.push({
                            time: speedData[i][0],
                            speed: parseFloat(speedData[i][1]),
                            gust: parseFloat(gustData[i][1]),
                            direction: parseFloat(dirData[i][1])
                        });
                    }
                    callback(windData);
                } else {
                    callback(null);
                }
            }
        }
    };

    for (var i = 0; i < urls.length; i++) {
        (function(index) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[index], true);
            xhr.onreadystatechange = function() {
                handleResponse(index, xhr);
            };
            xhr.onerror = function() {
                console.error('Network error fetching wind data. Check for CORS issues.');
                results[index] = null;
                completedRequests++;
                if (completedRequests === urls.length) {
                    callback(null);
                }
            };
            xhr.send();
        })(i);
    }
}

function processWindData(windData) {
    var speedBins = [0, 10, 20, 30, 40, 50]; // km/h
    var directionLabels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var directionBins = directionLabels.length;
    var data = new Array(directionBins).fill(0).map(function() { return new Array(speedBins.length).fill(0); });
    var totalMeasures = windData.length;

    windData.forEach(function(d) {
        var dirIndex = Math.round(d.direction / (360 / directionBins)) % directionBins;
        var speedIndex = 0;
        for (var i = 1; i < speedBins.length; i++) {
            if (d.speed >= speedBins[i]) {
                speedIndex = i;
            }
        }
        data[dirIndex][speedIndex]++;
    });

    var flatData = [];
    for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].length; j++) {
            if (data[i][j] > 0) {
                flatData.push({
                    count: data[i][j],
                    percentage: (data[i][j] / totalMeasures * 100),
                    direction: directionLabels[i],
                    speed: j === 0 ? '< ' + speedBins[1] + ' km/h' : speedBins[j] + ' - ' + (speedBins[j+1] || '> ' + speedBins[j]) + ' km/h'
                });
            }
        }
    }

    flatData.sort(function(a, b) {
        return b.count - a.count;
    });

    // Filter out entries below 10%
    var filteredData = flatData.filter(function(item) {
        return item.percentage >= 10;
    });

    return {
        chartData: {
            labels: directionLabels,
            datasets: speedBins.map(function(s, i) {
                return {
                    label: i === 0 ? '< ' + s + ' km/h' : s + ' - ' + (speedBins[i+1] || '> ' + s) + ' km/h',
                    data: data.map(function(d) { return d[i]; }),
                    backgroundColor: 'rgba(' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ', 0.5)',
                    borderColor: '#000',
                    borderWidth: 1
                };
            })
        },
        topCategories: filteredData
    };
}

function updateWindSummaryUI(topCategories) {
    var container = document.getElementById('desktop-wind-summary');
    container.innerHTML = '';
    topCategories.forEach(function(cat) {
        var item = document.createElement('div');
        item.className = 'grid-item';

        // Calculate font size proportional to percentage (12px to 24px range)
        var fontSize = Math.max(12, Math.min(24, 12 + (cat.percentage - 10) * 0.4));

        item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + fontSize + 'px;">' + cat.speed + '</span><span class="subtitle">' + cat.percentage.toFixed(0) + ' %</span>';
        container.appendChild(item);
    });
}

function renderWindRoseChart(processedData) {
    var canvas = document.getElementById('wind-chart');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
        type: 'polarArea',
        data: processedData.chartData,
        options: {
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });

    canvas.addEventListener('click', function() {
        var container = document.getElementById('wind-chart-container');
        container.classList.toggle('fullscreen');
        chart.resize();
    });
}

function fetchWindDataMonth(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 30 * 24 * 60 * 60; // 30 days
    var step = 60 * 60; // 1 hour

    // Get current station for station-aware queries
    var station = getCurrentStation();
    if (!station) {
        console.error('No station available for monthly wind data');
        callback(null);
        return;
    }

    // Use new Wunderground labels with station_id
    var speedQuery = 'avg_over_time(wind{instance="wunderground.972.ovh:443", job="internet scraping", mode="speed", station_id="' + station.station_id + '"}[1h])';
    var gustQuery = 'avg_over_time(wind{instance="wunderground.972.ovh:443", job="internet scraping", mode="gust", station_id="' + station.station_id + '"}[1h])';
    var dirQuery = 'avg_over_time(wind_dir{instance="wunderground.972.ovh:443", job="internet scraping", station_id="' + station.station_id + '"}[1h])';

    console.log('Fetching monthly wind data for station:', station.station_id);

    var urls = [
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(speedQuery) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(gustQuery) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(dirQuery) + '&start=' + start + '&end=' + end + '&step=' + step
    ];

    var results = [];
    var completedRequests = 0;

    var handleResponse = function(index, xhr) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        results[index] = data;
                    } else {
                        console.error('Error in Prometheus response for monthly wind data:', data);
                        results[index] = null;
                    }
                } catch (error) {
                    console.error('Error parsing response for monthly wind data:', error);
                    results[index] = null;
                }
            } else {
                console.error('Error fetching monthly wind data:', xhr.status, xhr.statusText);
                results[index] = null;
            }
            completedRequests++;
            if (completedRequests === urls.length) {
                if (results.indexOf(null) === -1) {
                    var speedData = results[0].data.result[0].values;
                    var gustData = results[1].data.result[0].values;
                    var dirData = results[2].data.result[0].values;

                    var windData = [];
                    for (var i = 0; i < speedData.length; i++) {
                        windData.push({
                            time: speedData[i][0],
                            speed: parseFloat(speedData[i][1]),
                            gust: parseFloat(gustData[i][1]),
                            direction: parseFloat(dirData[i][1])
                        });
                    }
                    callback(windData);
                } else {
                    callback(null);
                }
            }
        }
    };

    for (var i = 0; i < urls.length; i++) {
        (function(index) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[index], true);
            xhr.onreadystatechange = function() {
                handleResponse(index, xhr);
            };
            xhr.onerror = function() {
                console.error('Network error fetching monthly wind data. Check for CORS issues.');
                results[index] = null;
                completedRequests++;
                if (completedRequests === urls.length) {
                    callback(null);
                }
            };
            xhr.send();
        })(i);
    }
}


function updateWindSummaryUIMonth(topCategories) {
    var container = document.getElementById('desktop-wind-summary-month');
    container.innerHTML = '';
    topCategories.forEach(function(cat) {
        var item = document.createElement('div');
        item.className = 'grid-item';

        // Calculate font size proportional to percentage (12px to 24px range)
        var fontSize = Math.max(12, Math.min(24, 12 + (cat.percentage - 10) * 0.4));

        item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + fontSize + 'px;">' + cat.speed + '</span><span class="subtitle">' + cat.percentage.toFixed(0) + ' %</span>';
        container.appendChild(item);
    });
}

function fetchPressureData(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 48 * 60 * 60; // 48 hours
    var step = 60 * 30; // 30 minutes

    // Get pressure query from station-aware METRICS
    var resolvedMetric = getMetricForStation('pressure');
    if (!resolvedMetric) {
        callback(null);
        return;
    }
    var pressureQuery = processQuery(resolvedMetric.query, resolvedMetric.labels);

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(pressureQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var pressureData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                pressure: parseFloat(point[1])
                            };
                        });
                        callback(pressureData);
                    } else {
                        console.error('Error in Prometheus response for pressure data:', data);
                        callback(null);
                    }
                } catch (error) {
                    console.error('Error parsing response for pressure data:', error);
                    callback(null);
                }
            } else {
                console.error('Error fetching pressure data:', xhr.status, xhr.statusText);
                callback(null);
            }
        }
    };
    xhr.onerror = function() {
        console.error('Network error fetching pressure data. Check for CORS issues.');
        callback(null);
    };
    xhr.send();
}

function fetchRiversData(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 48 * 60 * 60; // 48 hours
    var step = 60 * 30; // 30 minutes

    // Get river queries from station-aware METRICS
    var lotMetric = getMetricForStation('river_lot');
    var dordogneMetric = getMetricForStation('river_dordogne');

    if (!lotMetric || !dordogneMetric) {
        callback(null);
        return;
    }

    var lotQuery = processQuery(lotMetric.query, lotMetric.labels);
    var dordogneQuery = processQuery(dordogneMetric.query, dordogneMetric.labels);

    var urls = [
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(lotQuery) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(dordogneQuery) + '&start=' + start + '&end=' + end + '&step=' + step
    ];

    var results = [];
    var completedRequests = 0;

    var handleResponse = function(index, xhr) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        results[index] = data;
                    } else {
                        console.error('Error in Prometheus response for river data:', data);
                        results[index] = null;
                    }
                } catch (error) {
                    console.error('Error parsing response for river data:', error);
                    results[index] = null;
                }
            } else {
                console.error('Error fetching river data:', xhr.status, xhr.statusText);
                results[index] = null;
            }
            completedRequests++;
            if (completedRequests === urls.length) {
                if (results[0] && results[1]) {
                    var lotValues = results[0].data.result[0].values;
                    var dordogneValues = results[1].data.result[0].values;

                    var riversData = {
                        lot: lotValues.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                flow: parseFloat(point[1])
                            };
                        }),
                        dordogne: dordogneValues.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                flow: parseFloat(point[1])
                            };
                        })
                    };
                    callback(riversData);
                } else {
                    callback(null);
                }
            }
        }
    };

    for (var i = 0; i < urls.length; i++) {
        (function(index) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[index], true);
            xhr.onreadystatechange = function() {
                handleResponse(index, xhr);
            };
            xhr.onerror = function() {
                console.error('Network error fetching river data. Check for CORS issues.');
                results[index] = null;
                completedRequests++;
                if (completedRequests === urls.length) {
                    callback(null);
                }
            };
            xhr.send();
        })(i);
    }
}

function fetchSunRadDistribution(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 7 * 24 * 60 * 60; // 7 days
    var step = 60 * 60; // 1 hour

    // Get current station for station-aware queries
    var station = getCurrentStation();
    if (!station) {
        console.error('No station available for sun rad distribution');
        callback(null);
        return;
    }

    // Use new Wunderground labels with station_id
    var sunRadQuery = 'avg_over_time(sun_rad{instance="wunderground.972.ovh:443", job="internet scraping", station_id="' + station.station_id + '"}[1h])';

    console.log('Fetching 7-day solar radiation distribution for station:', station.station_id);

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(sunRadQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var sunRadData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                value: parseFloat(point[1])
                            };
                        });
                        callback(sunRadData);
                    } else {
                        console.error('Error in Prometheus response for sun rad distribution:', data);
                        callback(null);
                    }
                } catch (error) {
                    console.error('Error parsing response for sun rad distribution:', error);
                    callback(null);
                }
            } else {
                console.error('Error fetching sun rad distribution:', xhr.status, xhr.statusText);
                callback(null);
            }
        }
    };
    xhr.onerror = function() {
        console.error('Network error fetching sun rad distribution');
        callback(null);
    };
    xhr.send();
}

function processSunRadDistribution(sunRadData) {
    var thresholds = [1, 40, 100, 200, 400, 800];
    var thresholdCounts = {};

    // Initialize counts (including < 1)
    thresholdCounts['<1'] = 0;
    thresholds.forEach(function(threshold) {
        thresholdCounts[threshold] = 0;
    });

    // Count hours meeting each threshold
    sunRadData.forEach(function(d) {
        if (d.value < 1) {
            thresholdCounts['<1']++;
        }
        thresholds.forEach(function(threshold) {
            if (d.value >= threshold) {
                thresholdCounts[threshold]++;
            }
        });
    });

    var allThresholds = ['<1'].concat(thresholds);
    return {
        totalHours: sunRadData.length,
        thresholds: allThresholds.map(function(threshold) {
            return {
                threshold: threshold,
                count: thresholdCounts[threshold],
                percentage: (thresholdCounts[threshold] / sunRadData.length * 100).toFixed(1)
            };
        })
    };
}

function renderSunRadDistribution(distributionData) {
    var container = document.getElementById('sun-rad-distribution-container');
    if (!container) return;

    container.innerHTML = '<h3>Distribution radiation solaire (sur 7 jours)</h3>';

    var chart = document.createElement('div');
    chart.className = 'sun-rad-distribution';

    distributionData.thresholds.filter(function(item) {
        return item.count > 0;
    }).forEach(function(item) {
        var barContainer = document.createElement('div');
        barContainer.className = 'distribution-item';

        var label = document.createElement('div');
        label.className = 'distribution-label';
        if (item.threshold === '<1') {
            label.textContent = '< 1 J/m²';
        } else {
            label.textContent = '≥ ' + item.threshold + ' J/m²';
        }

        var bar = document.createElement('div');
        bar.className = 'distribution-bar';

        var fill = document.createElement('div');
        fill.className = 'distribution-fill';
        fill.style.width = item.percentage + '%';

        var value = document.createElement('div');
        value.className = 'distribution-value';
        value.textContent = (item.count / 7).toFixed(1) + 'h/j (' + item.percentage + '%)';

        bar.appendChild(fill);
        barContainer.appendChild(label);
        barContainer.appendChild(bar);
        barContainer.appendChild(value);
        chart.appendChild(barContainer);
    });

    container.appendChild(chart);
}

function fetchPMData(callback) {
    // Check if PM sensors are available for current station
    var station = getCurrentStation();
    if (!station.features.pm_sensors) {
        callback(null);
        return;
    }

    var end = new Date().getTime() / 1000;
    var start = end - 48 * 60 * 60; // 48 hours
    var step = 60 * 30; // 30 minutes

    // Get PM queries from station-aware METRICS
    var pm1Metric = getMetricForStation('pm1');
    var pm25Metric = getMetricForStation('pm25');
    var pm10Metric = getMetricForStation('pm10');

    if (!pm1Metric || !pm25Metric || !pm10Metric) {
        callback(null);
        return;
    }

    var pm1Query = processQuery(pm1Metric.query, pm1Metric.labels);
    var pm25Query = processQuery(pm25Metric.query, pm25Metric.labels); // PM2.5 - PM1
    var pm10Query = processQuery(pm10Metric.query, pm10Metric.labels); // PM10 - PM2.5

    var urls = [
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(pm1Query) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(pm25Query) + '&start=' + start + '&end=' + end + '&step=' + step,
        PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(pm10Query) + '&start=' + start + '&end=' + end + '&step=' + step
    ];

    var results = [];
    var completedRequests = 0;

    var handleResponse = function(index, xhr) {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        results[index] = data;
                    } else {
                        console.error('Error in Prometheus response for PM data:', data);
                        results[index] = null;
                    }
                } catch (error) {
                    console.error('Error parsing response for PM data:', error);
                    results[index] = null;
                }
            } else {
                console.error('Error fetching PM data:', xhr.status, xhr.statusText);
                results[index] = null;
            }
            completedRequests++;
            if (completedRequests === urls.length) {
                if (results[0] && results[1] && results[2]) {
                    var pm1Values = results[0].data.result[0].values;
                    var pm25Values = results[1].data.result[0].values;
                    var pm10Values = results[2].data.result[0].values;

                    var pmData = {
                        pm1: pm1Values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                value: parseFloat(point[1])
                            };
                        }),
                        pm25: pm25Values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                value: parseFloat(point[1])
                            };
                        }),
                        pm10: pm10Values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                value: parseFloat(point[1])
                            };
                        })
                    };
                    callback(pmData);
                } else {
                    callback(null);
                }
            }
        }
    };

    for (var i = 0; i < urls.length; i++) {
        (function(index) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', urls[index], true);
            xhr.onreadystatechange = function() {
                handleResponse(index, xhr);
            };
            xhr.onerror = function() {
                console.error('Network error fetching PM data. Check for CORS issues.');
                results[index] = null;
                completedRequests++;
                if (completedRequests === urls.length) {
                    callback(null);
                }
            };
            xhr.send();
        })(i);
    }
}

function calculatePressureTrend(pressureData) {
    if (pressureData.length < 2) return { trend: 'stable', intensity: 0 };

    // Calculate trend over the FULL 48 hours period (use all available data)
    var startPressure = pressureData[0].pressure;
    var endPressure = pressureData[pressureData.length - 1].pressure;
    var delta = endPressure - startPressure;

    // Determine trend direction
    var trend = 'stable';
    if (Math.abs(delta) > 0.5) { // 0.5 hPa threshold over the time period
        if (delta > 0) trend = 'rising';
        else trend = 'falling';
    }

    // Calculate intensity (0 to 1) based on delta magnitude
    var intensity = Math.min(1, Math.abs(delta) / 10); // Scale: 10 hPa = max intensity

    return { trend: trend, intensity: intensity, delta: delta };
}

function getPressureColor(trend, intensity) {
    var alpha = 0.3 + (intensity * 0.7); // 0.3 to 1.0
    var bgAlpha = 0.1 + (intensity * 0.2); // 0.1 to 0.3

    switch (trend) {
        case 'rising':
            return {
                border: 'rgba(34, 139, 34, ' + alpha + ')', // Forest Green
                background: 'rgba(34, 139, 34, ' + bgAlpha + ')'
            };
        case 'falling':
            return {
                border: 'rgba(220, 20, 60, ' + alpha + ')', // Crimson Red
                background: 'rgba(220, 20, 60, ' + bgAlpha + ')'
            };
        default: // stable
            return {
                border: 'rgba(46, 134, 171, ' + alpha + ')', // Original Blue
                background: 'rgba(46, 134, 171, ' + bgAlpha + ')'
            };
    }
}

function renderPressureChart(pressureData) {
    // Destroy existing chart if it exists
    if (chartInstances.pressure) {
        chartInstances.pressure.destroy();
        chartInstances.pressure = null;
    }

    var canvas = document.getElementById('pressure-chart');
    var ctx = canvas.getContext('2d');

    var labels = pressureData.map(function(point) {
        var date = new Date(point.time);
        return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    });

    var pressureValues = pressureData.map(function(point) {
        return point.pressure;
    });

    // Calculate trend and get colors
    var trendInfo = calculatePressureTrend(pressureData);
    var colors = getPressureColor(trendInfo.trend, trendInfo.intensity);

    // Update title with trend indicator and 7-day max
    var titleElement = document.querySelector('#pressure-chart-container h3');
    var trendIcon = '';
    switch (trendInfo.trend) {
        case 'rising': trendIcon = ' ↗️'; break;
        case 'falling': trendIcon = ' ↘️'; break;
        default: trendIcon = ' ➡️'; break;
    }
    var deltaText = Math.abs(trendInfo.delta) > 0.1 ? ' (' + (trendInfo.delta > 0 ? '+' : '') + trendInfo.delta.toFixed(1) + ' hPa)' : '';

    titleElement.innerHTML = 'Évolution de la pression (48h)' + trendIcon + deltaText;

    chartInstances.pressure = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pression (hPa)',
                data: pressureValues,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 4,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    canvas.addEventListener('click', function() {
        var container = document.getElementById('pressure-chart-container');
        container.classList.toggle('fullscreen');
        chartInstances.pressure.resize();
    });
}

function renderRiversChart(riversData) {
    // Destroy existing chart if it exists
    if (chartInstances.rivers) {
        chartInstances.rivers.destroy();
        chartInstances.rivers = null;
    }

    var canvas = document.getElementById('rivers-chart');
    var ctx = canvas.getContext('2d');


    var labels = riversData.lot.map(function(point) {
        var date = new Date(point.time);
        return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    });

    var lotValues = riversData.lot.map(function(point) {
        return point.flow;
    });

    var dordogneValues = riversData.dordogne.map(function(point) {
        return point.flow;
    });

    chartInstances.rivers = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Lot (m³/s)',
                data: lotValues,
                borderColor: '#1E88E5',
                backgroundColor: 'rgba(30, 136, 229, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10,
                yAxisID: 'y-left'
            }, {
                label: 'Dordogne (m³/s)',
                data: dordogneValues,
                borderColor: '#D32F2F',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10,
                yAxisID: 'y-right'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 10
                        },
                        usePointStyle: true
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 4,
                        font: {
                            size: 10
                        }
                    }
                },
                'y-left': {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Lot (m³/s)',
                        font: {
                            size: 10
                        },
                        color: '#1E88E5'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#1E88E5'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                'y-right': {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Dordogne (m³/s)',
                        font: {
                            size: 10
                        },
                        color: '#D32F2F'
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#D32F2F'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    canvas.addEventListener('click', function() {
        var container = document.getElementById('rivers-chart-container');
        container.classList.toggle('fullscreen');
        chartInstances.rivers.resize();
    });
}

function renderPMChart(pmData) {
    // Destroy existing chart if it exists
    if (chartInstances.pm) {
        chartInstances.pm.destroy();
        chartInstances.pm = null;
    }

    var canvas = document.getElementById('pm-chart');
    var ctx = canvas.getContext('2d');


    var labels = pmData.pm1.map(function(point) {
        var date = new Date(point.time);
        return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    });

    var pm1Values = pmData.pm1.map(function(point) {
        return point.value;
    });

    var pm25Values = pmData.pm25.map(function(point) {
        return point.value;
    });

    var pm10Values = pmData.pm10.map(function(point) {
        return point.value;
    });

    chartInstances.pm = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'PM1',
                data: pm1Values,
                borderColor: '#8D6E63',
                backgroundColor: 'rgba(141, 110, 99, 0.7)',
                borderWidth: 1,
                fill: 'origin',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10
            }, {
                label: 'PM2.5',
                data: pm25Values,
                borderColor: '#FFB74D',
                backgroundColor: 'rgba(255, 183, 77, 0.7)',
                borderWidth: 1,
                fill: '-1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10
            }, {
                label: 'PM10',
                data: pm10Values,
                borderColor: '#E57373',
                backgroundColor: 'rgba(229, 115, 115, 0.7)',
                borderWidth: 1,
                fill: '-1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 10
                        },
                        usePointStyle: true
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxTicksLimit: 4,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    stacked: true,
                    display: true,
                    title: {
                        display: true,
                        text: 'μg/m³',
                        font: {
                            size: 10
                        }
                    },
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    fill: true
                }
            }
        }
    });

    canvas.addEventListener('click', function() {
        var container = document.getElementById('pm-chart-container');
        container.classList.toggle('fullscreen');
        chartInstances.pm.resize();
    });
}

function renderWindRoseChartMonth(processedData) {
    var canvas = document.getElementById('wind-chart-month');
    var ctx = canvas.getContext('2d');
    var chart = new Chart(ctx, {
        type: 'polarArea',
        data: processedData.chartData,
        options: {
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });

    canvas.addEventListener('click', function() {
        var container = document.getElementById('wind-chart-container-month');
        container.classList.toggle('fullscreen');
        chart.resize();
    });
}

function main() {
    // Initialize station system (no UI, just URL parameter detection)
    loadStationFromSources();
    updateTitlesWithStation();
    updateStationSwitcher();
    updateStationSpecificVisibility();

    // readUrlAnchor(); // Disabled to keep clean URLs
    if (currentView === 'kindle') {
        setupKindleView();
    } else {
        setupDesktopView();
    }
    // updateUrlAnchor(); // Disabled to keep clean URLs
    updateStaticUI();


    document.getElementById('station-switcher').addEventListener('click', function() {
        var otherStation = (currentStation === 'cahors') ? 'vayrac' : 'cahors';
        switchToStation(otherStation);
    });

    document.getElementById('view-switcher').addEventListener('click', function() {
        if (currentView === 'kindle') {
            currentView = 'desktop';
            setupDesktopView();
        } else {
            currentView = 'kindle';
            setupKindleView();
        }
        // updateUrlAnchor(); // Disabled to keep clean URLs
    });

    document.getElementById('refresh-button').addEventListener('click', function() {
        updateUI();
        updateStaticUI(); // Refresh static charts for current station
    });

    updateUI();
    setInterval(updateUI, 60000);

    fetchWindData(function(windData) {
        if (windData) {
            var processedData = processWindData(windData);
            renderWindRoseChart(processedData);
            updateWindSummaryUI(processedData.topCategories);
        }
    });

    fetchWindDataMonth(function(windData) {
        if (windData) {
            var processedData = processWindData(windData);
            renderWindRoseChartMonth(processedData);
            updateWindSummaryUIMonth(processedData.topCategories);
        }
    });

    fetchPressureData(function(pressureData) {
        if (pressureData) {
            renderPressureChart(pressureData);
        }
    });

    fetchRiversData(function(riversData) {
        if (riversData) {
            renderRiversChart(riversData);
        }
    });

    fetchPMData(function(pmData) {
        if (pmData) {
            renderPMChart(pmData);
        }
    });

    fetchSunRadDistribution(function(sunRadData) {
        if (sunRadData) {
            var distributionData = processSunRadDistribution(sunRadData);
            renderSunRadDistribution(distributionData);
        }
    });
}

loadStatsAndRunMain();
