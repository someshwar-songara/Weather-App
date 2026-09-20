package com.example.weatherapp;

import java.util.List;

public class WeatherData {
    private String city;
    private double temperature;
    private String description;
    private int humidity;
    private double windSpeed;
    private int aqi;
    private double visibility;
    private List<ForecastItem> forecast;

    public WeatherData(String city, double temperature, String description, int humidity, double windSpeed, double visibility, int aqi, List<ForecastItem> forecast) {
        this.city = city;
        this.temperature = temperature;
        this.description = description;
        this.humidity = humidity;
        this.windSpeed = windSpeed;
        this.visibility = visibility;
        this.aqi = aqi;
        this.forecast = forecast;
    }

    public String getCity() {
        return city;
    }

    public double getTemperature() {
        return temperature;
    }

    public String getDescription() {
        return description;
    }

    public int getHumidity() {
        return humidity;
    }

    public double getWindSpeed() {
        return windSpeed;
    }

    public int getAqi() {
        return aqi;
    }

    public double getVisibility() {
        return visibility;
    }

    public List<ForecastItem> getForecast() {
        return forecast;
    }

    public static class ForecastItem {
        private String time;
        private double temperature;
        private String description;

        public ForecastItem(String time, double temperature, String description) {
            this.time = time;
            this.temperature = temperature;
            this.description = description;
        }

        public String getTime() {
            return time;
        }

        public double getTemperature() {
            return temperature;
        }

        public String getDescription() {
            return description;
        }
    }
}

