// Weather Alerts Configuration
// Add new alerts here by copying the pattern below

var WEATHER_ALERTS = [
    // Wind Alerts
    {
	name: "Vitesse du vent",
        id: "wind_speed",
        metric: "wind_speed",
        unit: "km/h",
        thresholds: [
            { level: "INFO", condition: "greater_than", value: 5, message: "Vents faibles" },
            { level: "INFO", condition: "greater_than", value: 10, message: "Vents moyens" },
            { level: "WARN", condition: "greater_than", value: 15, message: "Fort vents" },
            { level: "ALERT", condition: "greater_than", value: 20, message: "Vents très forts" }
        ]
    },

    // Wind Gust Alerts
    {
        name: "Vitesse des rafales",
        id: "wind_gust",
        metric: "wind_gust",
        unit: "km/h",
        thresholds: [
            { level: "INFO", condition: "greater_than", value: 15, message: "Rafales" },
            { level: "WARN", condition: "greater_than", value: 30, message: "Fortes rafales" },
            { level: "ALERT", condition: "greater_than", value: 40, message: "Rafales violentes" }
        ]
    },

    // Solar Radiation Alerts
    {
        name: "Ensoleillement",
        id: "sun_rad",
        metric: "sun_rad",
        unit: " J/m²",
        thresholds: [
            { level: "INFO", condition: "less_than", value: 0.5, message: "Nuit" },
            { level: "INFO", condition: "greater_than", value: 40, message: "Ensoleillement faible" },
            { level: "INFO", condition: "greater_than", value: 200, message: "Ensoleillement modéré" },
            { level: "WARN", condition: "greater_than", value: 500, message: "Fort ensoleillement" },
            { level: "ALERT", condition: "greater_than", value: 800, message: "Très fort ensoleillement" }
        ]
    },

    // River Alerts (Lot) - High levels
    {
        name: "Niveau du Lot",
        id: "river_lot",
        metric: "river_lot",
        unit: "m³/s",
        thresholds: [
            { level: "WARN", condition: "greater_than", value: 450, message: "Lot haut" },
            { level: "ALERT", condition: "greater_than", value: 750, message: "Lot en crue" },
            { level: "WARN", condition: "less_than", value: 100, message: "Lot bas" }
        ]
    },

    // River Alerts (Dordogne) - Station-specific thresholds
    {
        name: "Niveau de la Dordogne",
        id: "river_dordogne",
        metric: "river_dordogne",
        stationThresholds: {
            "vayrac": {
                unit: "m",
                thresholds: [
                    { level: "WARN", condition: "less_than", value: 1.5, message: "Dordogne basse" },
		    { level: "INFO", condition: "greater_than", value: 3.3, message: "Dordogne sur le pont" },
                    { level: "ALERT", condition: "greater_than", value: 4.35, message: "Dordogne sur les berges" },
		    { level: "ALERT", condition: "greater_than", value: 5.5, message: "Dordogne sur la route" },
                ]
            },
            "default": {
                unit: "m³/s",
                thresholds: [
		    { level: "WARN", condition: "less_than", value: 50, message: "Dordogne basse" },
                    { level: "WARN", condition: "greater_than", value: 280, message: "Dordogne sur le pont" },
                    { level: "ALERT", condition: "greater_than", value: 530, message: "Dordogne sur les berges" },
		    { level: "ALERT", condition: "greater_than", value: 900, message: "Dordogne sur la route" },
                ]
            }
        }
    },

    // Temperature Alerts
    {
        name: "Température extérieur",
        id: "temperature_ext",
        metric: "temperature_ext",
        unit: "°C",
        thresholds: [
            { level: "WARN", condition: "less_than", value: 0, message: "Temps froid" },
            { level: "ALERT", condition: "less_than", value: -10, message: "Très froid" },
            { level: "WARN", condition: "greater_than", value: 30, message: "Chaud" },
            { level: "ALERT", condition: "greater_than", value: 35, message: "Très chaud" },
        ]
    },

    // Rain Rate Alerts
    {
        name: "Force de la pluie",
        id: "rain_rate",
        metric: "rain_rate",
        unit: "mm/h",
        thresholds: [
            { level: "INFO", condition: "greater_than", value: 1, message: "Pluie" },
            { level: "WARN", condition: "greater_than", value: 5, message: "Pluies fortes" },
            { level: "ALERT", condition: "greater_than", value: 10, message: "Pluies très fortes" }
        ]
    }

    // Add more alerts here following the same pattern:
    // {
    //     name: "user friendly name",
    //     id: "unique_alert_id",
    //     level: "INFO" | "WARN" | "ALERT",
    //     metric: "metric_name_from_METRICS",
    //     condition: "greater_than" | "less_than" | "equals",
    //     threshold: numeric_value,
    //     message: "Alert message to display",
    //     unit: "optional_unit_for_display"
    // }
];
