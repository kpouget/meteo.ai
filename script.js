function loadStatsAndRunMain() {
    var script = document.createElement('script');
    var date = new Date();
    var timestamp = '' + date.getFullYear() + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
    script.src = 'stats.js?v=' + timestamp;
    script.onload = main;
    document.head.appendChild(script);
}

var PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

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
    var query = processQuery(METRICS[metricName].query, METRICS[metricName].labels);
    if (!query) {
        console.error('Metric ' + metricName + ' not found');
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
        (function(metric) {
            fetchMetric(metric, function(value) {
                if (value !== null) {
                    var formattedValue;

                    if (metric === 'wind_dir') {
                        formattedValue = degreesToCardinal(parseFloat(value));
                    } else if (metric === 'dew_point') {
                        var numericValue = parseFloat(value).toFixed(1);
                        var textValue = humiditeRessentie(parseFloat(value));
                        var unit = METRICS[metric].unit || '';
                        formattedValue = numericValue + unit + '<span class="dew-point-text">' + textValue + '</span>';
                    } else {
                        if (metric.indexOf('rain_') === 0 || metric.indexOf('wind_') === 0 || metric.indexOf('river_') === 0 || metric === 'uv_idx' || metric.indexOf('pm') === 0 || metric.indexOf('temperature_') === 0 || metric.indexOf('humidity_') === 0 || metric === 'sun_rad') {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else if (metric === 'pressure') {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else {
                            formattedValue = parseFloat(value).toFixed(2);
                        }
                        if (METRICS[metric].unit) {
                            formattedValue += ' ' + METRICS[metric].unit;
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

                                                if (METRICS[metric].range) {
                                                    var link = desktopElement.querySelector('a');
                                                    if (!link) {
                                                        link = document.createElement('a');
                                                        link.href = generatePlotUrl(processQuery(METRICS[metric].query, METRICS[metric].labels), METRICS[metric].range);
                                                        link.target = '_blank';
                                                        link.rel = 'noopener noreferrer';

                                                        while (desktopElement.firstChild) {
                                                            link.appendChild(desktopElement.firstChild);
                                                        }
                                                        desktopElement.appendChild(link);
                                                    }
                                                }                    }
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
        updateUrlAnchor();
    };

    var prevPage = function() {
        document.getElementById('kindle-page-' + currentPage).style.display = 'none';
        currentPage = (currentPage - 2 + totalPages) % totalPages + 1;
        document.getElementById('kindle-page-' + currentPage).style.display = 'block';
        updateUrlAnchor();
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

function updateStaticUI() {
    if (typeof STATS === 'undefined') {
        return;
    }

    for (var metric in STATS) {
        var stat = STATS[metric];
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
                if (subtitleElement) {
                    var subtitleText = '';
                    if (stat.max !== undefined) {
                        if (stat.min !== undefined && stat.min >= 1) {
                            // Show range when min is >= 1
                            subtitleText = stat.min + '..' + stat.max;
                        } else {
                            // Show only max when min is < 1
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

    if (STATS.rain_last_6_months) {
        var chartContainer = document.getElementById('rain-chart-container');

        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRain = 0;
        for (var i = 0; i < STATS.rain_last_6_months.length; i++) {
            if (STATS.rain_last_6_months[i].value > maxRain) {
                maxRain = STATS.rain_last_6_months[i].value;
            }
        }

        for (var i = STATS.rain_last_6_months.length - 1; i >= 0; i--) {
            var monthData = STATS.rain_last_6_months[i];
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

    if (STATS.rain_last_6_days) {
        var chartContainer = document.getElementById('rain-chart-daily-container');
        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRain = 0;
        for (var i = 0; i < STATS.rain_last_6_days.length; i++) {
            if (STATS.rain_last_6_days[i].value > maxRain) {
                maxRain = STATS.rain_last_6_days[i].value;
            }
        }
        for (var i = 0; i < STATS.rain_last_6_days.length; i++) {
            var dayData = STATS.rain_last_6_days[i];
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

    if (STATS.sun_rad_last_6_days) {
        var chartContainer = document.getElementById('sun-rad-chart-daily-container');
        chartContainer.innerHTML = '<h3>Radiation solaire des 6 derniers jours</h3>';
        var chart = document.createElement('div');
        chart.className = 'rain-chart';

        var maxRad = 0;
        for (var i = 0; i < STATS.sun_rad_last_6_days.length; i++) {
            if (STATS.sun_rad_last_6_days[i].value > maxRad) {
                maxRad = STATS.sun_rad_last_6_days[i].value;
            }
        }

        for (var i = 0; i < STATS.sun_rad_last_6_days.length; i++) {
            var dayData = STATS.sun_rad_last_6_days[i];
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

    var speedQuery = 'avg_over_time(wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}[10m])';
    var gustQuery = 'avg_over_time(wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}[10m])';
    var dirQuery = 'avg_over_time(wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}[10m])';

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

    var speedQuery = 'avg_over_time(wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}[1h])';
    var gustQuery = 'avg_over_time(wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}[1h])';
    var dirQuery = 'avg_over_time(wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}[1h])';

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

    // Get pressure query from METRICS and process labels
    var pressureQuery = processQuery(METRICS.pressure.query, METRICS.pressure.labels);

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

    // Get river queries from METRICS and process labels
    var lotQuery = processQuery(METRICS.river_lot.query, METRICS.river_lot.labels);
    var dordogneQuery = processQuery(METRICS.river_dordogne.query, METRICS.river_dordogne.labels);

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

function fetchPMData(callback) {
    var end = new Date().getTime() / 1000;
    var start = end - 48 * 60 * 60; // 48 hours
    var step = 60 * 30; // 30 minutes

    // Get PM queries from METRICS and process labels
    var pm1Query = processQuery(METRICS.pm1.query, METRICS.pm1.labels);
    var pm25Query = processQuery(METRICS.pm25.query, METRICS.pm25.labels); // PM2.5 - PM1
    var pm10Query = processQuery(METRICS.pm10.query, METRICS.pm10.labels); // PM10 - PM2.5

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

    var chart = new Chart(ctx, {
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
        chart.resize();
    });
}

function renderRiversChart(riversData) {
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

    var chart = new Chart(ctx, {
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
        chart.resize();
    });
}

function renderPMChart(pmData) {
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

    var chart = new Chart(ctx, {
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
        chart.resize();
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
    readUrlAnchor();
    if (currentView === 'kindle') {
        setupKindleView();
    } else {
        setupDesktopView();
    }
    updateUrlAnchor();
    updateStaticUI();


    document.getElementById('view-switcher').addEventListener('click', function() {
        if (currentView === 'kindle') {
            currentView = 'desktop';
            setupDesktopView();
        } else {
            currentView = 'kindle';
            setupKindleView();
        }
        updateUrlAnchor();
    });

    document.getElementById('refresh-button').addEventListener('click', function() {
        updateUI();
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
}

loadStatsAndRunMain();
