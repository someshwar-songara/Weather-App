package com.example.weatherapp;

import java.util.List;

public class WeatherData {
    private String city;
    private double temperature;
    private double feelsLike;
    private double tempMin;
    private double tempMax;
    private String description;
    private int humidity;
    private double windSpeed;
    private int aqi;
    private double visibility;
    private int pressure;
    private String sunrise;
    private String sunset;
    private int windDeg;
    private double uvIndex;
    private List<ForecastItem> forecast;

    public WeatherData(String city, double temperature, String description, int humidity, double windSpeed, double visibility, int aqi, List<ForecastItem> forecast) {
        this(city, temperature, temperature, temperature - 2, temperature + 2, description, humidity, windSpeed, visibility, aqi, 1013, forecast);
    }

    public WeatherData(String city, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, int pressure, List<ForecastItem> forecast) {
        this(city, temperature, feelsLike, tempMin, tempMax, description, humidity, windSpeed, visibility, aqi, pressure, "06:30 AM", "07:30 PM", 0, 3.0, forecast);
    }

    public WeatherData(String city, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, int pressure, String sunrise, String sunset, int windDeg, double uvIndex, List<ForecastItem> forecast) {
        this.city = city;
        this.temperature = temperature;
        this.feelsLike = feelsLike;
        this.tempMin = tempMin;
        this.tempMax = tempMax;
        this.description = description;
        this.humidity = humidity;
        this.windSpeed = windSpeed;
        this.visibility = visibility;
        this.aqi = aqi;
        this.pressure = pressure;
        this.sunrise = sunrise;
        this.sunset = sunset;
        this.windDeg = windDeg;
        this.uvIndex = uvIndex;
        this.forecast = forecast;
    }

    public String getCity() {
        return city;
    }

    public double getTemperature() {
        return temperature;
    }

    public double getFeelsLike() {
        return feelsLike;
    }

    public double getTempMin() {
        return tempMin;
    }

    public double getTempMax() {
        return tempMax;
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

    public int getPressure() {
        return pressure;
    }

    public String getSunrise() {
        return sunrise != null ? sunrise : "06:30 AM";
    }

    public String getSunset() {
        return sunset != null ? sunset : "07:30 PM";
    }

    public int getWindDeg() {
        return windDeg;
    }

    public double getUvIndex() {
        return uvIndex;
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
