const PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';

const METRICS = {
    rain_rate: 'rate(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="rate"}[5m])',
    rain_total_day: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1d])',
    rain_total_week: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])',
    rain_total_month: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1M])',
    temperature_ext: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}',
    temperature_int: 'temperature{group="pac", instance="home.972.ovh:35004", job="raspi sensors", location="pac_interieur"}',
    wind_speed: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}',
    wind_gust: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}',
    wind_dir: 'wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    pressure: 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    sun_rad: 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}',
    uv_idx: 'uv_idx{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
};

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
            const kindleElement = document.getElementById(metric.replace(/_/g, '-'));
            if (kindleElement) {
                kindleElement.querySelector('.value').textContent = parseFloat(value).toFixed(2);
            }
            const desktopElement = document.getElementById(`desktop-${metric.replace(/_/g, '-')}`);
            if (desktopElement) {
                desktopElement.querySelector('.value').textContent = parseFloat(value).toFixed(2);
            }
        }
    }
}

if (isKindle()) {
    document.getElementById('kindle-view').style.display = 'block';
    let currentPage = 1;
    const totalPages = 6;

    const nextPage = () => {
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'none';
        currentPage = (currentPage % totalPages) + 1;
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'flex';
    };

    const prevPage = () => {
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'none';
        currentPage = (currentPage - 2 + totalPages) % totalPages + 1;
        document.getElementById(`kindle-page-${currentPage}`).style.display = 'flex';
    };

    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('prev-page').addEventListener('click', prevPage);

    setInterval(nextPage, 10000);
} else {
    document.getElementById('desktop-view').style.display = 'block';
}

updateUI();
setInterval(updateUI, 60000);
