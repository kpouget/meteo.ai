// Comparison page specific JavaScript

// Comparison mode state
var comparisonState = {
    stationA: null,
    stationB: null,
    duration: '48h',
    endDate: null // End date for the time period (timestamp in milliseconds)
};

// Comparison chart instances for cleanup
var comparisonChartInstances = {
    temperature: null,
    pressure: null,
    rain48h: null,
    rainCumul: null,
    solar: null,
    wind48h: null
};

// PROMETHEUS URL
var PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

// Duration helper function
function getDurationParams(duration) {
    var hours, step;
    switch (duration) {
        case '24h':
            hours = 24;
            step = 60 * 30; // 30 minutes
            break;
        case '48h':
            hours = 48;
            step = 60 * 30; // 30 minutes
            break;
        case '1week':
            hours = 24 * 7; // 1 week = 168 hours
            step = 60 * 60 * 2; // 2 hours for weekly view
            break;
        default:
            hours = 48;
            step = 60 * 30;
    }
    return {
        hours: hours,
        seconds: hours * 60 * 60,
        step: step
    };
}

function initializeComparison() {
    // Initialize comparison state from URL parameters or defaults
    var urlParams = new URLSearchParams(window.location.search);
    var stationA = urlParams.get('stationA') || 'cahors';
    var stationB = urlParams.get('stationB') || 'vayrac';
    var duration = urlParams.get('duration') || '48h';
    var endDate = urlParams.get('endDate');

    // Validate stations exist
    if (!STATIONS[stationA]) stationA = 'cahors';
    if (!STATIONS[stationB]) stationB = 'vayrac';
    if (stationA === stationB) stationB = (stationA === 'cahors') ? 'vayrac' : 'cahors';

    // Validate duration
    if (!['24h', '48h', '1week'].includes(duration)) duration = '48h';

    // Validate and set end date
    if (endDate && !isNaN(Date.parse(endDate))) {
        comparisonState.endDate = new Date(endDate).getTime();
    } else {
        // Default to now
        comparisonState.endDate = new Date().getTime();
    }

    comparisonState.stationA = stationA;
    comparisonState.stationB = stationB;
    comparisonState.duration = duration;

    // Populate station dropdowns
    populateComparisonDropdowns();

    // Setup event handlers
    setupComparisonEventHandlers();

    // Update comparison interface
    updateComparisonInterface();

    console.log('Comparaison initialisée:', comparisonState);
}

function populateComparisonDropdowns() {
    var dropdownA = document.getElementById('station-a-dropdown');
    var dropdownB = document.getElementById('station-b-dropdown');

    if (!dropdownA || !dropdownB) return;

    // Clear existing options except placeholder
    dropdownA.innerHTML = '<option value="">Sélectionner Station A</option>';
    dropdownB.innerHTML = '<option value="">Sélectionner Station B</option>';

    // Add station options (exclude special stations)
    for (var stationId in STATIONS) {
        var station = STATIONS[stationId];
        if (!station.special) {
            var optionA = document.createElement('option');
            optionA.value = stationId;
            optionA.textContent = station.name;
            dropdownA.appendChild(optionA);

            var optionB = document.createElement('option');
            optionB.value = stationId;
            optionB.textContent = station.name;
            dropdownB.appendChild(optionB);
        }
    }
}

function setupComparisonEventHandlers() {
    var dropdownA = document.getElementById('station-a-dropdown');
    var dropdownB = document.getElementById('station-b-dropdown');
    var durationDropdown = document.getElementById('duration-dropdown');
    var datePrevBtn = document.getElementById('date-prev');
    var dateNextBtn = document.getElementById('date-next');
    var dateTodayBtn = document.getElementById('date-today');
    var refreshBtn = document.getElementById('comparison-refresh');
    var backBtn = document.getElementById('back-to-main');

    if (dropdownA) {
        dropdownA.addEventListener('change', function() {
            if (this.value && this.value !== comparisonState.stationB) {
                comparisonState.stationA = this.value;
                updateComparisonURL();
                updateComparisonInterface();
            }
        });
    }

    if (dropdownB) {
        dropdownB.addEventListener('change', function() {
            if (this.value && this.value !== comparisonState.stationA) {
                comparisonState.stationB = this.value;
                updateComparisonURL();
                updateComparisonInterface();
            }
        });
    }

    if (durationDropdown) {
        durationDropdown.addEventListener('change', function() {
            if (this.value) {
                comparisonState.duration = this.value;
                updateComparisonURL();
                updateComparisonInterface();
            }
        });
    }

    if (datePrevBtn) {
        datePrevBtn.addEventListener('click', function() {
            navigateDate(-1);
        });
    }

    if (dateNextBtn) {
        dateNextBtn.addEventListener('click', function() {
            navigateDate(1);
        });
    }

    if (dateTodayBtn) {
        dateTodayBtn.addEventListener('click', function() {
            jumpToToday();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateComparisonInterface();
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }

    // Add escape key listener for fullscreen exit
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            var fullscreenChart = document.querySelector('.fullscreen-chart');
            if (fullscreenChart) {
                var btn = fullscreenChart.querySelector('.fullscreen-btn');
                if (btn) {
                    btn.click();
                }
            }
        }
    });
}

function updateComparisonURL() {
    var currentUrl = new URL(window.location);
    currentUrl.searchParams.set('stationA', comparisonState.stationA);
    currentUrl.searchParams.set('stationB', comparisonState.stationB);
    currentUrl.searchParams.set('duration', comparisonState.duration);
    currentUrl.searchParams.set('endDate', new Date(comparisonState.endDate).toISOString());
    window.history.replaceState({}, '', currentUrl.toString());
}

function navigateDate(direction) {
    var durationParams = getDurationParams(comparisonState.duration);
    var moveBy = durationParams.seconds * 1000; // Convert to milliseconds

    comparisonState.endDate += (direction * moveBy);

    updateComparisonURL();
    updateComparisonInterface();
}

function jumpToToday() {
    comparisonState.endDate = new Date().getTime();

    updateComparisonURL();
    updateComparisonInterface();
}

function toggleChartFullscreen(chartType, retryCount) {
    retryCount = retryCount || 0;

    var chartMapping = {
        'temperature': 'comparison-temperature-chart',
        'pressure': 'comparison-pressure-chart',
        'rain-intensity': 'comparison-rain-48h-chart',
        'rain-cumul': 'comparison-rain-cumul-chart',
        'solar': 'comparison-solar-48h-chart',
        'wind': 'comparison-wind-48h-chart'
    };

    var canvasId = chartMapping[chartType];
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // For nested charts (rain, solar, wind), we need the immediate parent div, not the outer chart-section
    var chartContainer;
    if (chartType === 'temperature' || chartType === 'pressure') {
        // These charts are directly in chart-section
        chartContainer = canvas.closest('.chart-section');
    } else {
        // All other charts (rain, solar, wind) are nested deeper - get the direct parent div
        chartContainer = canvas.parentElement;
    }

    if (!chartContainer) return;

    var isFullscreen = chartContainer.classList.contains('fullscreen-chart');

    if (isFullscreen) {
        // Exit fullscreen
        chartContainer.classList.remove('fullscreen-chart');

        // Update button text
        var btn = chartContainer.querySelector('.fullscreen-btn');
        if (btn) {
            btn.textContent = '⛶';
            btn.title = 'Plein écran';
        }
    } else {
        // Enter fullscreen
        chartContainer.classList.add('fullscreen-chart');

        // Update button text
        var btn = chartContainer.querySelector('.fullscreen-btn');
        if (btn) {
            btn.textContent = '✕';
            btn.title = 'Quitter le plein écran';
        }
    }

    // Force immediate resize by directly manipulating the canvas
    var chartInstance = getChartInstance(chartType);
    if (chartInstance) {
        // Check if chart has data loaded
        var hasData = chartInstance.data && chartInstance.data.datasets && chartInstance.data.datasets.length > 0;

        if (isFullscreen) {
            // Exiting fullscreen - reset to normal
            canvas.style.cssText = '';
            canvas.removeAttribute('width');
            canvas.removeAttribute('height');
            chartInstance.options.maintainAspectRatio = false;
            chartInstance.options.responsive = true;
            chartInstance.resize();
        } else {
            // Entering fullscreen
            if (!hasData && retryCount < 5) {
                // Chart doesn't have data yet, wait and try again (max 5 retries)
                setTimeout(function() {
                    toggleChartFullscreen(chartType, retryCount + 1);
                }, 500);
                return;
            }

            // Force full viewport dimensions
            var targetWidth = window.innerWidth - 20;
            var targetHeight = window.innerHeight - 60;

            // Force canvas size directly
            canvas.style.cssText = 'width: ' + targetWidth + 'px !important; height: ' + targetHeight + 'px !important;';
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // Update Chart.js options
            chartInstance.options.maintainAspectRatio = false;
            chartInstance.options.responsive = false; // Disable responsive to prevent conflicts

            // Force redraw with new size
            chartInstance.resize(targetWidth, targetHeight);
            chartInstance.render();
        }
    }
}

function getChartInstance(chartType) {
    switch (chartType) {
        case 'temperature':
            return comparisonChartInstances.temperature;
        case 'pressure':
            return comparisonChartInstances.pressure;
        case 'rain-intensity':
            return comparisonChartInstances.rain48h;
        case 'rain-cumul':
            return comparisonChartInstances.rainCumul;
        case 'solar':
            return comparisonChartInstances.solar;
        case 'wind':
            return comparisonChartInstances.wind48h;
        default:
            return null;
    }
}

function updateDateDisplay() {
    var dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        var endDate = new Date(comparisonState.endDate);
        var durationParams = getDurationParams(comparisonState.duration);
        var startDate = new Date(comparisonState.endDate - durationParams.seconds * 1000);

        // Format as YY-MM-DD
        var startStr = formatDateYYMMDD(startDate);

        dateDisplay.textContent = startStr;
    }
}

function formatDateYYMMDD(date) {
    var year = date.getFullYear().toString().substr(-2);
    var month = (date.getMonth() + 1).toString().padStart(2, '0');
    var day = date.getDate().toString().padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function updateComparisonInterface() {
    // Update dropdown selections
    var dropdownA = document.getElementById('station-a-dropdown');
    var dropdownB = document.getElementById('station-b-dropdown');
    var durationDropdown = document.getElementById('duration-dropdown');

    if (dropdownA) dropdownA.value = comparisonState.stationA;
    if (dropdownB) dropdownB.value = comparisonState.stationB;
    if (durationDropdown) durationDropdown.value = comparisonState.duration;

    // Update date display
    updateDateDisplay();

    // Get station names for display
    var stationAName = STATIONS[comparisonState.stationA].name;
    var stationBName = STATIONS[comparisonState.stationB].name;

    // Update chart titles based on duration
    updateChartTitles();

    console.log('Mise à jour comparaison pour', stationAName, 'vs', stationBName);

    // Update comparison charts (focus on historical data)
    updateComparisonCharts();
}

function updateChartTitles() {
    var durationText = comparisonState.duration === '1week' ? '(7j)' : '(' + comparisonState.duration + ')';

    var tempTitle = document.getElementById('temperature-chart-title');
    var pressureTitle = document.getElementById('pressure-chart-title');
    var rainIntensityTitle = document.getElementById('rain-intensity-chart-title');
    var rainCumulTitle = document.getElementById('rain-cumul-chart-title');
    var solarTitle = document.getElementById('solar-chart-title');
    var windTitle = document.getElementById('wind-chart-title');

    if (tempTitle) tempTitle.textContent = 'Évolution de la Température ' + durationText;
    if (pressureTitle) pressureTitle.textContent = 'Évolution de la Pression ' + durationText;
    if (rainIntensityTitle) rainIntensityTitle.textContent = 'Force de la Pluie ' + durationText;
    if (rainCumulTitle) rainCumulTitle.textContent = 'Cumul Pluie ' + durationText;
    if (solarTitle) solarTitle.textContent = 'Évolution du Rayonnement Solaire ' + durationText;
    if (windTitle) windTitle.textContent = 'Évolution du Vent ' + durationText;
}

function updateComparisonCharts() {
    // Update comparison summary
    updateComparisonSummary();

    // Render temperature comparison chart
    fetchTemperatureDataComparison(function(combinedData) {
        if (combinedData) {
            renderTemperatureComparisonChart(combinedData);
        }
    });

    // Render pressure comparison chart
    fetchPressureDataComparison(function(combinedData) {
        if (combinedData) {
            renderPressureComparisonChart(combinedData);
        }
    });

    // Render current rain data comparisons
    renderRainDataComparison();

    // Render UV and solar radiation comparison
    renderUVAndSolarComparison();

    // Render wind data comparison
    renderWindDataComparison();
}

function updateComparisonSummary() {
    var summaryContainer = document.getElementById('comparison-summary');
    if (!summaryContainer) return;

    var stationA = STATIONS[comparisonState.stationA];
    var stationB = STATIONS[comparisonState.stationB];

    summaryContainer.innerHTML =
        '<div style="text-align: center; padding: 20px; background: #e8f4f8; border-radius: 8px; margin-bottom: 20px;">' +
            '<h3 style="margin: 0 0 10px 0; color: #2c5aa0;">Vue d\'ensemble de la Comparaison</h3>' +
            '<div style="display: flex; justify-content: center; gap: 40px; flex-wrap: wrap;">' +
                '<div><strong style="color: #1976d2;">' + stationA.name + '</strong> (' + stationA.station_id + ')</div>' +
                '<div style="font-size: 1.5em;">🆚</div>' +
                '<div><strong style="color: #f57c00;">' + stationB.name + '</strong> (' + stationB.station_id + ')</div>' +
            '</div>' +
            '<p style="margin: 10px 0 0 0; color: #666; font-size: 0.9em;">Comparaison des modèles et tendances météorologiques historiques</p>' +
        '</div>';
}

// Dual station data fetching for time series
function fetchTemperatureDataComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, data: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, data: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(combinedData);
        }
    }

    // Fetch data for station A
    fetchTemperatureDataForStation(comparisonState.stationA, function(data) {
        combinedData.stationA.data = data;
        handleResult();
    });

    // Fetch data for station B
    fetchTemperatureDataForStation(comparisonState.stationB, function(data) {
        combinedData.stationB.data = data;
        handleResult();
    });
}

function fetchPressureDataComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, data: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, data: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(combinedData);
        }
    }

    // Fetch data for station A
    fetchPressureDataForStation(comparisonState.stationA, function(data) {
        combinedData.stationA.data = data;
        handleResult();
    });

    // Fetch data for station B
    fetchPressureDataForStation(comparisonState.stationB, function(data) {
        combinedData.stationB.data = data;
        handleResult();
    });
}

function fetchTemperatureDataForStation(stationId, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    var step = durationParams.step;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build temperature query for specific station
    var temperatureQuery = 'avg_over_time(temperature{job="internet scraping", mode="actual", station_id="' + station.station_id + '"}[10m])';

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
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de température:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de température:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchPressureDataForStation(stationId, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    var step = durationParams.step;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build pressure query for specific station
    var pressureQuery = 'avg_over_time(pressure{job="internet scraping", station_id="' + station.station_id + '"}[10m])';

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
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de pression:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de pression:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function renderTemperatureComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.temperature) {
        comparisonChartInstances.temperature.destroy();
        comparisonChartInstances.temperature = null;
    }

    var canvas = document.getElementById('comparison-temperature-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A data if available
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        var valuesA = combinedData.stationA.data.map(function(point) {
            return point.temperature;
        });

        datasets.push({
            label: combinedData.stationA.name + ' (°C)',
            data: valuesA,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10
        });
    }

    // Add station B data if available
    if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        var valuesB = combinedData.stationB.data.map(function(point) {
            return point.temperature;
        });

        datasets.push({
            label: combinedData.stationB.name + ' (°C)',
            data: valuesB,
            borderColor: '#f57c00',
            backgroundColor: 'rgba(245, 124, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10
        });
    }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        labels = combinedData.stationA.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    } else if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        labels = combinedData.stationB.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    }

    comparisonChartInstances.temperature = new Chart(ctx, {
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Température (°C)'
                    }
                }
            }
        }
    });
}

function renderPressureComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.pressure) {
        comparisonChartInstances.pressure.destroy();
        comparisonChartInstances.pressure = null;
    }

    var canvas = document.getElementById('comparison-pressure-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A data if available
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        var valuesA = combinedData.stationA.data.map(function(point) {
            return point.pressure;
        });

        datasets.push({
            label: combinedData.stationA.name + ' (hPa)',
            data: valuesA,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10
        });
    }

    // Add station B data if available
    if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        var valuesB = combinedData.stationB.data.map(function(point) {
            return point.pressure;
        });

        datasets.push({
            label: combinedData.stationB.name + ' (hPa)',
            data: valuesB,
            borderColor: '#f57c00',
            backgroundColor: 'rgba(245, 124, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10
        });
    }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        labels = combinedData.stationA.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    } else if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        labels = combinedData.stationB.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    }

    comparisonChartInstances.pressure = new Chart(ctx, {
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Pression (hPa)'
                    }
                }
            }
        }
    });
}

function renderRainDataComparison() {
    // Fetch and display current rain total (cumulative)
    fetchRainTotalComparison(function(rainTotalData) {
        updateRainTotalDisplay(rainTotalData);
    });

    // Fetch and display rain intensity evolution
    fetchRain48hComparison(function(combinedData) {
        if (combinedData) {
            renderRain48hComparisonChart(combinedData);
        }
    });

    // Fetch and display cumulative rain evolution
    fetchRainCumulComparison(function(combinedData) {
        if (combinedData) {
            renderRainCumulComparisonChart(combinedData);
        }
    });
}

function fetchRainTotalComparison(callback) {
    var completedFetches = 0;
    var rainTotalData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, value: null, unit: 'mm' },
        stationB: { name: STATIONS[comparisonState.stationB].name, value: null, unit: 'mm' }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(rainTotalData);
        }
    }

    // Fetch rain total for station A
    fetchRainTotalForStation(comparisonState.stationA, function(value) {
        rainTotalData.stationA.value = value;
        handleResult();
    });

    // Fetch rain total for station B
    fetchRainTotalForStation(comparisonState.stationB, function(value) {
        rainTotalData.stationB.value = value;
        handleResult();
    });
}

function fetchRainTotalForStation(stationId, callback) {
    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Calculate start and end times for the period
    var durationParams = getDurationParams(comparisonState.duration);
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000;
    var end = start + durationParams.seconds;

    // Build rain total query using time range instead of duration
    var rainTotalQuery = 'increase(rain{job="internet scraping", mode="total", station_id="' + station.station_id + '"}[' + durationParams.hours + 'h])';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PROMETHEUS_URL + '?query=' + encodeURIComponent(rainTotalQuery) + '&time=' + end, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var value = Math.max(0, parseFloat(data.data.result[0].value[1])); // Ensure non-negative
                        callback(value);
                    } else {
                        callback(0);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de cumul de pluie:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de cumul de pluie:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchRain48hComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, data: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, data: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(combinedData);
        }
    }

    // Fetch 48h rain data for station A
    fetchRain48hForStation(comparisonState.stationA, function(data) {
        combinedData.stationA.data = data;
        handleResult();
    });

    // Fetch 48h rain data for station B
    fetchRain48hForStation(comparisonState.stationB, function(data) {
        combinedData.stationB.data = data;
        handleResult();
    });
}

function fetchRain48hForStation(stationId, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    // Use 1 hour steps for 24h/48h, 4 hour steps for 1 week
    var step = (comparisonState.duration === '1week') ? 60 * 60 * 4 : 60 * 60;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build rain intensity query - use rate to get rain intensity (mm/h)
    var rainQuery = 'avg_over_time(rain{job="internet scraping", mode="rate", station_id="' + station.station_id + '"}[10m])';

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(rainQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var rainData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                rain: Math.max(0, parseFloat(point[1])) // Ensure non-negative values
                            };
                        });
                        callback(rainData);
                    } else {
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de pluie 48h:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de pluie 48h:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function updateRainTotalDisplay(rainTotalData) {
    var stationADiv = document.getElementById('rain-total-a');
    var stationBDiv = document.getElementById('rain-total-b');

    if (stationADiv) {
        var nameElement = stationADiv.querySelector('.station-name');
        var valueElement = stationADiv.querySelector('.metric-value');

        nameElement.textContent = rainTotalData.stationA.name;
        if (rainTotalData.stationA.value !== null) {
            valueElement.textContent = rainTotalData.stationA.value.toFixed(1) + ' mm';
        } else {
            valueElement.textContent = '-- mm';
        }
    }

    if (stationBDiv) {
        var nameElement = stationBDiv.querySelector('.station-name');
        var valueElement = stationBDiv.querySelector('.metric-value');

        nameElement.textContent = rainTotalData.stationB.name;
        if (rainTotalData.stationB.value !== null) {
            valueElement.textContent = rainTotalData.stationB.value.toFixed(1) + ' mm';
        } else {
            valueElement.textContent = '-- mm';
        }
    }
}

function renderRain48hComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.rain48h) {
        comparisonChartInstances.rain48h.destroy();
        comparisonChartInstances.rain48h = null;
    }

    var canvas = document.getElementById('comparison-rain-48h-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A rain data if available
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        var valuesA = combinedData.stationA.data.map(function(point) {
            return point.rain;
        });

        datasets.push({
            label: combinedData.stationA.name + ' (mm/h)',
            data: valuesA,
            backgroundColor: 'rgba(25, 118, 210, 0.6)',
            borderColor: '#1976d2',
            borderWidth: 1,
            type: 'bar'
        });
    }

    // Add station B rain data if available
    if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        var valuesB = combinedData.stationB.data.map(function(point) {
            return point.rain;
        });

        datasets.push({
            label: combinedData.stationB.name + ' (mm/h)',
            data: valuesB,
            backgroundColor: 'rgba(245, 124, 0, 0.6)',
            borderColor: '#f57c00',
            borderWidth: 1,
            type: 'bar'
        });
    }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        labels = combinedData.stationA.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit' });
        });
    } else if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        labels = combinedData.stationB.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit' });
        });
    }

    comparisonChartInstances.rain48h = new Chart(ctx, {
        type: 'bar',
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Force de la Pluie (mm/h)'
                    }
                }
            }
        }
    });
}

function fetchRainCumulComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, data: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, data: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(combinedData);
        }
    }

    // Fetch cumulative rain data for station A
    fetchRainCumulForStation(comparisonState.stationA, function(data) {
        combinedData.stationA.data = data;
        handleResult();
    });

    // Fetch cumulative rain data for station B
    fetchRainCumulForStation(comparisonState.stationB, function(data) {
        combinedData.stationB.data = data;
        handleResult();
    });
}

function fetchRainCumulForStation(stationId, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    var step = durationParams.step;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build cumulative rain query - use deriv to get cumulative rainfall over time
    var rainQuery = 'rain{job="internet scraping", mode="total", station_id="' + station.station_id + '"}';

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(rainQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;

                        // Calculate cumulative rain from the start point
                        var startValue = parseFloat(values[0][1]);
                        var rainData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                rain: Math.max(0, parseFloat(point[1]) - startValue) // Cumulative from start
                            };
                        });
                        callback(rainData);
                    } else {
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de cumul de pluie:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de cumul de pluie:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function renderRainCumulComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.rainCumul) {
        comparisonChartInstances.rainCumul.destroy();
        comparisonChartInstances.rainCumul = null;
    }

    var canvas = document.getElementById('comparison-rain-cumul-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A cumulative rain data if available
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        var valuesA = combinedData.stationA.data.map(function(point) {
            return point.rain;
        });

        datasets.push({
            label: combinedData.stationA.name + ' (mm)',
            data: valuesA,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Add station B cumulative rain data if available
    if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        var valuesB = combinedData.stationB.data.map(function(point) {
            return point.rain;
        });

        datasets.push({
            label: combinedData.stationB.name + ' (mm)',
            data: valuesB,
            borderColor: '#f57c00',
            backgroundColor: 'rgba(245, 124, 0, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        labels = combinedData.stationA.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    } else if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        labels = combinedData.stationB.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    }

    comparisonChartInstances.rainCumul = new Chart(ctx, {
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cumul de Pluie (mm)'
                    }
                }
            }
        }
    });
}

function renderUVAndSolarComparison() {
    // Fetch and display current solar radiation
    fetchSolarRadiationComparison(function(solarData) {
        updateSolarRadiationDisplay(solarData);
    });

    // Fetch and display current UV index
    fetchUVIndexComparison(function(uvData) {
        updateUVIndexDisplay(uvData);
    });

    // Fetch and display 48h solar radiation evolution
    fetchSolar48hComparison(function(combinedData) {
        if (combinedData) {
            renderSolar48hComparisonChart(combinedData);
        }
    });
}

function fetchSolarRadiationComparison(callback) {
    var completedFetches = 0;
    var solarData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, value: null, unit: 'J/m²' },
        stationB: { name: STATIONS[comparisonState.stationB].name, value: null, unit: 'J/m²' }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(solarData);
        }
    }

    // Fetch solar radiation for station A
    fetchSolarRadiationForStation(comparisonState.stationA, function(value) {
        solarData.stationA.value = value;
        handleResult();
    });

    // Fetch solar radiation for station B
    fetchSolarRadiationForStation(comparisonState.stationB, function(value) {
        solarData.stationB.value = value;
        handleResult();
    });
}

function fetchUVIndexComparison(callback) {
    var completedFetches = 0;
    var uvData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, value: null, unit: 'UV' },
        stationB: { name: STATIONS[comparisonState.stationB].name, value: null, unit: 'UV' }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(uvData);
        }
    }

    // Fetch UV index for station A
    fetchUVIndexForStation(comparisonState.stationA, function(value) {
        uvData.stationA.value = value;
        handleResult();
    });

    // Fetch UV index for station B
    fetchUVIndexForStation(comparisonState.stationB, function(value) {
        uvData.stationB.value = value;
        handleResult();
    });
}

function fetchSolarRadiationForStation(stationId, callback) {
    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build solar radiation query for specific station
    var solarQuery = 'avg_over_time(sun_rad{job="internet scraping", station_id="' + station.station_id + '"}[10m])';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PROMETHEUS_URL + '?query=' + encodeURIComponent(solarQuery), true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var value = parseFloat(data.data.result[0].value[1]);
                        callback(value);
                    } else {
                        callback(0);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de rayonnement solaire:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de rayonnement solaire:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchUVIndexForStation(stationId, callback) {
    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build UV index query for specific station
    var uvQuery = 'avg_over_time(uv_idx{job="internet scraping", station_id="' + station.station_id + '"}[10m])';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PROMETHEUS_URL + '?query=' + encodeURIComponent(uvQuery), true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var value = parseFloat(data.data.result[0].value[1]);
                        callback(value);
                    } else {
                        callback(0);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données UV:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données UV:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchSolar48hComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, data: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, data: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(combinedData);
        }
    }

    // Fetch 48h solar data for station A
    fetchSolar48hForStation(comparisonState.stationA, function(data) {
        combinedData.stationA.data = data;
        handleResult();
    });

    // Fetch 48h solar data for station B
    fetchSolar48hForStation(comparisonState.stationB, function(data) {
        combinedData.stationB.data = data;
        handleResult();
    });
}

function fetchSolar48hForStation(stationId, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    var step = durationParams.step;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build 48h solar radiation query
    var solarQuery = 'avg_over_time(sun_rad{job="internet scraping", station_id="' + station.station_id + '"}[10m])';

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(solarQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var solarData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                solar: Math.max(0, parseFloat(point[1])) // Ensure non-negative values
                            };
                        });
                        callback(solarData);
                    } else {
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données solaires 48h:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données solaires 48h:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function updateSolarRadiationDisplay(solarData) {
    var stationADiv = document.getElementById('solar-rad-a');
    var stationBDiv = document.getElementById('solar-rad-b');

    if (stationADiv) {
        var nameElement = stationADiv.querySelector('.station-name');
        var valueElement = stationADiv.querySelector('.metric-value');

        nameElement.textContent = solarData.stationA.name;
        if (solarData.stationA.value !== null) {
            valueElement.textContent = solarData.stationA.value.toFixed(1) + ' J/m²';
        } else {
            valueElement.textContent = '-- J/m²';
        }
    }

    if (stationBDiv) {
        var nameElement = stationBDiv.querySelector('.station-name');
        var valueElement = stationBDiv.querySelector('.metric-value');

        nameElement.textContent = solarData.stationB.name;
        if (solarData.stationB.value !== null) {
            valueElement.textContent = solarData.stationB.value.toFixed(1) + ' J/m²';
        } else {
            valueElement.textContent = '-- J/m²';
        }
    }
}

function updateUVIndexDisplay(uvData) {
    var stationADiv = document.getElementById('uv-index-a');
    var stationBDiv = document.getElementById('uv-index-b');

    if (stationADiv) {
        var nameElement = stationADiv.querySelector('.station-name');
        var valueElement = stationADiv.querySelector('.metric-value');

        nameElement.textContent = uvData.stationA.name;
        if (uvData.stationA.value !== null) {
            valueElement.textContent = uvData.stationA.value.toFixed(1) + ' UV';
        } else {
            valueElement.textContent = '-- UV';
        }
    }

    if (stationBDiv) {
        var nameElement = stationBDiv.querySelector('.station-name');
        var valueElement = stationBDiv.querySelector('.metric-value');

        nameElement.textContent = uvData.stationB.name;
        if (uvData.stationB.value !== null) {
            valueElement.textContent = uvData.stationB.value.toFixed(1) + ' UV';
        } else {
            valueElement.textContent = '-- UV';
        }
    }
}

function renderSolar48hComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.solar) {
        comparisonChartInstances.solar.destroy();
        comparisonChartInstances.solar = null;
    }

    var canvas = document.getElementById('comparison-solar-48h-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A solar data if available
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        var valuesA = combinedData.stationA.data.map(function(point) {
            return point.solar;
        });

        datasets.push({
            label: combinedData.stationA.name + ' (J/m²)',
            data: valuesA,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Add station B solar data if available
    if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        var valuesB = combinedData.stationB.data.map(function(point) {
            return point.solar;
        });

        datasets.push({
            label: combinedData.stationB.name + ' (J/m²)',
            data: valuesB,
            borderColor: '#f57c00',
            backgroundColor: 'rgba(245, 124, 0, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.data && combinedData.stationA.data.length > 0) {
        labels = combinedData.stationA.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    } else if (combinedData.stationB.data && combinedData.stationB.data.length > 0) {
        labels = combinedData.stationB.data.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    }

    comparisonChartInstances.solar = new Chart(ctx, {
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Rayonnement Solaire (J/m²)'
                    }
                }
            }
        }
    });
}

function renderWindDataComparison() {
    // Fetch and display current wind speed
    fetchWindSpeedComparison(function(windSpeedData) {
        updateWindSpeedDisplay(windSpeedData);
    });

    // Fetch and display current wind gust
    fetchWindGustComparison(function(windGustData) {
        updateWindGustDisplay(windGustData);
    });

    // Fetch and display 48h wind evolution
    fetchWind48hComparison(function(combinedData) {
        if (combinedData) {
            renderWind48hComparisonChart(combinedData);
        }
    });
}

function fetchWindSpeedComparison(callback) {
    var completedFetches = 0;
    var windSpeedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, value: null, unit: 'km/h' },
        stationB: { name: STATIONS[comparisonState.stationB].name, value: null, unit: 'km/h' }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(windSpeedData);
        }
    }

    // Fetch wind speed for station A
    fetchWindSpeedForStation(comparisonState.stationA, function(value) {
        windSpeedData.stationA.value = value;
        handleResult();
    });

    // Fetch wind speed for station B
    fetchWindSpeedForStation(comparisonState.stationB, function(value) {
        windSpeedData.stationB.value = value;
        handleResult();
    });
}

function fetchWindGustComparison(callback) {
    var completedFetches = 0;
    var windGustData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, value: null, unit: 'km/h' },
        stationB: { name: STATIONS[comparisonState.stationB].name, value: null, unit: 'km/h' }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) {
            callback(windGustData);
        }
    }

    // Fetch wind gust for station A
    fetchWindGustForStation(comparisonState.stationA, function(value) {
        windGustData.stationA.value = value;
        handleResult();
    });

    // Fetch wind gust for station B
    fetchWindGustForStation(comparisonState.stationB, function(value) {
        windGustData.stationB.value = value;
        handleResult();
    });
}

function fetchWindSpeedForStation(stationId, callback) {
    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build wind speed query for specific station
    var windSpeedQuery = 'avg_over_time(wind{job="internet scraping", mode="speed", station_id="' + station.station_id + '"}[10m])';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PROMETHEUS_URL + '?query=' + encodeURIComponent(windSpeedQuery), true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var value = parseFloat(data.data.result[0].value[1]);
                        callback(value);
                    } else {
                        callback(0);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de vitesse du vent:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de vitesse du vent:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchWindGustForStation(stationId, callback) {
    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build wind gust query for specific station
    var windGustQuery = 'avg_over_time(wind{job="internet scraping", mode="gust", station_id="' + station.station_id + '"}[10m])';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', PROMETHEUS_URL + '?query=' + encodeURIComponent(windGustQuery), true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var value = parseFloat(data.data.result[0].value[1]);
                        callback(value);
                    } else {
                        callback(0);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de rafales:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de rafales:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function fetchWind48hComparison(callback) {
    var completedFetches = 0;
    var combinedData = {
        stationA: { name: STATIONS[comparisonState.stationA].name, speedData: null },
        stationB: { name: STATIONS[comparisonState.stationB].name, speedData: null }
    };

    function handleResult() {
        completedFetches++;
        if (completedFetches >= 2) { // Only fetch speed data for both stations
            callback(combinedData);
        }
    }

    // Fetch 48h wind speed data for station A
    fetchWind48hForStation(comparisonState.stationA, 'speed', function(data) {
        combinedData.stationA.speedData = data;
        handleResult();
    });

    // Fetch 48h wind speed data for station B
    fetchWind48hForStation(comparisonState.stationB, 'speed', function(data) {
        combinedData.stationB.speedData = data;
        handleResult();
    });
}

function fetchWind48hForStation(stationId, mode, callback) {
    var durationParams = getDurationParams(comparisonState.duration);

    // Calculate start of day for the target date
    var targetDate = new Date(comparisonState.endDate);
    var startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

    var start = startOfDay.getTime() / 1000; // Convert to seconds
    var end = start + durationParams.seconds; // Add duration to start of day
    var step = durationParams.step;

    var station = STATIONS[stationId];
    if (!station) {
        callback(null);
        return;
    }

    // Build 48h wind query (speed or gust)
    var windQuery = 'avg_over_time(wind{job="internet scraping", mode="' + mode + '", station_id="' + station.station_id + '"}[10m])';

    var url = PROMETHEUS_URL.replace('/query', '/query_range') + '?query=' + encodeURIComponent(windQuery) + '&start=' + start + '&end=' + end + '&step=' + step;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.status === 'success' && data.data.result.length > 0) {
                        var values = data.data.result[0].values;
                        var windData = values.map(function(point) {
                            return {
                                time: point[0] * 1000, // Convert to milliseconds
                                wind: Math.max(0, parseFloat(point[1])) // Ensure non-negative values
                            };
                        });
                        callback(windData);
                    } else {
                        callback(null);
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse des données de vent 48h:', e);
                    callback(null);
                }
            } else {
                console.error('Erreur lors de la récupération des données de vent 48h:', xhr.status);
                callback(null);
            }
        }
    };
    xhr.send();
}

function updateWindSpeedDisplay(windSpeedData) {
    var stationADiv = document.getElementById('wind-speed-a');
    var stationBDiv = document.getElementById('wind-speed-b');

    if (stationADiv) {
        var nameElement = stationADiv.querySelector('.station-name');
        var valueElement = stationADiv.querySelector('.metric-value');

        nameElement.textContent = windSpeedData.stationA.name;
        if (windSpeedData.stationA.value !== null) {
            valueElement.textContent = windSpeedData.stationA.value.toFixed(1) + ' km/h';
        } else {
            valueElement.textContent = '-- km/h';
        }
    }

    if (stationBDiv) {
        var nameElement = stationBDiv.querySelector('.station-name');
        var valueElement = stationBDiv.querySelector('.metric-value');

        nameElement.textContent = windSpeedData.stationB.name;
        if (windSpeedData.stationB.value !== null) {
            valueElement.textContent = windSpeedData.stationB.value.toFixed(1) + ' km/h';
        } else {
            valueElement.textContent = '-- km/h';
        }
    }
}

function updateWindGustDisplay(windGustData) {
    var stationADiv = document.getElementById('wind-gust-a');
    var stationBDiv = document.getElementById('wind-gust-b');

    if (stationADiv) {
        var nameElement = stationADiv.querySelector('.station-name');
        var valueElement = stationADiv.querySelector('.metric-value');

        nameElement.textContent = windGustData.stationA.name;
        if (windGustData.stationA.value !== null) {
            valueElement.textContent = windGustData.stationA.value.toFixed(1) + ' km/h';
        } else {
            valueElement.textContent = '-- km/h';
        }
    }

    if (stationBDiv) {
        var nameElement = stationBDiv.querySelector('.station-name');
        var valueElement = stationBDiv.querySelector('.metric-value');

        nameElement.textContent = windGustData.stationB.name;
        if (windGustData.stationB.value !== null) {
            valueElement.textContent = windGustData.stationB.value.toFixed(1) + ' km/h';
        } else {
            valueElement.textContent = '-- km/h';
        }
    }
}

function renderWind48hComparisonChart(combinedData) {
    // Destroy existing chart if it exists
    if (comparisonChartInstances.wind48h) {
        comparisonChartInstances.wind48h.destroy();
        comparisonChartInstances.wind48h = null;
    }

    var canvas = document.getElementById('comparison-wind-48h-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var datasets = [];

    // Add station A wind speed data if available
    if (combinedData.stationA.speedData && combinedData.stationA.speedData.length > 0) {
        var speedValuesA = combinedData.stationA.speedData.map(function(point) {
            return point.wind;
        });

        datasets.push({
            label: combinedData.stationA.name + ' - Vitesse (km/h)',
            data: speedValuesA,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Add station A wind gust data if available (hidden by default)
    // if (combinedData.stationA.gustData && combinedData.stationA.gustData.length > 0) {
    //     var gustValuesA = combinedData.stationA.gustData.map(function(point) {
    //         return point.wind;
    //     });

    //     datasets.push({
    //         label: combinedData.stationA.name + ' - Rafales (km/h)',
    //         data: gustValuesA,
    //         borderColor: '#1976d2',
    //         backgroundColor: 'rgba(25, 118, 210, 0.2)',
    //         borderWidth: 1,
    //         borderDash: [5, 5],
    //         fill: false,
    //         tension: 0.3,
    //         pointRadius: 0,
    //         pointHoverRadius: 4
    //     });
    // }

    // Add station B wind speed data if available
    if (combinedData.stationB.speedData && combinedData.stationB.speedData.length > 0) {
        var speedValuesB = combinedData.stationB.speedData.map(function(point) {
            return point.wind;
        });

        datasets.push({
            label: combinedData.stationB.name + ' - Vitesse (km/h)',
            data: speedValuesB,
            borderColor: '#f57c00',
            backgroundColor: 'rgba(245, 124, 0, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    // Add station B wind gust data if available (hidden by default)
    // if (combinedData.stationB.gustData && combinedData.stationB.gustData.length > 0) {
    //     var gustValuesB = combinedData.stationB.gustData.map(function(point) {
    //         return point.wind;
    //     });

    //     datasets.push({
    //         label: combinedData.stationB.name + ' - Rafales (km/h)',
    //         data: gustValuesB,
    //         borderColor: '#f57c00',
    //         backgroundColor: 'rgba(245, 124, 0, 0.2)',
    //         borderWidth: 1,
    //         borderDash: [5, 5],
    //         fill: false,
    //         tension: 0.3,
    //         pointRadius: 0,
    //         pointHoverRadius: 4
    //     });
    // }

    // Use labels from the first available dataset
    var labels = [];
    if (combinedData.stationA.speedData && combinedData.stationA.speedData.length > 0) {
        labels = combinedData.stationA.speedData.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    } else if (combinedData.stationB.speedData && combinedData.stationB.speedData.length > 0) {
        labels = combinedData.stationB.speedData.map(function(point) {
            var date = new Date(point.time);
            return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        });
    }

    comparisonChartInstances.wind48h = new Chart(ctx, {
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Vitesse du Vent (km/h)'
                    }
                }
            }
        }
    });
}

// Load statistics and run comparison main function
function loadStatsAndRunComparison() {
    var script = document.createElement('script');
    var date = new Date();
    var timestamp = '' + date.getFullYear() + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
    script.src = 'stats.js?v=' + timestamp;
    script.onload = initializeComparison;
    document.head.appendChild(script);
}

// Initialize comparison when page loads
window.addEventListener('load', loadStatsAndRunComparison);