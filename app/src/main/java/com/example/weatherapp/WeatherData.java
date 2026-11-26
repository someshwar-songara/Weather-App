package com.example.weatherapp;

import java.util.List;

public class WeatherData {
    private String city;
    private double latitude;
    private double longitude;
    private double temperature;
    private double feelsLike;
    private double tempMin;
    private double tempMax;
    private String description;
    private int humidity;
    private double windSpeed;
    private int aqi;
    private String aqiCategory;
    private String aqiProminentPollutant;
    private double pm25;
    private double pm10;
    private double no2;
    private double so2;
    private double co;
    private double o3;
    private double visibility;
    private int pressure;
    private String sunrise;
    private String sunset;
    private int windDeg;
    private double uvIndex;
    private List<ForecastItem> forecast;
    private long dt;
    private int timezone;
    private boolean isDay;
    private long sunriseRaw;
    private long sunsetRaw;
    private String localTimeString;

    public WeatherData(String city, double temperature, String description, int humidity, double windSpeed, double visibility, int aqi, List<ForecastItem> forecast) {
        this(city, temperature, temperature, temperature - 2, temperature + 2, description, humidity, windSpeed, visibility, aqi, 1013, forecast);
    }

    public WeatherData(String city, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, int pressure, List<ForecastItem> forecast) {
        this(city, temperature, feelsLike, tempMin, tempMax, description, humidity, windSpeed, visibility, aqi, pressure, "06:30 AM", "07:30 PM", 0, 3.0, forecast);
    }

    public WeatherData(String city, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, int pressure, String sunrise, String sunset, int windDeg, double uvIndex, List<ForecastItem> forecast) {
        this(city, temperature, feelsLike, tempMin, tempMax, description, humidity, windSpeed, visibility, aqi, "Moderate", "PM2.5", 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, pressure, sunrise, sunset, windDeg, uvIndex, forecast);
    }

    public WeatherData(String city, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, String aqiCategory, String aqiProminentPollutant, double pm25, double pm10, double no2, double so2, double co, double o3, int pressure, String sunrise, String sunset, int windDeg, double uvIndex, List<ForecastItem> forecast) {
        this(city, 23.1789, 75.7859, temperature, feelsLike, tempMin, tempMax, description, humidity, windSpeed, visibility, aqi, aqiCategory, aqiProminentPollutant, pm25, pm10, no2, so2, co, o3, pressure, sunrise, sunset, windDeg, uvIndex, forecast);
    }

    public WeatherData(String city, double latitude, double longitude, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, String aqiCategory, String aqiProminentPollutant, double pm25, double pm10, double no2, double so2, double co, double o3, int pressure, String sunrise, String sunset, int windDeg, double uvIndex, List<ForecastItem> forecast) {
        this(city, latitude, longitude, temperature, feelsLike, tempMin, tempMax, description, humidity, windSpeed, visibility, aqi, aqiCategory, aqiProminentPollutant, pm25, pm10, no2, so2, co, o3, pressure, sunrise, sunset, windDeg, uvIndex, forecast, System.currentTimeMillis() / 1000L, 0, true, 0, 0, null);
    }

    public WeatherData(String city, double latitude, double longitude, double temperature, double feelsLike, double tempMin, double tempMax, String description, int humidity, double windSpeed, double visibility, int aqi, String aqiCategory, String aqiProminentPollutant, double pm25, double pm10, double no2, double so2, double co, double o3, int pressure, String sunrise, String sunset, int windDeg, double uvIndex, List<ForecastItem> forecast, long dt, int timezone, boolean isDay, long sunriseRaw, long sunsetRaw, String localTimeString) {
        this.city = city;
        this.latitude = latitude;
        this.longitude = longitude;
        this.temperature = temperature;
        this.feelsLike = feelsLike;
        this.tempMin = tempMin;
        this.tempMax = tempMax;
        this.description = description;
        this.humidity = humidity;
        this.windSpeed = windSpeed;
        this.visibility = visibility;
        this.aqi = aqi;
        this.aqiCategory = aqiCategory;
        this.aqiProminentPollutant = aqiProminentPollutant;
        this.pm25 = pm25;
        this.pm10 = pm10;
        this.no2 = no2;
        this.so2 = so2;
        this.co = co;
        this.o3 = o3;
        this.pressure = pressure;
        this.sunrise = sunrise;
        this.sunset = sunset;
        this.windDeg = windDeg;
        this.uvIndex = uvIndex;
        this.forecast = forecast;
        this.dt = dt;
        this.timezone = timezone;
        this.isDay = isDay;
        this.sunriseRaw = sunriseRaw;
        this.sunsetRaw = sunsetRaw;
        this.localTimeString = localTimeString;
    }

    public String getCity() {
        return city;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
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

    public String getAqiCategory() {
        return aqiCategory != null ? aqiCategory : "Moderate";
    }

    public String getAqiProminentPollutant() {
        return aqiProminentPollutant != null ? aqiProminentPollutant : "PM2.5";
    }

    public double getPm25() {
        return pm25;
    }

    public double getPm10() {
        return pm10;
    }

    public double getNo2() {
        return no2;
    }

    public double getSo2() {
        return so2;
    }

    public double getCo() {
        return co;
    }

    public double getO3() {
        return o3;
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

    public long getDt() {
        return dt;
    }

    public int getTimezone() {
        return timezone;
    }

    public boolean isDay() {
        return isDay;
    }

    public long getSunriseRaw() {
        return sunriseRaw;
    }

    public long getSunsetRaw() {
        return sunsetRaw;
    }

    public String getLocalTimeString() {
        return localTimeString;
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
