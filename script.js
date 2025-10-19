const PROMETHEUS_URL = 'https://prometheus.972.ovh/api/v1/query';
let METRICS = {};

function loadMetrics() {
    try {
        const yamlData = jsyaml.load(metricsYaml);
        METRICS = yamlData.metrics;
    } catch (error) {
        console.error('Error loading or parsing metrics.js:', error);
    }
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
    const query = METRICS[metricName].query;
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
            let useInnerHTML = false;

            if (metric === 'wind_dir') {
                formattedValue = degreesToCardinal(parseFloat(value));
            } else if (metric === 'dew_point') {
                const numericValue = parseFloat(value).toFixed(1);
                const textValue = humiditeRessentie(parseFloat(value));
                const unit = METRICS[metric].unit || '';
                formattedValue = `${numericValue}${unit}<span class="dew-point-text">${textValue}</span>`;
                useInnerHTML = true;
            } else {
                if (metric.startsWith('rain_') || metric.startsWith('wind_') || metric === 'uv_idx' || metric.startsWith('pm')) {
                    formattedValue = parseFloat(value).toFixed(0);
                } else if (metric.startsWith('temperature_') || metric === 'pressure' || metric === 'sun_rad') {
                    formattedValue = parseFloat(value).toFixed(1);
                } else {
                    formattedValue = parseFloat(value).toFixed(2);
                }
                if (METRICS[metric].unit) {
                    formattedValue += ` ${METRICS[metric].unit}`;
                }
            }

            const kindleElement = document.getElementById(metric.replace(/_/g, '-'));
            if (kindleElement) {
                const valueElement = kindleElement.querySelector('.value');
                if (useInnerHTML) {
                    valueElement.innerHTML = formattedValue;
                } else {
                    valueElement.textContent = formattedValue;
                }
            }
            const desktopElement = document.getElementById(`desktop-${metric.replace(/_/g, '-')}`);
            if (desktopElement) {
                const valueElement = desktopElement.querySelector('.value');
                if (useInnerHTML) {
                    valueElement.innerHTML = formattedValue;
                } else {
                    valueElement.textContent = formattedValue;
                }
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

function main() {
    loadMetrics();
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
}

main();
