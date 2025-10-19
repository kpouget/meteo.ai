const PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

const METRICS = {
    rain_rate: 'rate(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="rate"}[5m])',
    rain_total_day: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1d])',
    rain_total_week: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])',
    rain_total_month: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[30d])',
    temperature_ext: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}',
    temperature_int: 'temperature{group="pac", instance="home.972.ovh:35004", job="raspi sensors", location="pac_interieur"}',
    wind_speed: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}',
    wind_gust: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}',
    wind_dir: 'wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    pressure: 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    sun_rad: 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    uv_idx: 'uv_idx{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    pm1: 'PM1{instance="home.972.ovh:35000", job="raspi sensors"}',
    pm25: 'PM25{instance="home.972.ovh:35000", job="raspi sensors"} - PM1{instance="home.972.ovh:35000", job="raspi sensors"}',
    pm10: 'PM10{instance="home.972.ovh:35000", job="raspi sensors"} - PM25{instance="home.972.ovh:35000", job="raspi sensors"}',
    river_lot: 'river_flow{name="Lot"}',
    river_dordogne: 'river_flow{name="Dordogne"}'
};

const UNITS = {
    rain_rate: 'mm/h',
    rain_total_day: 'mm',
    rain_total_week: 'mm',
    rain_total_month: 'mm',
    temperature_ext: '°C',
    temperature_int: '°C',
    wind_speed: 'km/h',
    wind_gust: 'km/h',
    wind_dir: '', // Special handling
    pressure: 'hPa',
    sun_rad: 'J/m²',
    uv_idx: '/11',
    pm1: 'µg/m³',
    pm25: 'µg/m³',
    pm10: 'µg/m³',
    river_lot: 'm³/s',
    river_dordogne: 'm³/s'
};

let currentPage = 1;
let currentView = isKindle() ? 'kindle' : 'desktop';
let kindleTimer;
let currentRotation = 0;

function degreesToCardinal(deg) {
    const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return cardinals[index];
}

function isKindle() {
    return /Kindle|Silk/i.test(navigator.userAgent);
}

async function fetchMetric(metricName) {
    const query = METRICS[metricName];
    if (!query) {
        console.error(`Metric ${metricName} not found`);
        return null;
    }
    const url = `${PROMETHEUS_URL}?query=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'success' && data.data.result.length > 0) {
            return data.data.result[0].value[1];
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error fetching ${metricName}:`, error);
        return null;
    }
}

async function updateUI() {
    for (const metric in METRICS) {
        const value = await fetchMetric(metric);
        if (value !== null) {
            let formattedValue;
            if (metric === 'wind_dir') {
                formattedValue = degreesToCardinal(parseFloat(value));
            } else {
                if (metric.startsWith('rain_') || metric.startsWith('wind_') || metric === 'uv_idx' || metric.startsWith('pm')) {
                    formattedValue = parseFloat(value).toFixed(0);
                } else if (metric.startsWith('temperature_') || metric === 'pressure' || metric === 'sun_rad') {
                    formattedValue = parseFloat(value).toFixed(1);
                } else {
                    formattedValue = parseFloat(value).toFixed(2);
                }
                if (UNITS[metric]) {
                    formattedValue += ` ${UNITS[metric]}`;
                }
            }

            const kindleElement = document.getElementById(metric.replace(/_/g, '-'));
            if (kindleElement) {
                kindleElement.querySelector('.value').textContent = formattedValue;
            }
            const desktopElement = document.getElementById(`desktop-${metric.replace(/_/g, '-')}`);
            if (desktopElement) {
                desktopElement.querySelector('.value').textContent = formattedValue;
            }
        }
    }
}

function updateUrlAnchor() {
    let hash = `view=${currentView}`;
    if (currentView === 'kindle') {
        hash += `&page=${currentPage}`;
    }
    window.location.hash = hash;
}

function setupKindleView() {
    document.getElementById('kindle-view').style.display = 'block';
    document.getElementById('desktop-view').style.display = 'none';
    document.getElementById('rotate-kindle').style.display = 'inline-block';
    document.getElementById('view-switcher').textContent = '💻';
    const totalPages = 4;

    for (let i = 1; i <= totalPages; i++) {
        document.getElementById(`kindle-page-${i}`).style.display = 'none';
    }
    document.getElementById(`kindle-page-${currentPage}`).style.display = 'flex';


    const nextPage = () => {
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'none';
        currentPage = (currentPage % totalPages) + 1;
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'flex';
        updateUrlAnchor();
    };

    const prevPage = () => {
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'none';
        currentPage = (currentPage - 2 + totalPages) % totalPages + 1;
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'flex';
        updateUrlAnchor();
    };

    const resetTimer = () => {
        clearInterval(kindleTimer);
        kindleTimer = setInterval(nextPage, 10000);
    };

    document.getElementById('next-page').addEventListener('click', () => {
        nextPage();
        resetTimer();
    });
    document.getElementById('prev-page').addEventListener('click', () => {
        prevPage();
        resetTimer();
    });

    resetTimer();
}

function setupDesktopView() {
    document.getElementById('desktop-view').style.display = 'block';
    const kindleView = document.getElementById('kindle-view');
    kindleView.style.display = 'none';
    document.getElementById('rotate-kindle').style.display = 'none';
    document.getElementById('view-switcher').textContent = '📖';
    kindleView.classList.remove('rotated-90', 'rotated-180', 'rotated-270');
    currentRotation = 0;
    clearInterval(kindleTimer);
}

document.getElementById('rotate-kindle').addEventListener('click', () => {
    const kindleView = document.getElementById('kindle-view');
    kindleView.classList.remove(`rotated-${currentRotation}`);
    currentRotation = (currentRotation + 90) % 360;
    if (currentRotation !== 0) {
        kindleView.classList.add(`rotated-${currentRotation}`);
    }
});

function readUrlAnchor() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const view = params.get('view');
    const page = params.get('page');

    if (view) {
        currentView = view;
    }
    if (page) {
        currentPage = parseInt(page, 10);
    }
}

readUrlAnchor();
if (currentView === 'kindle') {
    setupKindleView();
} else {
    setupDesktopView();
}
updateUrlAnchor();


document.getElementById('view-switcher').addEventListener('click', () => {
    if (currentView === 'kindle') {
        currentView = 'desktop';
        setupDesktopView();
    } else {
        currentView = 'kindle';
        setupKindleView();
    }
    updateUrlAnchor();
});

updateUI();
setInterval(updateUI, 60000);
