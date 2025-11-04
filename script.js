var METRICS = {
    "rain_rate": {
        "query": "max_over_time(rain{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"rate\"}[10m])",
        "unit": "mm/h",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22rate%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "rain_total_day": {
        "query": "increase(rain{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"total\"}[1d])",
        "unit": "mm",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B1d%5D)&g0.tab=0&g0.range_input=1d"
    },
    "rain_total_week": {
        "query": "increase(rain{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"total\"}[7d])",
        "unit": "mm",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B7d%5D)&g0.tab=0&g0.range_input=7d"
    },
    "rain_total_month": {
        "query": "increase(rain{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"total\"}[30d])",
        "unit": "mm",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B30d%5D)&g0.tab=0&g0.range_input=30d"
    },
    "rain_total_year": {
        "query": "increase(rain{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"total\"}[365d])",
        "unit": "mm",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B365d%5D)&g0.tab=0&g0.range_input=365d"
    },
    "temperature_ext": {
        "query": "avg_over_time(temperature{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", location=\"toiture\", mode=\"actual\"}[10m])",
        "unit": "&deg;C",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22toiture%22%2C%20mode%3D%22actual%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "humidity_ext": {
        "query": "avg_over_time(humidity{group=\"thermo\", instance=\"home.972.ovh:35002\", job=\"raspi sensors\", location=\"exterieur\"}[10m])",
        "unit": "%",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=humidity%7Bgroup%3D%22thermo%22%2C%20instance%3D%22home.972.ovh%3A35002%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22exterieur%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "temperature_int": {
        "query": "avg_over_time(temperature{group=\"pac\", instance=\"home.972.ovh:35004\", job=\"raspi sensors\", location=\"pac_interieur\"}[10m])",
        "unit": "&deg;C",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22pac%22%2C%20instance%3D%22home.972.ovh%3A35004%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22pac_interieur%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "dew_point": {
        "query": "avg_over_time(temperature{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", location=\"toiture\", mode=\"dew_point\"}[10m])",
        "unit": "&deg;C",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22toiture%22%2C%20mode%3D%22dew_point%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "wind_speed": {
        "query": "max_over_time(wind{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"speed\"}[10m])",
        "unit": "km/h",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=max_over_time(wind%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22speed%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "wind_gust": {
        "query": "max_over_time(wind{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\", mode=\"gust\"}[10m])",
        "unit": "km/h",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=max_over_time(wind%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22gust%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "wind_dir": {
        "query": "avg_over_time(wind_dir{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\"}[10m])",
        "unit": "",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(wind_dir%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "pressure": {
        "query": "avg_over_time(pressure{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\"}[10m])",
        "unit": "hPa",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(pressure%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "sun_rad": {
        "query": "avg_over_time(sun_rad{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\"}[10m])",
        "unit": "J/m&sup2;",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=sun_rad%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "uv_idx": {
        "query": "avg_over_time(uv_idx{group=\"wundeground\", instance=\"home.972.ovh:35007\", job=\"raspi sensors\"}[10m])",
        "unit": "/11",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=uv_idx%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=10m"
    },
    "pm1": {
        "query": "avg_over_time(PM1{instance=\"home.972.ovh:35000\", job=\"raspi sensors\"}[10m])",
        "unit": "&micro;g/m&sup3;",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(PM1%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "pm25": {
        "query": "avg_over_time(PM25{instance=\"home.972.ovh:35000\", job=\"raspi sensors\"}[10m]) - avg_over_time(PM1{instance=\"home.972.ovh:35000\", job=\"raspi sensors\"}[10m])",
        "unit": "&micro;g/m&sup3;",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(PM25%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)%20-%20avg_over_time(PM1%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "pm10": {
        "query": "avg_over_time(PM10{instance=\"home.972.ovh:35000\", job=\"raspi sensors\"}[10m]) - avg_over_time(PM25{instance=\"home.972.ovh:35000\", job=\"raspi sensors\"}[10m])",
        "unit": "&micro;g/m&sup3;",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(PM10%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)%20-%20avg_over_time(PM25%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "river_lot": {
        "query": "avg_over_time(river_flow{name=\"Lot\"}[10m])",
        "unit": "m&sup3;/s",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(river_flow%7Bname%3D%22Lot%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    },
    "river_dordogne": {
        "query": "avg_over_time(river_flow{name=\"Dordogne\"}[10m])",
        "unit": "m&sup3;/s",
        "plot_url": "https://prometheus.972.ovh/graph?g0.expr=avg_over_time(river_flow%7Bname%3D%22Dordogne%22%7D%5B10m%5D)&g0.tab=0&g0.range_input=10m"
    }
};
var PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

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
    var query = METRICS[metricName].query;
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
                        if (metric.indexOf('rain_') === 0 || metric.indexOf('wind_') === 0 || metric.indexOf('river_') === 0 || metric === 'uv_idx' || metric.indexOf('pm') === 0 || metric.indexOf('temperature_') === 0 || metric.indexOf('humidity_') === 0) {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else if (metric === 'pressure') {
                            formattedValue = parseFloat(value).toFixed(0);
                        } else if (metric === 'sun_rad') {
                            formattedValue = parseFloat(value).toFixed(1);
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

                                                if (METRICS[metric].plot_url) {
                                                    var link = desktopElement.querySelector('a');
                                                    if (!link) {
                                                        link = document.createElement('a');
                                                        link.href = METRICS[metric].plot_url;
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
                    if (stat.min !== undefined) {
                        subtitleText += 'Min: ' + stat.min;
                    }
                    if (stat.max !== undefined) {
                        if (subtitleText) subtitleText += ' / ';
                        subtitleText += 'Max: ' + stat.max;
                    }
                    if (stat.unit) {
                        subtitleText += ' (' + stat.unit + ' 7j)';
                    }
                    subtitleElement.textContent = subtitleText;
                }
            }
        }
    }
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
}

main();
