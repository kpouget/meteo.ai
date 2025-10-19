const metricsYaml = `
metrics:
  rain_rate:
    query: 'rate(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="rate"}[5m])'
    unit: 'mm/h'
  rain_total_day:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1d])'
    unit: 'mm'
  rain_total_week:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[1w])'
    unit: 'mm'
  rain_total_month:
    query: 'increase(rain{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="total"}[30d])'
    unit: 'mm'
  temperature_ext:
    query: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="actual"}'
    unit: '°C'
  temperature_int:
    query: 'temperature{group="pac", instance="home.972.ovh:35004", job="raspi sensors", location="pac_interieur"}'
    unit: '°C'
  dew_point:
    query: 'temperature{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", location="toiture", mode="dew_point"}'
    unit: '°C'
  wind_speed:
    query: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="speed"}'
    unit: 'km/h'
  wind_gust:
    query: 'wind{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors", mode="gust"}'
    unit: 'km/h'
  wind_dir:
    query: 'wind_dir{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: ''
  pressure:
    query: 'pressure{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: 'hPa'
  sun_rad:
    query: 'sun_rad{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: 'J/m²'
  uv_idx:
    query: 'uv_idx{group="wundeground", instance="home.972.ovh:35007", job="raspi sensors"}'
    unit: '/11'
  pm1:
    query: 'PM1{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
  pm25:
    query: 'PM25{instance="home.972.ovh:35000", job="raspi sensors"} - PM1{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
  pm10:
    query: 'PM10{instance="home.972.ovh:35000", job="raspi sensors"} - PM25{instance="home.972.ovh:35000", job="raspi sensors"}'
    unit: 'µg/m³'
  river_lot:
    query: 'river_flow{name="Lot"}'
    unit: 'm³/s'
  river_dordogne:
    query: 'river_flow{name="Dordogne"}'
    unit: 'm³/s'
`;
