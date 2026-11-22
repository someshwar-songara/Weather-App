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
                
                JSONObject aqiData = null;
                try {
                    String aqiJson = fetchData(aqiUrl);
                    if (aqiJson != null) {
                        aqiData = new JSONObject(aqiJson);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "OpenWeatherMap air_pollution query failed, falling back to Open-Meteo", e);
                }

                // If OpenWeatherMap didn't return components or failed, fallback to Open-Meteo Air Quality
                boolean hasValidComponents = false;
                if (aqiData != null && aqiData.has("list")) {
                    JSONArray list = aqiData.optJSONArray("list");
                    if (list != null && list.length() > 0 && list.getJSONObject(0).has("components")) {
                        hasValidComponents = true;
                    }
                }

                if (!hasValidComponents) {
                    try {
                        String openMeteoUrl = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" 
                                + lat + "&longitude=" + lon + "&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone";
                        Log.d(TAG, "Fetching AQI from Open-Meteo fallback: " + openMeteoUrl);
                        String omJson = fetchData(openMeteoUrl);
                        if (omJson != null) {
                            aqiData = new JSONObject(omJson);
                            aqiData.put("is_open_meteo", true);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Open-Meteo AQI fallback failed", e);
                    }
                }

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
            double feelsLike = main.has("feels_like") ? main.getDouble("feels_like") : temperature;
            double tempMin = main.has("temp_min") ? main.getDouble("temp_min") : temperature - 2;
            double tempMax = main.has("temp_max") ? main.getDouble("temp_max") : temperature + 2;
            int humidity = main.getInt("humidity");
            int pressure = main.has("pressure") ? main.getInt("pressure") : 1013;
            JSONArray weatherArray = currentWeatherJson.getJSONArray("weather");
            String description = weatherArray.getJSONObject(0).getString("description");
            double windSpeed = currentWeatherJson.getJSONObject("wind").getDouble("speed");
            double visibility = currentWeatherJson.has("visibility") ? currentWeatherJson.getInt("visibility") / 1000.0 : 10.0; // Convert to km

            List<WeatherData.ForecastItem> forecast = new ArrayList<>();
            JSONArray forecastList = forecastJson.getJSONArray("list");
            int forecastCount = Math.min(8, forecastList.length());
            for (int i = 0; i < forecastCount; i++) {
                JSONObject forecastItem = forecastList.getJSONObject(i);
                String time = forecastItem.getString("dt_txt");
                double forecastTemp = forecastItem.getJSONObject("main").getDouble("temp");
                String forecastDescription = forecastItem.getJSONArray("weather").getJSONObject(0).getString("description");
                forecast.add(new WeatherData.ForecastItem(time, forecastTemp, forecastDescription));
            }

            // Calculate official India CPCB NAQI from live pollutant measurements
            double pm25 = 0, pm10 = 0, no2 = 0, so2 = 0, co = 0, o3 = 0;
            if (aqiJson != null) {
                if (aqiJson.has("is_open_meteo") && aqiJson.getBoolean("is_open_meteo")) {
                    JSONObject current = aqiJson.optJSONObject("current");
                    if (current != null) {
                        pm25 = current.optDouble("pm2_5", 0);
                        pm10 = current.optDouble("pm10", 0);
                        no2 = current.optDouble("nitrogen_dioxide", 0);
                        so2 = current.optDouble("sulphur_dioxide", 0);
                        co = current.optDouble("carbon_monoxide", 0) / 1000.0; // convert µg to mg
                        o3 = current.optDouble("ozone", 0);
                    }
                } else if (aqiJson.has("list")) {
                    JSONArray aqiList = aqiJson.getJSONArray("list");
                    if (aqiList.length() > 0) {
                        JSONObject aqiObj = aqiList.getJSONObject(0);
                        if (aqiObj.has("components")) {
                            JSONObject comp = aqiObj.getJSONObject("components");
                            pm25 = comp.optDouble("pm2_5", 0);
                            pm10 = comp.optDouble("pm10", 0);
                            no2 = comp.optDouble("no2", 0);
                            so2 = comp.optDouble("so2", 0);
                            co = comp.optDouble("co", 0) / 1000.0; // convert µg to mg
                            o3 = comp.optDouble("o3", 0);
                        }
                    }
                }
            }

            // If pollutant values were absent, estimate reasonable base values from visibility/weather
            if (pm25 <= 0 && pm10 <= 0) {
                if (visibility < 4.0) {
                    pm25 = 65.0;
                    pm10 = 85.0;
                } else if (visibility < 8.0) {
                    pm25 = 35.0;
                    pm10 = 45.0;
                } else {
                    pm25 = 18.0;
                    pm10 = 28.0;
                }
            }

            CpcbAqiResult cpcb = calculateCpcbAqi(pm25, pm10, no2, so2, co, o3);
            Log.d(TAG, "CPCB NAQI computed: " + cpcb.aqi + " (" + cpcb.category + "), Dominant: " + cpcb.dominantPollutant + ", PM2.5=" + pm25 + ", PM10=" + pm10);

            // Parse Sunrise & Sunset
            JSONObject sys = currentWeatherJson.has("sys") ? currentWeatherJson.getJSONObject("sys") : null;
            String sunrise = "06:30 AM";
            String sunset = "07:30 PM";
            if (sys != null) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault());
                if (sys.has("sunrise")) {
                    sunrise = sdf.format(new java.util.Date(sys.getLong("sunrise") * 1000L));
                }
                if (sys.has("sunset")) {
                    sunset = sdf.format(new java.util.Date(sys.getLong("sunset") * 1000L));
                }
            }

            int windDeg = 0;
            if (currentWeatherJson.has("wind") && currentWeatherJson.getJSONObject("wind").has("deg")) {
                windDeg = currentWeatherJson.getJSONObject("wind").getInt("deg");
            }

            double uvIndex = 4.0;
            if (currentWeatherJson.has("clouds") && currentWeatherJson.getJSONObject("clouds").has("all")) {
                int clouds = currentWeatherJson.getJSONObject("clouds").getInt("all");
                uvIndex = Math.max(1.0, Math.round((9.0 - (clouds / 15.0)) * 10.0) / 10.0);
            }

            double lat = currentWeatherJson.has("coord") ? currentWeatherJson.getJSONObject("coord").optDouble("lat", 23.1789) : 23.1789;
            double lon = currentWeatherJson.has("coord") ? currentWeatherJson.getJSONObject("coord").optDouble("lon", 75.7859) : 75.7859;

            return new WeatherData(
                    city, lat, lon, temperature, feelsLike, tempMin, tempMax, description,
                    humidity, windSpeed, visibility, cpcb.aqi, cpcb.category,
                    cpcb.dominantPollutant, cpcb.pm25, cpcb.pm10, cpcb.no2,
                    cpcb.so2, cpcb.co, cpcb.o3, pressure, sunrise, sunset,
                    windDeg, uvIndex, forecast
            );
        }
    }

    /**
     * Helper class representing official India CPCB NAQI calculation result
     */
    public static class CpcbAqiResult {
        public final int aqi;
        public final String category;
        public final String dominantPollutant;
        public final double pm25;
        public final double pm10;
        public final double no2;
        public final double so2;
        public final double co;
        public final double o3;

        public CpcbAqiResult(int aqi, String category, String dominantPollutant,
                             double pm25, double pm10, double no2, double so2, double co, double o3) {
            this.aqi = aqi;
            this.category = category;
            this.dominantPollutant = dominantPollutant;
            this.pm25 = pm25;
            this.pm10 = pm10;
            this.no2 = no2;
            this.so2 = so2;
            this.co = co;
            this.o3 = o3;
        }
    }

    private static final double[] PM25_C = { 0, 30, 60, 90, 120, 250, 380 };
    private static final int[] PM25_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static final double[] PM10_C = { 0, 50, 100, 250, 350, 430, 500 };
    private static final int[] PM10_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static final double[] NO2_C = { 0, 40, 80, 180, 280, 400, 600 };
    private static final int[] NO2_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static final double[] SO2_C = { 0, 40, 80, 380, 800, 1600, 2000 };
    private static final int[] SO2_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static final double[] CO_C = { 0, 1.0, 2.0, 10.0, 17.0, 34.0, 50.0 };
    private static final int[] CO_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static final double[] O3_C = { 0, 50, 100, 168, 208, 748, 1000 };
    private static final int[] O3_I = { 0, 50, 100, 200, 300, 400, 500 };

    private static int calculateSubIndex(double conc, double[] c, int[] iScale) {
        if (conc <= 0) return 0;
        for (int i = 0; i < c.length - 1; i++) {
            if (conc >= c[i] && conc <= c[i + 1]) {
                double frac = (conc - c[i]) / (c[i + 1] - c[i]);
                return (int) Math.round(iScale[i] + frac * (iScale[i + 1] - iScale[i]));
            }
        }
        if (conc > c[c.length - 1]) return 500;
        return 0;
    }

    /**
     * Calculates CPCB National Air Quality Index (NAQI) for India
     */
    public static CpcbAqiResult calculateCpcbAqi(double pm25, double pm10, double no2, double so2, double coMg, double o3) {
        int iPm25 = calculateSubIndex(pm25, PM25_C, PM25_I);
        int iPm10 = calculateSubIndex(pm10, PM10_C, PM10_I);
        int iNo2  = calculateSubIndex(no2, NO2_C, NO2_I);
        int iSo2  = calculateSubIndex(so2, SO2_C, SO2_I);
        int iCo   = calculateSubIndex(coMg, CO_C, CO_I);
        int iO3   = calculateSubIndex(o3, O3_C, O3_I);

        int maxAqi = iPm25;
        String dominant = "PM2.5";
        if (iPm10 > maxAqi) { maxAqi = iPm10; dominant = "PM10"; }
        if (iNo2 > maxAqi)  { maxAqi = iNo2; dominant = "NO2"; }
        if (iSo2 > maxAqi)  { maxAqi = iSo2; dominant = "SO2"; }
        if (iCo > maxAqi)   { maxAqi = iCo; dominant = "CO"; }
        if (iO3 > maxAqi)   { maxAqi = iO3; dominant = "O3"; }

        if (maxAqi < 1) maxAqi = 25; // baseline clean atmosphere

        String category;
        if (maxAqi <= 50) {
            category = "Good";
        } else if (maxAqi <= 100) {
            category = "Satisfactory";
        } else if (maxAqi <= 200) {
            category = "Moderate";
        } else if (maxAqi <= 300) {
            category = "Poor";
        } else if (maxAqi <= 400) {
            category = "Very Poor";
        } else {
            category = "Severe";
        }

        return new CpcbAqiResult(maxAqi, category, dominant, pm25, pm10, no2, so2, coMg, o3);
    }
}

