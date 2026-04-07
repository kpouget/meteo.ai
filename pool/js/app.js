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

async function createTemperatureChart(canvasId, hours = 168) {
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

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Température Piscine',
                    data: poolTemps,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    spanGaps: true
                },
                {
                    label: 'Température Extérieure',
                    data: airTemps,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    spanGaps: true,
                    hidden: true
                }
            ]
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
}

// Initialize the page
async function init() {
    console.log('Initializing pool monitoring page...');

    try {
        await updateCurrentTemperatures();
        await createTemperatureChart('temperature-chart-48h', 48);
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
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}