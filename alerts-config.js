// Weather Alerts Configuration
// Add new alerts here by copying the pattern below

var WEATHER_ALERTS = [
    // Wind Alerts
    {
        id: "wind_speed",
        metric: "wind_speed",
        unit: "km/h",
        thresholds: [
            { level: "INFO", condition: "greater_than", value: 5, message: "Venteux" },
            { level: "WARN", condition: "greater_than", value: 10, message: "Fort vents" },
            { level: "ALERT", condition: "greater_than", value: 20, message: "Vents très forts" }
        ]
    },

    // River Alerts (Lot) - High levels
    {
        id: "river_lot",
        metric: "river_lot",
        unit: "m³/s",
        thresholds: [
            { level: "WARN", condition: "greater_than", value: 450, message: "Lot haut" },
            { level: "ALERT", condition: "greater_than", value: 750, message: "Lot en crue" },
            { level: "WARN", condition: "less_than", value: 100, message: "Lot bas" }
        ]
    },

    // Temperature Alerts
    {
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
    //     id: "unique_alert_id",
    //     level: "INFO" | "WARN" | "ALERT",
    //     metric: "metric_name_from_METRICS",
    //     condition: "greater_than" | "less_than" | "equals",
    //     threshold: numeric_value,
    //     message: "Alert message to display",
    //     unit: "optional_unit_for_display"
    // }
];
