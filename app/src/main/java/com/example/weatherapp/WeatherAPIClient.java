package com.example.weatherapp;

import android.os.AsyncTask;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class WeatherAPIClient {
    private static final String TAG = "WeatherAPIClient";
    private static final String API_KEY = BuildConfig.API_KEY;
    private static final String BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
    private static final String FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
    private static final String AQI_URL = "https://api.openweathermap.org/data/2.5/air_pollution";
    private static final int TIMEOUT_SECONDS = 10;

    private OkHttpClient client;

    public WeatherAPIClient() {
        client = new OkHttpClient.Builder()
                .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .build();
    }

    public interface WeatherDataCallback {
        void onWeatherDataReceived(WeatherData weatherData);
        void onError(String error);
    }

    public void getWeatherData(String city, WeatherDataCallback callback) {
        new FetchWeatherTask(callback).execute(BASE_URL + "?q=" + city + "&appid=" + API_KEY + "&units=metric",
                FORECAST_URL + "?q=" + city + "&appid=" + API_KEY + "&units=metric");
    }

    public void getWeatherData(double latitude, double longitude, WeatherDataCallback callback) {
        Log.d(TAG, "getWeatherData called with lat: " + latitude + ", lon: " + longitude);
        new FetchWeatherTask(callback).execute(BASE_URL + "?lat=" + latitude + "&lon=" + longitude + "&appid=" + API_KEY + "&units=metric",
                FORECAST_URL + "?lat=" + latitude + "&lon=" + longitude + "&appid=" + API_KEY + "&units=metric");
    }

    private class FetchWeatherTask extends AsyncTask<String, Void, WeatherData> {
        private WeatherDataCallback callback;
        private String error;

        FetchWeatherTask(WeatherDataCallback callback) {
            this.callback = callback;
        }

        @Override
        protected WeatherData doInBackground(String... params) {
            try {
                Log.d(TAG, "Fetching current weather data from: " + params[0]);
                String currentWeatherJson = fetchData(params[0]);
                Log.d(TAG, "Fetching forecast data from: " + params[1]);
                String forecastJson = fetchData(params[1]);

                // Parse weather and forecast data
                JSONObject weatherData = new JSONObject(currentWeatherJson);
                JSONObject forecastData = new JSONObject(forecastJson);

                // Fetch AQI data
                double lat = weatherData.getJSONObject("coord").getDouble("lat");
                double lon = weatherData.getJSONObject("coord").getDouble("lon");
                String aqiUrl = AQI_URL + "?lat=" + lat + "&lon=" + lon + "&appid=" + API_KEY;
                Log.d(TAG, "Fetching AQI data from: " + aqiUrl);
                String aqiJson = fetchData(aqiUrl);
                JSONObject aqiData = new JSONObject(aqiJson);

                return parseWeatherData(weatherData, forecastData, aqiData);
            } catch (Exception e) {
                error = "Error fetching weather data: " + e.getMessage();
                Log.e(TAG, error, e);
                return null;
            }
        }

        @Override
        protected void onPostExecute(WeatherData weatherData) {
            if (weatherData != null) {
                callback.onWeatherDataReceived(weatherData);
            } else {
                callback.onError(error);
            }
        }

        private String fetchData(String urlString) throws Exception {
            Request request = new Request.Builder()
                    .url(urlString)
                    .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful()) throw new Exception("Unexpected code " + response);
                return response.body().string();
            }
        }

        private WeatherData parseWeatherData(JSONObject currentWeatherJson, JSONObject forecastJson, JSONObject aqiJson) throws Exception {
            Log.d(TAG, "Parsing weather data");
            String city = currentWeatherJson.getString("name");
            Log.d(TAG, "Parsing weather data for city: " + city);
            JSONObject main = currentWeatherJson.getJSONObject("main");
            double temperature = main.getDouble("temp");
            int humidity = main.getInt("humidity");
            int pressure = main.getInt("pressure");
            JSONArray weatherArray = currentWeatherJson.getJSONArray("weather");
            String description = weatherArray.getJSONObject(0).getString("description");
            double windSpeed = currentWeatherJson.getJSONObject("wind").getDouble("speed");
            double visibility = currentWeatherJson.getInt("visibility") / 1000.0; // Convert to km

            List<WeatherData.ForecastItem> forecast = new ArrayList<>();
            JSONArray forecastList = forecastJson.getJSONArray("list");
            for (int i = 0; i < 5; i++) {
                JSONObject forecastItem = forecastList.getJSONObject(i);
                String time = forecastItem.getString("dt_txt");
                double forecastTemp = forecastItem.getJSONObject("main").getDouble("temp");
                String forecastDescription = forecastItem.getJSONArray("weather").getJSONObject(0).getString("description");
                forecast.add(new WeatherData.ForecastItem(time, forecastTemp, forecastDescription));
            }

            // Parse AQI
            int aqi = aqiJson.getJSONArray("list").getJSONObject(0).getJSONObject("main").getInt("aqi");

            // Remove pressure from the constructor call
            return new WeatherData(city, temperature, description, humidity, windSpeed, visibility, aqi, forecast);
        }
    }
}

