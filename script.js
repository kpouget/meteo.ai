function loadStatsAndRunMain() {
    var script = document.createElement('script');
    var date = new Date();
    var timestamp = '' + date.getFullYear() + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
    script.src = 'stats.js?v=' + timestamp;
    script.onload = main;
    document.head.appendChild(script);
}

var PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

// Vigicrues station ID mapping
var VIGICRUES_STATIONS = {
    'Lot': {
        'Cahors': 'O823153002'
    },
    'Dordogne': {
        'Souillac': 'P230001001',
        'Carennac': 'P207002001'
    }
};

// Chart instances for cleanup
var chartInstances = {
    temperature: null,
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

    // For Vayrac station, modify river_dordogne to use height instead of flow
    if (metricKey === 'river_dordogne' && currentStation === 'vayrac') {
        resolvedMetric.query = resolvedMetric.query.replace('river_flow', 'river_height');
        resolvedMetric.unit = 'm';
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

    // For Lot river, not available for Vayrac station
    if (metricKey === 'river_lot') {
        return currentStation !== 'vayrac';
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

        // Update main H1 with Weather Underground link
        var mainTitle = document.getElementById('main-title');
        if (mainTitle) {
            var wundergroundUrl = 'https://www.wunderground.com/dashboard/pws/' + station.station_id;
            mainTitle.innerHTML = 'Données météo de <a href="' + wundergroundUrl + '" target="_blank" rel="noopener noreferrer">' + station.name + '</a>';
        }
    }
}

function updateCurrentStationDisplay() {
    var station = getCurrentStation();
    var currentStationElement = document.getElementById('current-station');
    if (currentStationElement && station) {
        currentStationElement.textContent = station.name;
        currentStationElement.title = 'Station actuelle: ' + station.name;
        currentStationElement.style.display = 'block';
    }
}

function updateStationDropdown() {
    var dropdown = document.getElementById('station-dropdown');
    if (!dropdown) return;

    // Clear existing options except the first placeholder
    dropdown.innerHTML = '<option value="">Station</option>';

    // Add options for all stations except the current one
    for (var stationId in STATIONS) {
        if (stationId !== currentStation) {
            var station = STATIONS[stationId];
            var option = document.createElement('option');
            option.value = stationId;
            option.textContent = station.name;
            dropdown.appendChild(option);
        }
    }

    // Add separator
    var longestNameLength = 0;
    for (var stationId in STATIONS) {
        if (STATIONS[stationId].name.length > longestNameLength) {
            longestNameLength = STATIONS[stationId].name.length;
        }
    }
    var separatorOption = document.createElement('option');
    separatorOption.disabled = true;
    separatorOption.textContent = '-'.repeat(longestNameLength);
    dropdown.appendChild(separatorOption);

    // Add health dashboard option
    var healthOption = document.createElement('option');
    healthOption.value = 'health';
    healthOption.textContent = 'Health 📊';
    dropdown.appendChild(healthOption);
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

    // Hide/show rivers section based on station features
    var riversSection = document.getElementById('rivers-section');
    if (riversSection) {
        riversSection.style.display = station.features.rivers ? 'block' : 'none';
    }

    // Hide/show vigilance météo section (only for Cahors and Vayrac - French local weather alerts)
    var vigilanceSection = document.getElementById('vigilance-section');
    if (vigilanceSection) {
        var showVigilance = (currentStation === 'cahors' || currentStation === 'vayrac');
        vigilanceSection.style.display = showVigilance ? 'block' : 'none';
    }

    // Hide/show Maison group based on station (only for Cahors)
    var maisonGroup = document.getElementById('maison-group');
    if (maisonGroup) {
        maisonGroup.style.display = (currentStation === 'cahors') ? 'block' : 'none';
    }

    // Hide/show river elements based on station (not needed anymore since we made river_lot unavailable for vayrac)
    // Keeping this as backup in case CSS needs override

    // Update Dordogne river label based on station
    var dordogneRiverElement = document.getElementById('desktop-river-dordogne');
    if (dordogneRiverElement) {
        var labelElement = dordogneRiverElement.querySelector('.label');
        if (labelElement && currentStation === 'vayrac') {
            labelElement.textContent = 'Dordogne (Carennac)';
        } else if (labelElement) {
            labelElement.textContent = 'Dordogne';
        }
    }

    // Update vigicrues links based on current station
    updateVigicruesLinks();

    // Hide/show metrics not available for current station
    for (var metricKey in METRICS) {
        var isAvailable = isMetricAvailableForStation(metricKey);
        var desktopElement = document.getElementById('desktop-' + metricKey.replace(/_/g, '-'));

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

function degreesToCardinal(deg) {
    var cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var index = Math.round(deg / 22.5) % 16;
    return cardinals[index];
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
                        // Special formatting for Dordogne height on Vayrac (2 decimal places)
                        if (metric === 'river_dordogne' && currentStation === 'vayrac') {
                            formattedValue = parseFloat(value).toFixed(2);
                        } else if (metric.indexOf('rain_') === 0 || metric.indexOf('wind_') === 0 || metric.indexOf('river_') === 0 || metric === 'uv_idx' || metric.indexOf('pm') === 0 || metric.indexOf('temperature_') === 0 || metric.indexOf('humidity_') === 0 || metric === 'sun_rad') {
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
    fetchTemperatureData(function(temperatureData) {
        if (temperatureData) {
            renderTemperatureChart(temperatureData);
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

    // Refresh sun radiation distribution
    fetchSunRadDistribution(function(sunRadData) {
        if (sunRadData) {
            var distributionData = processSunRadDistribution(sunRadData);
            renderSunRadDistribution(distributionData);
        }
    });
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

            } else { // For subtitle metrics
                var subtitleElement = desktopElement.querySelector('.subtitle');
                if (subtitleElement && metric === 'temperature_ext') {
                    // Special handling for temperature_ext with 24h data
                    // Capture the element in closure scope to avoid async reference issues
                    (function(tempElement, tempStat) {
                        // Check if current station actually has stats for temperature_ext
                        var shouldShowSubtitle = true;
                        if (typeof STATION_STATS !== 'undefined' && currentStation) {
                            var stationStats = STATION_STATS[currentStation];
                            if (!stationStats || !stationStats[metric]) {
                                shouldShowSubtitle = false;
                            }
                        }

                        if (!shouldShowSubtitle) {
                            tempElement.textContent = '';
                            return;
                        }

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
                } else if (subtitleElement && metric.indexOf('river_') !== 0) {
                    // Regular subtitle handling for non-temperature and non-river metrics
                    // River metrics are now handled by updateRiverSubtitles()
                    var subtitleText = '';

                    // Check if this metric should have stats for the current station
                    var station = getCurrentStation();
                    var shouldShowSubtitle = true;

                    // Check feature availability for PM sensors
                    if (metric.indexOf('pm') === 0 && !station.features.pm_sensors) {
                        shouldShowSubtitle = false;
                    }

                    // Check if current station actually has stats for this metric
                    // (not just falling back to default cahors stats)
                    if (shouldShowSubtitle && typeof STATION_STATS !== 'undefined' && currentStation) {
                        var stationStats = STATION_STATS[currentStation];
                        if (!stationStats || !stationStats[metric]) {
                            shouldShowSubtitle = false;
                        }
                    }

                    // Regular stat handling for non-river metrics
                    if (shouldShowSubtitle && stat.max !== undefined) {
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
    var start = end - 48 * 60 * 60;
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
    var speedBins = [0, 5, 10, 20, 30, 40, 50]; // km/h
    var directionLabels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var directionBins = directionLabels.length;
    var data = new Array(directionBins).fill(0).map(function() { return new Array(speedBins.length).fill(0); });
    var totalMeasures = 0; // Count only processed winds

    windData.forEach(function(d) {
        if (d.speed < 1) return; // Skip winds < 1 km/h
        totalMeasures++; // Count this wind measurement
        var dirIndex = Math.round(d.direction / (360 / directionBins)) % directionBins;
        var speedIndex = 0;
        for (var i = 1; i < speedBins.length; i++) {
            if (d.speed >= speedBins[i]) {
                speedIndex = i;
            }
        }
        data[dirIndex][speedIndex]++;
    });

    // Create cumulative data for chart display
    var cumulativeData = new Array(directionBins).fill(0).map(function() { return new Array(speedBins.length).fill(0); });
    for (var i = 0; i < data.length; i++) {
        for (var j = 0; j < data[i].length; j++) {
            // Each cumulative bucket includes all lower speed buckets, except the highest bucket
            for (var k = j; k < speedBins.length - 1; k++) {
                cumulativeData[i][k] += data[i][j];
            }
        }
        // Highest bucket (>= 50) is not cumulative, only shows actual high winds
        cumulativeData[i][speedBins.length - 1] = data[i][speedBins.length - 1];
    }

    // Create summary data showing smallest meaningful cumulative bucket for each direction
    var flatData = [];
    for (var i = 0; i < cumulativeData.length; i++) {
        // Calculate total winds for this direction (excluding >= 50 for now)
        var totalExcludingHigh = 0;
        for (var k = 0; k < data[i].length - 1; k++) {
            totalExcludingHigh += data[i][k];
        }

        if (totalExcludingHigh > 0) {
            // Find the smallest cumulative bucket that captures all winds < 50 for this direction
            var bestBucket = -1;
            for (var j = 0; j < cumulativeData[i].length - 1; j++) { // Skip >= 50 bucket
                if (cumulativeData[i][j] >= totalExcludingHigh) {
                    bestBucket = j;
                    break;
                }
            }

            if (bestBucket === -1) {
                bestBucket = speedBins.length - 2; // < 50 km/h bucket
            }

            var displayCount = cumulativeData[i][bestBucket];
            var displayPercentage = (displayCount / totalMeasures * 100);

            // Only show if significant
            if (displayPercentage >= 1) {
                flatData.push({
                    count: displayCount,
                    percentage: displayPercentage,
                    direction: directionLabels[i],
                    speed: '< ' + speedBins[bestBucket + 1] + ' km/h'
                });
            }
        }

        // Also check if there are significant >= 50 winds to show separately
        var highWinds = data[i][data[i].length - 1];
        if (highWinds > 0 && (highWinds / totalMeasures * 100) >= 1) {
            flatData.push({
                count: highWinds,
                percentage: (highWinds / totalMeasures * 100),
                direction: directionLabels[i],
                speed: '>= ' + speedBins[speedBins.length - 1] + ' km/h'
            });
        }
    }

    flatData.sort(function(a, b) {
        return b.count - a.count;
    });

    // Filter out entries below 10% and hide boxes with only < 5 km/h winds
    var filteredData = flatData.filter(function(item) {
        return item.percentage >= 10 && item.speed !== '< 5 km/h';
    });

    // If no wind boxes are visible, show a fallback message
    if (filteredData.length === 0) {
        filteredData = [{
            count: 0,
            percentage: 0,
            direction: '',
            speed: 'Pas de vent'
        }];
    }

    // Manually filter datasets to avoid identical cumulative ones
    var allDatasets = speedBins.map(function(s, i) {
        return {
            label: i < speedBins.length - 1 ? '< ' + speedBins[i+1] + ' km/h' : '>= ' + s + ' km/h',
            data: cumulativeData.map(function(d) { return d[i]; }),
            backgroundColor: 'rgba(' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ',' + Math.floor(Math.random() * 255) + ', 0.5)',
            borderColor: '#000',
            borderWidth: 1
        };
    });

    var filteredDatasets = [];
    var lastKeptDataset = null;

    for (var i = 0; i < allDatasets.length; i++) {
        var dataset = allDatasets[i];


        // Only include datasets that have at least one non-zero data point
        if (!dataset.data.some(function(value) { return value > 0; })) {
            continue;
        }

        // Check if this dataset is identical to the last kept one
        if (lastKeptDataset) {
            var identical = dataset.data.every(function(value, index) {
                return value === lastKeptDataset.data[index];
            });
            if (identical) {
                continue; // Skip identical cumulative buckets
            }
        }

        filteredDatasets.push(dataset);
        lastKeptDataset = dataset;
    }


    return {
        chartData: {
            labels: directionLabels,
            datasets: filteredDatasets
        },
        topCategories: filteredData
    };
}

function updateWindSummaryUI(topCategories) {
    var container = document.getElementById('desktop-wind-summary');
    container.innerHTML = '';
    topCategories.slice(0, 3).forEach(function(cat) {
        var item = document.createElement('div');
        item.className = 'grid-item';

        // Calculate font size proportional to percentage (12px to 24px range)
        var fontSize = Math.max(12, Math.min(24, 12 + (cat.percentage - 10) * 0.4));

        // Check if this direction has winds faster than 10km/h and make speed title bigger
        var hasFastWinds = false;
        if (cat.speed.includes('< ')) {
            var speedValue = parseInt(cat.speed.match(/< (\d+)/)[1]);
            hasFastWinds = speedValue > 10;
        } else if (cat.speed.includes('>= ')) {
            hasFastWinds = true; // >= 50 km/h is definitely > 10
        }

        var speedFontSize = hasFastWinds ? fontSize * 1.3 : fontSize;

        // Special handling for fallback "Pas de vent" message
        if (cat.speed === 'Pas de vent') {
            item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + (fontSize * 1.5) + 'px;">' + cat.speed + '</span><span class="subtitle">&gt; 5km/h</span>';
        } else {
            item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + speedFontSize + 'px;">' + cat.speed + '</span><span class="subtitle">' + cat.percentage.toFixed(0) + ' %</span>';
        }
        container.appendChild(item);
    });
}

function renderWindRoseChart(processedData) {
    var canvas = document.getElementById('wind-chart');
    var ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstances.wind) {
        chartInstances.wind.destroy();
    }

    chartInstances.wind = new Chart(ctx, {
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
    topCategories.slice(0, 3).forEach(function(cat) {
        var item = document.createElement('div');
        item.className = 'grid-item';

        // Calculate font size proportional to percentage (12px to 24px range)
        var fontSize = Math.max(12, Math.min(24, 12 + (cat.percentage - 10) * 0.4));

        // Check if this direction has winds faster than 10km/h and make speed title bigger
        var hasFastWinds = false;
        if (cat.speed.includes('< ')) {
            var speedValue = parseInt(cat.speed.match(/< (\d+)/)[1]);
            hasFastWinds = speedValue > 10;
        } else if (cat.speed.includes('>= ')) {
            hasFastWinds = true; // >= 50 km/h is definitely > 10
        }

        var speedFontSize = hasFastWinds ? fontSize * 1.3 : fontSize;

        // Special handling for fallback "Pas de vent" message
        if (cat.speed === 'Pas de vent') {
            item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + (fontSize * 1.5) + 'px;">' + cat.speed + '</span><span class="subtitle">&gt; 5km/h</span>';
        } else {
            item.innerHTML = '<span class="label">' + cat.direction + '</span><span class="value" style="font-size: ' + speedFontSize + 'px;">' + cat.speed + '</span><span class="subtitle">' + cat.percentage.toFixed(0) + ' %</span>';
        }
        container.appendChild(item);
    });
}

function fetchTemperatureData(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 48 * 60 * 60; // 48 hours
    var step = 60 * 30; // 30 minutes

    // Get temperature query from station-aware METRICS
    var resolvedMetric = getMetricForStation('temperature_ext');
    if (!resolvedMetric) {
        callback(null);
        return;
    }
    var temperatureQuery = processQuery(resolvedMetric.query, resolvedMetric.labels);

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(temperatureQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var temperatureData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                temperature: parseFloat(point[1])
                            };
                        });
                        callback(temperatureData);
                    } else {
                        console.error('Error in Prometheus response for temperature data:', data);
                        callback(null);
                    }
                } catch (error) {
                    console.error('Error parsing response for temperature data:', error);
                    callback(null);
                }
            } else {
                console.error('Error fetching temperature data:', xhr.status, xhr.statusText);
                callback(null);
            }
        }
    };
    xhr.onerror = function() {
        console.error('Network error fetching temperature data. Check for CORS issues.');
        callback(null);
    };
    xhr.send();
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

// Generic function to fetch river data for any river/station combination
function fetchRiverData(riverName, stationName, metricType, timeRange, callback) {
    var end = new Date().getTime() / 1000;
    var start = end - timeRange * 60 * 60; // timeRange in hours
    var step = 60 * 30; // 30 minutes

    // Build query for the specific river and station
    var metric = metricType || 'river_flow'; // default to flow, can also be 'river_height'
    var query = `avg_over_time(${metric}{river="${riverName}",station="${stationName}"}[10m])`;

    var url = PROMETHEUS_URL.replace('/query', '/query_range') +
        '?query=' + encodeURIComponent(query) +
        '&start=' + start +
        '&end=' + end +
        '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var processed = [];
                        for (var i = 0; i < values.length; i++) {
                            var point = {
                                timestamp: values[i][0] * 1000,
                                value: parseFloat(values[i][1])
                            };
                            point[riverName.toLowerCase()] = point.value; // Add river-specific property
                            processed.push(point);
                        }
                        callback(processed, null);
                    } else {
                        console.error(`No data for ${riverName} at ${stationName}:`, data);
                        callback(null, `No data available for ${riverName} at ${stationName}`);
                    }
                } catch (error) {
                    console.error(`Error parsing ${riverName} data:`, error);
                    callback(null, error.message);
                }
            } else {
                console.error(`Error fetching ${riverName} data:`, xhr.status, xhr.statusText);
                callback(null, `HTTP ${xhr.status}: ${xhr.statusText}`);
            }
        }
    };
    xhr.send();
}

function fetchRiversData(callback) {
    // Define rivers based on current station
    var riversConfig = [];

    if (currentStation === 'vayrac') {
        riversConfig = [
            { riverName: 'Dordogne', stationName: 'Carennac', displayName: 'dordogne' }
        ];
    } else if (currentStation === 'cahors') {
        // For Cahors station, show both rivers with Dordogne at Souillac
        riversConfig = [
            { riverName: 'Lot', stationName: 'Cahors', displayName: 'lot' },
            { riverName: 'Dordogne', stationName: 'Souillac', displayName: 'dordogne' }
        ];
    } else {
        // For other stations, show both rivers with Dordogne at Carennac
        riversConfig = [
            { riverName: 'Lot', stationName: 'Cahors', displayName: 'lot' },
            { riverName: 'Dordogne', stationName: 'Carennac', displayName: 'dordogne' }
        ];
    }

    var results = [];
    var totalRequests = riversConfig.length * 2; // Both flow and height for each river
    var completedRequests = 0;
    var errors = [];

    // Fetch both flow and height data for each configured river
    riversConfig.forEach(function(riverConfig, index) {
        results[index] = {
            riverName: riverConfig.riverName,
            stationName: riverConfig.stationName,
            displayName: riverConfig.displayName,
            flowData: null,
            heightData: null
        };

        // Fetch flow data
        fetchRiverData(riverConfig.riverName, riverConfig.stationName, 'river_flow', 48, function(data, error) {
            if (data) {
                results[index].flowData = data;
            } else {
                errors.push(`${riverConfig.riverName} flow: ${error}`);
            }

            completedRequests++;
            checkCompletion();
        });

        // Fetch height data
        fetchRiverData(riverConfig.riverName, riverConfig.stationName, 'river_height', 48, function(data, error) {
            if (data) {
                results[index].heightData = data;
            } else {
                errors.push(`${riverConfig.riverName} height: ${error}`);
            }

            completedRequests++;
            checkCompletion();
        });
    });

    function checkCompletion() {
        if (completedRequests === totalRequests) {
            // Process results for compatibility with existing chart code
            if (results.some(r => r.flowData !== null || r.heightData !== null)) {
                var processed = combineRiverResults(results, riversConfig);
                callback(processed);
            } else {
                console.error('No river data available:', errors);
                callback(null);
            }
        }
    }
}

// Helper function to combine multiple river results into the expected format
function combineRiverResults(results, riversConfig) {
    var processed = [];

    // Find the longest dataset to use as the base timeline
    var maxLength = 0;
    var baseData = null;
    for (var i = 0; i < results.length; i++) {
        if (results[i]) {
            var primaryData = getPrimaryDataForRiver(results[i]);
            if (primaryData && primaryData.length > maxLength) {
                maxLength = primaryData.length;
                baseData = primaryData;
            }
        }
    }

    if (!baseData) return [];

    // Create combined data points
    for (var i = 0; i < baseData.length; i++) {
        var point = { timestamp: baseData[i].timestamp };

        // Add data from each river
        for (var j = 0; j < results.length; j++) {
            if (results[j]) {
                var riverResult = results[j];
                var primaryData = getPrimaryDataForRiver(riverResult);
                var secondaryData = getSecondaryDataForRiver(riverResult);

                // Add primary metric (for chart display)
                if (primaryData && primaryData[i]) {
                    point[riverResult.displayName] = primaryData[i].value;
                }

                // Add secondary metric (for subtitle display)
                if (secondaryData && secondaryData[i]) {
                    point[riverResult.displayName + '_secondary'] = secondaryData[i].value;
                }

                // Store metric types for UI display
                if (i === 0) { // Only on first iteration
                    point[riverResult.displayName + '_primary_type'] = getPrimaryMetricType(riverResult);
                    point[riverResult.displayName + '_secondary_type'] = getSecondaryMetricType(riverResult);
                    point[riverResult.displayName + '_primary_unit'] = getPrimaryUnit(riverResult);
                    point[riverResult.displayName + '_secondary_unit'] = getSecondaryUnit(riverResult);
                }
            }
        }

        processed.push(point);
    }

    return processed;
}

// Helper functions to determine primary/secondary metrics based on station
function getPrimaryDataForRiver(riverResult) {
    // For Vayrac Dordogne, primary is height; for others, primary is flow
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return riverResult.heightData;
    } else {
        return riverResult.flowData;
    }
}

function getSecondaryDataForRiver(riverResult) {
    // For Vayrac Dordogne, secondary is flow; for others, secondary is height
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return riverResult.flowData;
    } else {
        return riverResult.heightData;
    }
}

function getPrimaryMetricType(riverResult) {
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return 'height';
    } else {
        return 'flow';
    }
}

function getSecondaryMetricType(riverResult) {
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return 'flow';
    } else {
        return 'height';
    }
}

function getPrimaryUnit(riverResult) {
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return 'm';
    } else {
        return 'm³/s';
    }
}

function getSecondaryUnit(riverResult) {
    if (currentStation === 'vayrac' && riverResult.riverName === 'Dordogne') {
        return 'm³/s';
    } else {
        return 'm';
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

function renderTemperatureChart(temperatureData) {
    // Destroy existing chart if it exists
    if (chartInstances.temperature) {
        chartInstances.temperature.destroy();
        chartInstances.temperature = null;
    }

    var canvas = document.getElementById('temperature-chart');
    var ctx = canvas.getContext('2d');

    var labels = temperatureData.map(function(point) {
        var date = new Date(point.time);
        return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    });

    var temperatureValues = temperatureData.map(function(point) {
        return point.temperature;
    });

    chartInstances.temperature = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Température (°C)',
                data: temperatureValues,
                borderColor: '#FF6B35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
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
        var container = document.getElementById('temperature-chart-container');
        container.classList.toggle('fullscreen');
        chartInstances.temperature.resize();
    });
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

    // Handle new data format: array of points with timestamp and river values
    if (!riversData || riversData.length === 0) {
        console.error('No river data to display');
        return;
    }

    // Generate labels from timestamps
    var labels = riversData.map(function(point) {
        var date = new Date(point.timestamp);
        return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    });

    // Create datasets based on available rivers
    var datasets = [];

    // Add Lot river data if available
    if (riversData[0].lot !== undefined) {
        console.log('Adding Lot river data for station:', currentStation);
        var lotValues = riversData.map(function(point) {
            return point.lot;
        });
        datasets.push({
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
        });
    }

    // Add Dordogne river data if available
    if (riversData[0].dordogne !== undefined) {
        console.log('Adding Dordogne river data for station:', currentStation);
        var dordogneValues = riversData.map(function(point) {
            return point.dordogne;
        });

        // Determine label, unit, and colors based on station
        var dordogneLabel, dordogneUnit, dordogneBorderColor, dordogneBackgroundColor;
        if (currentStation === 'vayrac') {
            dordogneLabel = 'Niveau de la Dordogne';
            dordogneUnit = 'm';
            dordogneBorderColor = '#1E88E5'; // Blue like Lot
            dordogneBackgroundColor = 'rgba(30, 136, 229, 0.1)'; // Blue with transparency
        } else {
            dordogneLabel = 'Dordogne (m³/s)';
            dordogneUnit = 'm³/s';
            dordogneBorderColor = '#D32F2F'; // Red for other stations
            dordogneBackgroundColor = 'rgba(211, 47, 47, 0.1)'; // Red with transparency
        }

        // For Vayrac, always use left axis since it's the only river
        // For other stations, use right axis if Lot is already present
        console.log('Dordogne chart - currentStation:', currentStation, 'datasets.length:', datasets.length);
        var axisId = (currentStation === 'vayrac') ? 'y-left' : (datasets.length === 0 ? 'y-left' : 'y-right');
        console.log('Dordogne assigned to axis:', axisId);

        datasets.push({
            label: dordogneLabel,
            data: dordogneValues,
            borderColor: dordogneBorderColor,
            backgroundColor: dordogneBackgroundColor,
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
            yAxisID: axisId
        });
    }

    chartInstances.rivers = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
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
            scales: (function() {
                var scales = {
                    x: {
                        display: true,
                        ticks: {
                            maxTicksLimit: 4,
                            font: {
                                size: 10
                            }
                        }
                    }
                };

                // Configure axes based on available datasets and station
                if (currentStation === 'vayrac') {
                    // For Vayrac: only Dordogne height on left axis
                    scales['y-left'] = {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Dordogne (m)',
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
                            drawOnChartArea: true
                        }
                    };
                } else {
                    // For other stations: dual axis if both rivers available
                    var hasLot = datasets.some(function(d) { return d.label.indexOf('Lot') !== -1; });
                    var hasDordogne = datasets.some(function(d) { return d.label.indexOf('Dordogne') !== -1; });

                    if (hasLot) {
                        scales['y-left'] = {
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
                        };
                    }

                    if (hasDordogne) {
                        scales['y-right'] = {
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
                        };
                    }
                }

                return scales;
            })(),
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

    // Update river subtitles with both metrics
    updateRiverSubtitles(riversData);

    // Update vigicrues links based on current station and rivers
    updateVigicruesLinks();
}

function updateVigicruesLinks() {
    // Update Lot river link
    var lotLink = document.getElementById('lot-vigicrues-link');
    if (lotLink) {
        var stationId = VIGICRUES_STATIONS['Lot']['Cahors'];
        if (stationId) {
            lotLink.href = 'https://www.vigicrues.gouv.fr/station/' + stationId;
        }
    }

    // Update Dordogne river link based on current station
    var dordogneLink = document.getElementById('dordogne-vigicrues-link');
    if (dordogneLink) {
        var dordogneStationName;
        if (currentStation === 'vayrac') {
            dordogneStationName = 'Carennac';
        } else if (currentStation === 'cahors') {
            dordogneStationName = 'Souillac';
        } else {
            dordogneStationName = 'Carennac'; // default
        }

        var stationId = VIGICRUES_STATIONS['Dordogne'][dordogneStationName];
        if (stationId) {
            dordogneLink.href = 'https://www.vigicrues.gouv.fr/station/' + stationId;
        }
    }
}

function updateRiverSubtitles(riversData) {
    if (!riversData || riversData.length === 0) return;

    // Get the first data point to extract metadata and current values
    var firstPoint = riversData[0];
    var stats = getStatsForCurrentStation();

    // Update Lot river subtitle (if available)
    if (firstPoint.lot !== undefined) {
        var lotElement = document.getElementById('desktop-river-lot');
        if (lotElement) {
            var labelElement = lotElement.querySelector('.label');
            var subtitleElement = lotElement.querySelector('.subtitle');

            if (labelElement && subtitleElement) {
                // Current secondary metric (height)
                var secondaryValue = firstPoint.lot_secondary ? firstPoint.lot_secondary.toFixed(2) + ' m' : '';

                // Update label to include secondary metric
                if (secondaryValue) {
                    labelElement.innerHTML = 'Lot<br><span style="font-size: 0.8em; color: #888; font-weight: normal;">' + secondaryValue + '</span>';
                } else {
                    labelElement.textContent = 'Lot';
                }

                // Min/max for primary metric (flow) - only in subtitle
                var flowStats = stats ? stats['river_lot'] : null;
                if (flowStats && flowStats.min !== undefined && flowStats.max !== undefined) {
                    subtitleElement.textContent = flowStats.min + '..' + flowStats.max + ' m³/s (7j)';
                } else {
                    subtitleElement.textContent = '--';
                }
            }
        }
    }

    // Update Dordogne river subtitle (if available)
    if (firstPoint.dordogne !== undefined) {
        var dordogneElement = document.getElementById('desktop-river-dordogne');
        if (dordogneElement) {
            var labelElement = dordogneElement.querySelector('.label');
            var subtitleElement = dordogneElement.querySelector('.subtitle');

            if (labelElement && subtitleElement) {
                var primaryType = firstPoint.dordogne_primary_type;
                var secondaryType = firstPoint.dordogne_secondary_type;
                var primaryUnit = firstPoint.dordogne_primary_unit;
                var secondaryUnit = firstPoint.dordogne_secondary_unit;

                // Current secondary metric
                var secondaryValue = '';
                if (firstPoint.dordogne_secondary !== undefined) {
                    if (secondaryType === 'height') {
                        secondaryValue = firstPoint.dordogne_secondary.toFixed(2) + ' ' + secondaryUnit;
                    } else {
                        secondaryValue = firstPoint.dordogne_secondary.toFixed(0) + ' ' + secondaryUnit;
                    }
                }

                // Update label to include secondary metric
                var baseLabelText = 'Dordogne';
                if (currentStation === 'vayrac') {
                    baseLabelText = 'Dordogne (Carennac)';
                }

                if (secondaryValue) {
                    labelElement.innerHTML = baseLabelText + '<br><span style="font-size: 0.8em; color: #888; font-weight: normal;">' + secondaryValue + '</span>';
                } else {
                    labelElement.textContent = baseLabelText;
                }

                // Min/max for primary metric - only in subtitle
                var primaryStatsKey;
                if (currentStation === 'vayrac') {
                    // For Vayrac, primary is height
                    primaryStatsKey = 'river_dordogne_height';
                } else {
                    // For other stations, primary is flow
                    primaryStatsKey = 'river_dordogne';
                }

                var primaryStats = stats ? stats[primaryStatsKey] : null;
                if (primaryStats && primaryStats.min !== undefined && primaryStats.max !== undefined) {
                    if (primaryType === 'height') {
                        var minHeight = parseFloat(primaryStats.min).toFixed(2);
                        var maxHeight = parseFloat(primaryStats.max).toFixed(2);
                        subtitleElement.textContent = minHeight + '..' + maxHeight + ' ' + primaryUnit + ' (7j)';
                    } else {
                        subtitleElement.textContent = primaryStats.min + '..' + primaryStats.max + ' ' + primaryUnit + ' (7j)';
                    }
                } else {
                    subtitleElement.textContent = '--';
                }
            }
        }
    }
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

    // Destroy existing chart if it exists
    if (chartInstances.windMonth) {
        chartInstances.windMonth.destroy();
    }

    chartInstances.windMonth = new Chart(ctx, {
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
    updateCurrentStationDisplay();
    updateStationDropdown();
    updateStationSpecificVisibility();

    updateStaticUI();


    // Station dropdown event handler
    document.getElementById('station-dropdown').addEventListener('change', function() {
        var selectedStation = this.value;
        if (selectedStation === 'health') {
            // Navigate to health dashboard
            window.location.href = 'health.html';
        } else if (selectedStation) {
            switchToStation(selectedStation);
        }
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

    fetchTemperatureData(function(temperatureData) {
        if (temperatureData) {
            renderTemperatureChart(temperatureData);
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
