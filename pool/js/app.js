const PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';
const PROMETHEUS_RANGE_URL = 'https://prometheus.972.ovh/api/v1/query_range';

// Temperature thresholds for color coding
const TEMP_THRESHOLDS = {
    cold: 18,
    cool: 22,
    warm: 26,
    hot: 30
};

function getPoolTempColor(temp) {
    if (temp < TEMP_THRESHOLDS.cold) return 'var(--pool-cold)';
    if (temp < TEMP_THRESHOLDS.cool) return 'var(--pool-cool)';
    if (temp < TEMP_THRESHOLDS.warm) return 'var(--pool-warm)';
    if (temp < TEMP_THRESHOLDS.hot) return 'var(--pool-hot)';
    return 'var(--pool-very-hot)';
}

function updatePoolTempColor(temp) {
    const color = getPoolTempColor(temp);
    const poolCard = document.querySelector('.pool-temp');
    poolCard.style.setProperty('--current-pool-color', color);

    const tempValue = document.getElementById('pool-temp');
    tempValue.style.color = color;
}

function formatAge(ageSeconds) {
    if (ageSeconds < 60) {
        return 'il y a ' + ageSeconds + 's';
    } else if (ageSeconds < 3600) {
        var minutes = Math.floor(ageSeconds / 60);
        return 'il y a ' + minutes + 'min';
    } else if (ageSeconds < 86400) {
        var hours = Math.floor(ageSeconds / 3600);
        var remainingMinutes = Math.floor((ageSeconds % 3600) / 60);
        var ageText = 'il y a ' + hours + 'h';
        if (remainingMinutes > 0) {
            ageText += ' ' + remainingMinutes + 'min';
        }
        return ageText;
    } else {
        var days = Math.floor(ageSeconds / 86400);
        return 'il y a ' + days + 'j';
    }
}

async function fetchInkbirdAge() {
    try {
        const query = 'inkbird_last_seen_timestamp{group="inkbird", job="raspi sensors"}';
        const response = await fetch(`${PROMETHEUS_URL}?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.status === 'success' && data.data.result.length > 0) {
            const timestamp = parseFloat(data.data.result[0].value[1]);
            const now = Date.now() / 1000;
            const ageSeconds = Math.floor(now - timestamp);
            return formatAge(ageSeconds);
        }
        return null;
    } catch (error) {
        console.error('Error fetching inkbird age:', error);
        return null;
    }
}

async function fetchCurrentTemperature(metric) {
    try {
        let query;
        if (metric === 'pool') {
            query = 'avg_over_time(inkbird_temperature_celsius{group="inkbird", job="raspi sensors"}[10m])';
        } else {
            query = 'avg_over_time(temperature{instance="wunderground.972.ovh:443", job="internet scraping", mode="actual", station_id="ICAHOR23"}[10m])';
        }

        const response = await fetch(`${PROMETHEUS_URL}?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.status === 'success' && data.data.result.length > 0) {
            return parseFloat(data.data.result[0].value[1]);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching ${metric} temperature:`, error);
        return null;
    }
}

async function fetchDailyExtremes(dayOffset = 0) {
    try {
        const now = new Date();
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - dayOffset);

        // Get start and end of the target day in UTC
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const startTime = Math.floor(startOfDay.getTime() / 1000);
        const endTime = Math.floor(endOfDay.getTime() / 1000);

        console.log(`Fetching extremes for ${dayOffset === 0 ? 'today' : 'yesterday'}: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

        const poolQuery = 'inkbird_temperature_celsius{group="inkbird", job="raspi sensors"}';

        // For timestamps, we need to query the raw data and find when min/max occurred
        const rangeResponse = await fetch(`${PROMETHEUS_RANGE_URL}?query=${encodeURIComponent(poolQuery)}&start=${startTime}&end=${endTime}&step=600`);
        const rangeData = await rangeResponse.json();

        let minValue = null, maxValue = null, minTime = null, maxTime = null;

        // Find the timestamps when min/max occurred
        if (rangeData.status === 'success' && rangeData.data.result.length > 0) {
            const values = rangeData.data.result[0].values;
            let minTemp = Infinity, maxTemp = -Infinity;

            values.forEach(([timestamp, value]) => {
                const temp = parseFloat(value);
                if (temp <= minTemp) {
                    minTemp = temp;
                    minTime = timestamp * 1000; // Convert to milliseconds
                }
                if (temp >= maxTemp) {
                    maxTemp = temp;
                    maxTime = timestamp * 1000; // Convert to milliseconds
                }
            });

            if (minTemp !== Infinity) minValue = minTemp;
            if (maxTemp !== -Infinity) maxValue = maxTemp;
        }

        return {
            min: { value: minValue, timestamp: minTime },
            max: { value: maxValue, timestamp: maxTime }
        };
    } catch (error) {
        console.error(`Error fetching daily extremes for day offset ${dayOffset}:`, error);
        return {
            min: { value: null, timestamp: null },
            max: { value: null, timestamp: null }
        };
    }
}

async function updateDailyExtremes() {
    console.log('Updating daily extremes...');

    const [firstDayExtremes, yesterdayExtremes, todayExtremes] = await Promise.all([
        fetchDailyExtremes(2), // First day (2 days ago)
        fetchDailyExtremes(1), // Yesterday
        fetchDailyExtremes(0)  // Today
    ]);

    // Helper function to create vertical columns display for a day
    function createDayExtremesDisplay(extremes, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        // Create the two-column layout
        const columnsDiv = document.createElement('div');
        columnsDiv.className = 'extreme-columns';

        // Determine chronological order
        let firstExtreme, secondExtreme, isRising;

        if (extremes.min.timestamp && extremes.max.timestamp) {
            if (extremes.min.timestamp < extremes.max.timestamp) {
                // Min happened first, then max (temperature rising)
                firstExtreme = { type: 'min', ...extremes.min };
                secondExtreme = { type: 'max', ...extremes.max };
                isRising = true;
            } else {
                // Max happened first, then min (temperature falling)
                firstExtreme = { type: 'max', ...extremes.max };
                secondExtreme = { type: 'min', ...extremes.min };
                isRising = false;
            }
        }

        // First column (chronologically first)
        const firstColumn = document.createElement('div');
        firstColumn.className = 'extreme-column';

        if (firstExtreme) {
            const firstTime = new Date(firstExtreme.timestamp);
            const firstTimeString = firstTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            firstColumn.innerHTML = `
                <div class="extreme-type ${firstExtreme.type}">${firstExtreme.type.toUpperCase()}</div>
                <div class="extreme-temp">${firstExtreme.value.toFixed(1)}°</div>
                <div class="extreme-timestamp">${firstTimeString}</div>
            `;
        } else {
            firstColumn.innerHTML = `
                <div class="extreme-type">--</div>
                <div class="extreme-temp">--°</div>
                <div class="extreme-timestamp">--</div>
            `;
        }

        // Arrow container (always pointing right)
        const arrowContainer = document.createElement('div');
        arrowContainer.className = 'trend-arrow-container';

        if (firstExtreme && secondExtreme) {
            // Calculate temperature difference
            const tempDiff = Math.abs(extremes.max.value - extremes.min.value);
            const diffText = isRising ? `+${tempDiff.toFixed(1)}°` : `-${tempDiff.toFixed(1)}°`;

            // Arrow color based on temperature trend
            const arrowClass = isRising ? 'up' : 'down';
            arrowContainer.innerHTML = `
                <div class="horizontal-arrow ${arrowClass}">→</div>
                <div class="temp-diff ${arrowClass}">${diffText}</div>
            `;
        }

        // Second column (chronologically second)
        const secondColumn = document.createElement('div');
        secondColumn.className = 'extreme-column';

        if (secondExtreme) {
            const secondTime = new Date(secondExtreme.timestamp);
            const secondTimeString = secondTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            secondColumn.innerHTML = `
                <div class="extreme-type ${secondExtreme.type}">${secondExtreme.type.toUpperCase()}</div>
                <div class="extreme-temp">${secondExtreme.value.toFixed(1)}°</div>
                <div class="extreme-timestamp">${secondTimeString}</div>
            `;
        } else {
            secondColumn.innerHTML = `
                <div class="extreme-type">--</div>
                <div class="extreme-temp">--°</div>
                <div class="extreme-timestamp">--</div>
            `;
        }

        columnsDiv.appendChild(firstColumn);
        columnsDiv.appendChild(arrowContainer);
        columnsDiv.appendChild(secondColumn);
        container.appendChild(columnsDiv);
    }

    // Create displays for both days
    createDayExtremesDisplay(yesterdayExtremes, 'yesterday-chronological');
    createDayExtremesDisplay(todayExtremes, 'today-chronological');

    return { firstDayExtremes, yesterdayExtremes, todayExtremes };
}

async function fetchTemperatureHistory(hours = 168) { // 168h = 7 days
    try {
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - (hours * 60 * 60);

        // Different granularity for different timeframes
        const stepSize = hours <= 48 ? 600 : 3600; // 10min for 48h, 1h for 7d
        const avgPeriod = hours <= 48 ? '10m' : '1h';

        const poolQuery = `avg_over_time(inkbird_temperature_celsius{group="inkbird", job="raspi sensors"}[${avgPeriod}])`;
        const airQuery = `avg_over_time(temperature{instance="wunderground.972.ovh:443", job="internet scraping", mode="actual", station_id="ICAHOR23"}[${avgPeriod}])`;

        const [poolResponse, airResponse] = await Promise.all([
            fetch(`${PROMETHEUS_RANGE_URL}?query=${encodeURIComponent(poolQuery)}&start=${startTime}&end=${endTime}&step=${stepSize}`),
            fetch(`${PROMETHEUS_RANGE_URL}?query=${encodeURIComponent(airQuery)}&start=${startTime}&end=${endTime}&step=${stepSize}`)
        ]);

        const [poolData, airData] = await Promise.all([
            poolResponse.json(),
            airResponse.json()
        ]);

        return {
            pool: poolData.status === 'success' && poolData.data.result.length > 0 ? poolData.data.result[0].values : [],
            air: airData.status === 'success' && airData.data.result.length > 0 ? airData.data.result[0].values : []
        };
    } catch (error) {
        console.error('Error fetching temperature history:', error);
        return { pool: [], air: [] };
    }
}

async function updateCurrentTemperatures() {
    console.log('Updating current temperatures...');

    const poolTemp = await fetchCurrentTemperature('pool');
    const airTemp = await fetchCurrentTemperature('air');

    console.log('Pool temperature:', poolTemp);
    console.log('Air temperature:', airTemp);

    if (poolTemp !== null) {
        document.getElementById('pool-temp').innerHTML = `${poolTemp.toFixed(1)}<span class="temperature-unit">°C</span>`;
        updatePoolTempColor(poolTemp);

        // Update subtitle with age of measurement
        const age = await fetchInkbirdAge();
        document.getElementById('pool-temp-subtitle').textContent = age || 'Âge indisponible';
    } else {
        document.getElementById('pool-temp').innerHTML = `--<span class="temperature-unit">°C</span>`;
        document.getElementById('pool-temp-subtitle').textContent = 'Données indisponibles';
    }

    if (airTemp !== null) {
        document.getElementById('air-temp').innerHTML = `${airTemp.toFixed(1)}<span class="temperature-unit">°C</span>`;

        // Calculate and display temperature difference
        if (poolTemp !== null) {
            const diff = airTemp - poolTemp; // Air temp compared to pool temp
            let diffText;

            if (Math.abs(diff) < 0.1) {
                diffText = 'même température que l\'eau';
            } else if (diff > 0) {
                diffText = `${diff.toFixed(1)}°C plus chaud que l'eau`;
            } else {
                diffText = `${Math.abs(diff).toFixed(1)}°C plus froid que l'eau`;
            }

            document.getElementById('air-temp-subtitle').textContent = diffText;
        } else {
            document.getElementById('air-temp-subtitle').textContent = 'Référence';
        }
    } else {
        document.getElementById('air-temp').innerHTML = `--<span class="temperature-unit">°C</span>`;
        document.getElementById('air-temp-subtitle').textContent = 'Données indisponibles';
    }
}

function addMidnightMarkers(chart, hours) {
    // Generate midnight times for the chart period
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    const midnights = [];

    // Find all midnight times within the chart period
    const currentDate = new Date(startTime);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= now) {
        if (currentDate > startTime) {
            midnights.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Draw midnight lines on the chart
    const originalDraw = chart.draw;
    chart.draw = function() {
        originalDraw.apply(this, arguments);

        const ctx = this.ctx;
        const chartArea = this.chartArea;
        const xScale = this.scales.x;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        midnights.forEach(midnight => {
            const xPos = xScale.getPixelForValue(midnight);
            if (xPos >= chartArea.left && xPos <= chartArea.right) {
                ctx.beginPath();
                ctx.moveTo(xPos, chartArea.top);
                ctx.lineTo(xPos, chartArea.bottom);
                ctx.stroke();
            }
        });

        ctx.restore();
    };
}

async function createTemperatureChart(canvasId, hours = 168, extremesData = null) {
    console.log(`Creating ${hours}h temperature chart...`);

    const historyData = await fetchTemperatureHistory(hours);

    const ctx = document.getElementById(canvasId).getContext('2d');

    // Process data for chart
    const labels = [];
    const poolTemps = [];
    const airTemps = [];

    // Create a time-based mapping for better data alignment
    const timeMap = new Map();

    // Process pool data
    historyData.pool.forEach(([timestamp, value]) => {
        const date = new Date(timestamp * 1000);
        const timeKey = Math.floor(timestamp / 3600) * 3600; // Round to nearest hour
        timeMap.set(timeKey, { time: date, pool: parseFloat(value) });
    });

    // Process air data and align with pool data
    historyData.air.forEach(([timestamp, value]) => {
        const timeKey = Math.floor(timestamp / 3600) * 3600; // Round to nearest hour
        const existing = timeMap.get(timeKey);
        if (existing) {
            existing.air = parseFloat(value);
        } else {
            const date = new Date(timestamp * 1000);
            timeMap.set(timeKey, { time: date, air: parseFloat(value) });
        }
    });

    // Convert to arrays sorted by time
    const sortedData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

    sortedData.forEach(item => {
        labels.push(item.time);
        poolTemps.push(item.pool || null);
        airTemps.push(item.air || null);
    });

    console.log('Chart data points:', sortedData.length);
    console.log('Pool data points:', poolTemps.filter(t => t !== null).length);
    console.log('Air data points:', airTemps.filter(t => t !== null).length);
    console.log('Sample data:', sortedData.slice(0, 3));

    // Prepare datasets - temperature lines first (bottom layer)
    const datasets = [
        {
            label: 'Température Piscine',
            data: poolTemps,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: hours === 48 ? 2 : 0,
            pointBackgroundColor: '#0284c7',
            pointBorderWidth: 0,
            pointHoverRadius: 6,
            spanGaps: true,
            order: 10
        },
        {
            label: 'Température Extérieure',
            data: airTemps,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: hours === 48 ? 2 : 0,
            pointBackgroundColor: '#1e3a8a',
            pointBorderWidth: 0,
            pointHoverRadius: 6,
            spanGaps: true,
            hidden: true,
            order: 9
        }
    ];

    // Add extreme points for 48h chart only
    if (hours === 48 && extremesData) {
        const minPoints = [];
        const maxPoints = [];

        // Helper function to find actual min/max around a timestamp on the chart line
        function findExtremeOnChartLine(targetTimestamp, isMax = true) {
            // Find the closest chart point
            let closestIndex = -1;
            let minTimeDiff = Infinity;

            labels.forEach((label, index) => {
                const timeDiff = Math.abs(label.getTime() - targetTimestamp);
                if (timeDiff < minTimeDiff && poolTemps[index] !== null) {
                    minTimeDiff = timeDiff;
                    closestIndex = index;
                }
            });

            if (closestIndex < 0) return null;

            // Look at points around the closest index (±2 points)
            const startIndex = Math.max(0, closestIndex - 2);
            const endIndex = Math.min(poolTemps.length - 1, closestIndex + 2);

            let extremeIndex = closestIndex;
            let extremeValue = poolTemps[closestIndex];

            for (let i = startIndex; i <= endIndex; i++) {
                if (poolTemps[i] !== null) {
                    if (isMax && poolTemps[i] > extremeValue) {
                        extremeValue = poolTemps[i];
                        extremeIndex = i;
                    } else if (!isMax && poolTemps[i] < extremeValue) {
                        extremeValue = poolTemps[i];
                        extremeIndex = i;
                    }
                }
            }

            return {
                x: labels[extremeIndex],
                y: poolTemps[extremeIndex]
            };
        }

        // Add first day's extremes using chart line extremes (48h only)
        if (extremesData.firstDayExtremes.min.timestamp) {
            const point = findExtremeOnChartLine(extremesData.firstDayExtremes.min.timestamp, false);
            if (point) minPoints.push(point);
        }
        if (extremesData.firstDayExtremes.max.timestamp) {
            const point = findExtremeOnChartLine(extremesData.firstDayExtremes.max.timestamp, true);
            if (point) maxPoints.push(point);
        }

        // Add yesterday's extremes using chart line extremes
        if (extremesData.yesterdayExtremes.min.timestamp) {
            const point = findExtremeOnChartLine(extremesData.yesterdayExtremes.min.timestamp, false);
            if (point) minPoints.push(point);
        }
        if (extremesData.yesterdayExtremes.max.timestamp) {
            const point = findExtremeOnChartLine(extremesData.yesterdayExtremes.max.timestamp, true);
            if (point) maxPoints.push(point);
        }

        // Add today's extremes using chart line extremes
        if (extremesData.todayExtremes.min.timestamp) {
            const point = findExtremeOnChartLine(extremesData.todayExtremes.min.timestamp, false);
            if (point) minPoints.push(point);
        }
        if (extremesData.todayExtremes.max.timestamp) {
            const point = findExtremeOnChartLine(extremesData.todayExtremes.max.timestamp, true);
            if (point) maxPoints.push(point);
        }

        // Add min points dataset (darker blue) - render on top
        if (minPoints.length > 0) {
            datasets.push({
                label: 'Minimums',
                data: minPoints,
                type: 'scatter',
                borderColor: '#2563eb',
                backgroundColor: '#2563eb',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
                pointStyle: 'circle',
                borderWidth: 2,
                order: 1
            });
        }

        // Add max points dataset (darker red) - render on top
        if (maxPoints.length > 0) {
            datasets.push({
                label: 'Maximums',
                data: maxPoints,
                type: 'scatter',
                borderColor: '#dc2626',
                backgroundColor: '#dc2626',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
                pointStyle: 'circle',
                borderWidth: 2,
                order: 0
            });
        }
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Source Sans Pro', sans-serif",
                            size: 14,
                            weight: '600'
                        },
                        filter: function(item, chart) {
                            // Hide extreme points from legend
                            return item.text !== 'Minimums' && item.text !== 'Maximums';
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#6b7280',
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 12,
                    displayColors: true,
                    bodyFont: {
                        family: "'Source Sans Pro', sans-serif"
                    },
                    titleFont: {
                        family: "'Playfair Display', serif",
                        weight: '600'
                    },
                    callbacks: {
                        title: function(context) {
                            const date = context[0].parsed.x;
                            return new Date(date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit'
                            });
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return value !== null ? `${label}: ${value.toFixed(1)}°C` : `${label}: --°C`;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: hours <= 48 ? 'hour' : 'day',
                        stepSize: hours <= 48 ? 6 : 1,
                        displayFormats: {
                            hour: 'dd/MM HH:mm',
                            day: 'dd/MM'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            family: "'Source Sans Pro', sans-serif",
                            size: 12
                        },
                        color: '#6b7280',
                        maxTicksLimit: hours <= 48 ? 8 : 7
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1) + '°C';
                        },
                        font: {
                            family: "'Source Sans Pro', sans-serif",
                            size: 12
                        },
                        color: '#6b7280'
                    }
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round'
                }
            }
        }
    });

    // Add midnight markers after chart is created
    addMidnightMarkers(chart, hours);
}

// Initialize the page
async function init() {
    console.log('Initializing pool monitoring page...');

    try {
        await updateCurrentTemperatures();

        // Update daily extremes and get the data
        const extremesData = await updateDailyExtremes();

        // Create charts - pass extremes data to 48h chart
        await createTemperatureChart('temperature-chart-48h', 48, extremesData);
        await createTemperatureChart('temperature-chart-7d', 168);

        console.log('Page initialization complete');
    } catch (error) {
        console.error('Error during initialization:', error);
    }

    // Update temperatures every 5 minutes
    setInterval(() => {
        console.log('Auto-updating temperatures...');
        updateCurrentTemperatures();
    }, 5 * 60 * 1000);

    // Update daily extremes every hour
    setInterval(() => {
        console.log('Auto-updating daily extremes...');
        updateDailyExtremes().then(extremesData => {
            // Recreate 48h chart with updated extremes
            createTemperatureChart('temperature-chart-48h', 48, extremesData);
        });
    }, 60 * 60 * 1000);
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}