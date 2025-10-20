const metricsYaml = `
metrics:
  rain_rate:
    query: 'rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="rate"}'
    unit: 'mm/h'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22rate%22%7D&g0.tab=0&g0.range_input=1d'
  rain_total_day:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1d])'
    unit: 'mm'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B1d%5D)&g0.tab=0&g0.range_input=1d'
  rain_total_week:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])'
    unit: 'mm'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B1w%5D)&g0.tab=0&g0.range_input=1d'
  rain_total_month:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[30d])'
    unit: 'mm'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=increase(rain%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22total%22%7D%5B30d%5D)&g0.tab=0&g0.range_input=1d'
  temperature_ext:
    query: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}'
    unit: '°C'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22toiture%22%2C%20mode%3D%22actual%22%7D&g0.tab=0&g0.range_input=1d'
  temperature_int:
    query: 'temperature{group="pac", instance="home.972.ovh:35004", job="raspi sensors", location="pac_interieur"}'
    unit: '°C'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22pac%22%2C%20instance%3D%22home.972.ovh%3A35004%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22pac_interieur%22%7D&g0.tab=0&g0.range_input=1d'
  dew_point:
    query: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="dew_point"}'
    unit: '°C'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=temperature%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20location%3D%22toiture%22%2C%20mode%3D%22dew_point%22%7D&g0.tab=0&g0.range_input=1d'
  wind_speed:
    query: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}'
    unit: 'km/h'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=wind%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22speed%22%7D&g0.tab=0&g0.range_input=1d'
  wind_gust:
    query: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}'
    unit: 'km/h'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=wind%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%2C%20mode%3D%22gust%22%7D&g0.tab=0&g0.range_input=1d'
  wind_dir:
    query: 'wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: ''
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=wind_dir%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  pressure:
    query: 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: 'hPa'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=pressure%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  sun_rad:
    query: 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: 'J/m²'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=sun_rad%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  uv_idx:
    query: 'uv_idx{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: '/11'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=uv_idx%7Bgroup%3D%22wundeground%22%2C%20instance%3D%22home.972.ovh%3A35007%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  pm1:
    query: 'PM1{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=PM1%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  pm25:
    query: 'PM25{instance="home.972.ovh:35000", job="raspi sensors"} - PM1{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=PM25%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%20-%20PM1%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  pm10:
    query: 'PM10{instance="home.972.ovh:35000", job="raspi sensors"} - PM25{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=PM10%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D%20-%20PM25%7Binstance%3D%22home.972.ovh%3A35000%22%2C%20job%3D%22raspi%20sensors%22%7D&g0.tab=0&g0.range_input=1d'
  river_lot:
    query: 'river_flow{name="Lot"}'
    unit: 'm³/s'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=river_flow%7Bname%3D%22Lot%22%7D&g0.tab=0&g0.range_input=1d'
  river_dordogne:
    query: 'river_flow{name="Dordogne"}'
    unit: 'm³/s'
    plot_url: 'https://prometheus.972.ovh/graph?g0.expr=river_flow%7Bname%3D%22Dordogne%22%7D&g0.tab=0&g0.range_input=1d'
`;
