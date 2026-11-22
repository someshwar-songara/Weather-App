package com.example.weatherapp;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.drawable.AnimatedVectorDrawable;
import android.graphics.drawable.Drawable;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

public class MainActivity extends AppCompatActivity implements WeatherAPIClient.WeatherDataCallback, LocationListener {
    private static final String TAG = "MainActivity";
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1000;
    private static final int LOCATION_TIMEOUT = 10000; // 10 seconds

    private TextView tvLocation, tvTemperature, tvWeatherDescription, tvFeelsLikeAndHighLow, tvWindSpeed, tvHumidity, tvAqi, tvVisibility, tvPressure;
    private TextView tvUvIndex, tvSunTimes, tvWindDirection, tvWeatherAlertText;
    private View llWeatherAlert;
    private ImageView ivWeatherIcon, ivAqiIcon;
    private View clWeatherBg;
    private TextInputEditText etCitySearch;
    private TextInputLayout tilCitySearch;
    private RecyclerView rvForecast;
    private WeatherAPIClient weatherAPIClient;
    private ProgressDialog progressDialog;
    private LocationManager locationManager;
    private Handler locationTimeoutHandler;
    private DrawerLayout drawerLayout;
    private ImageButton ibMenu;
    private Button btnCheckForUpdates, btnUpdateApp;
    private TextView tvUpdateStatus;
    private SwipeRefreshLayout swipeRefreshLayout;
    private WebView webView3D;
    private WeatherData currentWeatherData;
    private int menuIconRes = R.drawable.ic_menu_colorful;
    private int closeIconRes = R.drawable.ic_close;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_weather_main);
        initViews();
        setupListeners();
        setupDrawerListener();
        weatherAPIClient = new WeatherAPIClient();
        requestLocationPermission();
    }

    private void initViews() {
        tvLocation = findViewById(R.id.tvLocation);
        tvTemperature = findViewById(R.id.tvTemperature);
        tvWeatherDescription = findViewById(R.id.tvWeatherDescription);
        tvFeelsLikeAndHighLow = findViewById(R.id.tvFeelsLikeAndHighLow);
        tvWindSpeed = findViewById(R.id.tvWindSpeed);
        tvHumidity = findViewById(R.id.tvHumidity);
        tvAqi = findViewById(R.id.tvAqi);
        tvVisibility = findViewById(R.id.tvVisibility);
        tvPressure = findViewById(R.id.tvPressure);
        tvUvIndex = findViewById(R.id.tvUvIndex);
        tvSunTimes = findViewById(R.id.tvSunTimes);
        tvWindDirection = findViewById(R.id.tvWindDirection);
        llWeatherAlert = findViewById(R.id.llWeatherAlert);
        tvWeatherAlertText = findViewById(R.id.tvWeatherAlertText);
        ivWeatherIcon = findViewById(R.id.ivWeatherIcon);
        ivAqiIcon = findViewById(R.id.ivAqiIcon);
        clWeatherBg = findViewById(R.id.clWeatherBg);
        etCitySearch = findViewById(R.id.etCitySearch);
        tilCitySearch = findViewById(R.id.tilCitySearch);
        rvForecast = findViewById(R.id.rvForecast);
        drawerLayout = findViewById(R.id.drawerLayout);
        ibMenu = findViewById(R.id.ibMenu);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);

        // Initialize sliding menu buttons
        btnCheckForUpdates = findViewById(R.id.btnCheckForUpdates);
        btnUpdateApp = findViewById(R.id.btnUpdateApp);
        tvUpdateStatus = findViewById(R.id.tvUpdateStatus);

        initWebView3D();
    }

    private void setupListeners() {
        tilCitySearch.setEndIconOnClickListener(v -> performSearch());
        etCitySearch.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                performSearch();
                return true;
            }
            return false;
        });

        ibMenu.setOnClickListener(v -> toggleMenu());

        btnCheckForUpdates.setOnClickListener(v -> checkForUpdates());
        btnUpdateApp.setOnClickListener(v -> updateApp());

        swipeRefreshLayout.setOnRefreshListener(this::refreshWeatherData);
        swipeRefreshLayout.setColorSchemeResources(R.color.md_primary, R.color.weather_cloud, R.color.weather_rain);
    }

    private void toggleMenu() {
        if (drawerLayout.isDrawerOpen(GravityCompat.END)) {
            drawerLayout.closeDrawer(GravityCompat.END);
            ibMenu.setImageResource(menuIconRes);
        } else {
            drawerLayout.openDrawer(GravityCompat.END);
            ibMenu.setImageResource(closeIconRes);
        }
    }

    private void performSearch() {
        String city = etCitySearch.getText().toString().trim();
        if (!city.isEmpty()) {
            showProgressDialog("Searching for " + city);
            weatherAPIClient.getWeatherData(city, this);
            hideKeyboard();
        } else {
            Toast.makeText(this, "Please enter a city name", Toast.LENGTH_SHORT).show();
        }
    }

    private void refreshWeatherData() {
        if (tvLocation.getText().toString().isEmpty()) {
            getLocation();
        } else {
            weatherAPIClient.getWeatherData(tvLocation.getText().toString(), this);
        }

        new Handler().postDelayed(() -> {
            if (swipeRefreshLayout.isRefreshing()) {
                swipeRefreshLayout.setRefreshing(false);
            }
        }, 2000);
    }

    private void checkForUpdates() {
        // Implement check for updates logic here
        Toast.makeText(this, "Checking for updates...", Toast.LENGTH_SHORT).show();
        tvUpdateStatus.setText("Checking for updates...");
        // Simulating update check
        new Handler().postDelayed(() -> {
            tvUpdateStatus.setText("Current version: 1.0 (Up to date)");
        }, 2000);
    }

    private void updateApp() {
        // Implement update app logic here
        Toast.makeText(this, "Updating app...", Toast.LENGTH_SHORT).show();
        tvUpdateStatus.setText("Updating app...");
        // Simulating update process
        new Handler().postDelayed(() -> {
            tvUpdateStatus.setText("Current version: 1.1 (Latest)");
        }, 3000);
    }

    private void updateAqiDisplay(int aqi) {
        updateAqiDisplay(aqi, null);
    }

    private void updateAqiDisplay(int aqi, String category) {
        String aqiDescription;
        int aqiColor;

        if (aqi <= 50) {
            aqiDescription = "Good";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_good);
        } else if (aqi <= 100) {
            aqiDescription = "Satisfactory";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_satisfactory);
        } else if (aqi <= 200) {
            aqiDescription = "Moderate";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_moderate);
        } else if (aqi <= 300) {
            aqiDescription = "Poor";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_poor);
        } else if (aqi <= 400) {
            aqiDescription = "Very Poor";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_very_poor);
        } else {
            aqiDescription = "Severe";
            aqiColor = ContextCompat.getColor(this, R.color.aqi_severe);
        }

        if (category != null && !category.isEmpty()) {
            aqiDescription = category;
        }

        tvAqi.setText(String.format(java.util.Locale.getDefault(), "%d · %s", aqi, aqiDescription));
        tvAqi.setTextColor(aqiColor);
        if (ivAqiIcon != null) {
            ivAqiIcon.setColorFilter(aqiColor);
        }
    }

    @Override
    public void onWeatherDataReceived(WeatherData weatherData) {
        dismissProgressDialog();
        try {
            tvLocation.setText(weatherData.getCity());
            tvTemperature.setText(String.format("%.0f°", weatherData.getTemperature()));
            String description = weatherData.getDescription();
            tvWeatherDescription.setText(capitalize(description));
            
            if (tvFeelsLikeAndHighLow != null) {
                tvFeelsLikeAndHighLow.setText(String.format("Feels like %.0f° · H: %.0f°  L: %.0f°",
                        weatherData.getFeelsLike(), weatherData.getTempMax(), weatherData.getTempMin()));
            }

            tvWindSpeed.setText(String.format("%.1f km/h", weatherData.getWindSpeed() * 3.6));
            tvHumidity.setText(String.format("%d%%", weatherData.getHumidity()));
            updateAqiDisplay(weatherData.getAqi(), weatherData.getAqiCategory());
            tvVisibility.setText(String.format("%.1f km", weatherData.getVisibility()));

            if (tvPressure != null) {
                tvPressure.setText(String.format("%d hPa", weatherData.getPressure()));
            }

            if (tvUvIndex != null) {
                double uv = weatherData.getUvIndex();
                String uvLevel;
                if (uv <= 2) uvLevel = "Low";
                else if (uv <= 5) uvLevel = "Moderate";
                else if (uv <= 7) uvLevel = "High";
                else uvLevel = "Very High";
                tvUvIndex.setText(String.format(java.util.Locale.getDefault(), "%.1f · %s", uv, uvLevel));
            }

            if (tvSunTimes != null) {
                tvSunTimes.setText(String.format("Sunrise: %s · Sunset: %s", weatherData.getSunrise(), weatherData.getSunset()));
            }

            if (tvWindDirection != null) {
                int deg = weatherData.getWindDeg();
                String[] directions = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};
                int idx = (int) Math.round(((deg % 360) / 45.0)) % 8;
                tvWindDirection.setText(String.format("Wind · %s (%d°)", directions[idx], deg));
            }

            if (llWeatherAlert != null && tvWeatherAlertText != null) {
                double windKmh = weatherData.getWindSpeed() * 3.6;
                String desc = weatherData.getDescription().toLowerCase();
                if (windKmh > 35) {
                    llWeatherAlert.setVisibility(View.VISIBLE);
                    tvWeatherAlertText.setText(String.format(java.util.Locale.getDefault(), "High Wind Advisory: Gusts up to %.0f km/h", windKmh));
                } else if (desc.contains("thunder") || desc.contains("storm")) {
                    llWeatherAlert.setVisibility(View.VISIBLE);
                    tvWeatherAlertText.setText("Thunderstorm Warning: Severe conditions detected");
                } else if (desc.contains("rain") || desc.contains("drizzle")) {
                    llWeatherAlert.setVisibility(View.VISIBLE);
                    tvWeatherAlertText.setText("Precipitation Alert: Wet surface conditions");
                } else {
                    llWeatherAlert.setVisibility(View.GONE);
                }
            }

            updateWeatherIconAndBackground(description);
            updateForecast(weatherData.getForecast());

            this.currentWeatherData = weatherData;
            pushWeatherDataToWeb();

            Log.d(TAG, "onWeatherDataReceived: UI updated successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error in onWeatherDataReceived: ", e);
            showErrorDialog("Error updating weather data: " + e.getMessage());
        }
    }

    private String capitalize(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    private void updateWeatherIconAndBackground(String description) {
        String desc = description.toLowerCase();
        int iconResId;
        int bgResId;

        if (desc.contains("clear") || desc.contains("sunny")) {
            iconResId = R.drawable.anim_sunny;
            bgResId = R.drawable.bg_weather_sunny;
        } else if (desc.contains("cloud")) {
            iconResId = R.drawable.anim_cloudy;
            bgResId = R.drawable.bg_weather_cloudy;
        } else if (desc.contains("rain") || desc.contains("drizzle") || desc.contains("thunder")) {
            iconResId = R.drawable.anim_rainy;
            bgResId = R.drawable.bg_weather_rainy;
        } else if (desc.contains("snow") || desc.contains("ice")) {
            iconResId = R.drawable.anim_snowy;
            bgResId = R.drawable.bg_weather_snowy;
        } else {
            iconResId = R.drawable.anim_cloudy;
            bgResId = R.drawable.bg_weather_sunny;
        }

        ivWeatherIcon.setImageResource(iconResId);
        Drawable drawable = ivWeatherIcon.getDrawable();
        if (drawable instanceof AnimatedVectorDrawable) {
            ((AnimatedVectorDrawable) drawable).start();
        }

        if (clWeatherBg != null) {
            clWeatherBg.setBackgroundResource(bgResId);
        }
    }

    private void updateForecast(List<WeatherData.ForecastItem> forecast) {
        ForecastAdapter adapter = new ForecastAdapter(forecast);
        rvForecast.setAdapter(adapter);
    }

    @Override
    public void onError(String error) {
        dismissProgressDialog();
        showErrorDialog("Error: " + error);
    }

    private void showProgressDialog(String message) {
        dismissProgressDialog();
        progressDialog = new ProgressDialog(this);
        progressDialog.setMessage(message);
        progressDialog.setCancelable(false);
        progressDialog.show();
    }

    private void dismissProgressDialog() {
        if (progressDialog != null && progressDialog.isShowing()) {
            progressDialog.dismiss();
        }
    }

    private void showErrorDialog(String message) {
        new AlertDialog.Builder(this)
                .setTitle("Error")
                .setMessage(message)
                .setPositiveButton("OK", (dialog, which) -> dialog.dismiss())
                .show();
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null && getCurrentFocus() != null) {
            imm.hideSoftInputFromWindow(getCurrentFocus().getWindowToken(), 0);
        }
    }

    private void requestLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_PERMISSION_REQUEST_CODE);
        } else {
            getLocation();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                getLocation();
            } else {
                Toast.makeText(this, "Location permission denied. Using default location.", Toast.LENGTH_SHORT).show();
                getWeatherForDefaultLocation();
            }
        }
    }

    private void getLocation() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager != null) {
                if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    showProgressDialog("Getting location...");
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 5, this);
                    Location location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    if (location != null) {
                        onLocationChanged(location);
                    } else {
                        startLocationTimeout();
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting location: ", e);
            showErrorDialog("Error getting location. Using default location.");
            getWeatherForDefaultLocation();
        }
    }

    private void startLocationTimeout() {
        locationTimeoutHandler = new Handler();
        locationTimeoutHandler.postDelayed(() -> {
            locationManager.removeUpdates(this);
            showErrorDialog("Unable to get location. Using default location.");
            getWeatherForDefaultLocation();
        }, LOCATION_TIMEOUT);
    }

    private void stopLocationTimeout() {
        if (locationTimeoutHandler != null) {
            locationTimeoutHandler.removeCallbacksAndMessages(null);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        stopLocationTimeout();
        locationManager.removeUpdates(this);
        if (isNetworkAvailable()) {
            showProgressDialog("Fetching weather data...");
            weatherAPIClient.getWeatherData(location.getLatitude(), location.getLongitude(), this);
        } else {
            showErrorDialog("No internet connection. Please check your network settings.");
        }
    }

    private void getWeatherForDefaultLocation() {
        showProgressDialog("Fetching weather data for default location...");
        weatherAPIClient.getWeatherData("New York", this);
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager != null) {
            NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
            return activeNetworkInfo != null && activeNetworkInfo.isConnected();
        }
        return false;
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        stopLocationTimeout();
    }

    private void setupDrawerListener() {
        drawerLayout.addDrawerListener(new DrawerLayout.SimpleDrawerListener() {
            @Override
            public void onDrawerStateChanged(int newState) {
                if (newState == DrawerLayout.STATE_IDLE) {
                    if (drawerLayout.isDrawerOpen(GravityCompat.END)) {
                        ibMenu.setImageResource(closeIconRes);
                    } else {
                        ibMenu.setImageResource(menuIconRes);
                    }
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView3D() {
        webView3D = findViewById(R.id.webView3D);
        if (webView3D != null) {
            WebSettings webSettings = webView3D.getSettings();
            webSettings.setJavaScriptEnabled(true);
            webSettings.setDomStorageEnabled(true);
            webSettings.setAllowFileAccess(true);
            webSettings.setAllowContentAccess(true);
            webSettings.setLoadsImagesAutomatically(true);
            webSettings.setMediaPlaybackRequiresUserGesture(false);
            webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
            webSettings.setUseWideViewPort(true);
            webSettings.setLoadWithOverviewMode(true);
            webSettings.setSupportZoom(false);
            webSettings.setBuiltInZoomControls(false);
            webSettings.setDisplayZoomControls(false);

            webView3D.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView3D.setBackgroundColor(0xFF080E1D);

            webView3D.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    Log.d("Weather3D_JS", consoleMessage.message() + " -- Line "
                            + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                    return true;
                }
            });

            webView3D.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    Log.d(TAG, "3D Weather Webview loaded: " + url);
                    pushWeatherDataToWeb();
                }
            });

            webView3D.addJavascriptInterface(new WeatherAppBridge(), "AndroidBridge");
            webView3D.loadUrl("file:///android_asset/weather3d/index.html");
        }
    }

    private void pushWeatherDataToWeb() {
        if (webView3D == null || currentWeatherData == null) return;
        try {
            JSONObject json = new JSONObject();
            json.put("city", currentWeatherData.getCity());
            json.put("lat", currentWeatherData.getLatitude());
            json.put("lon", currentWeatherData.getLongitude());
            json.put("temperature", currentWeatherData.getTemperature());
            json.put("feelsLike", currentWeatherData.getFeelsLike());
            json.put("tempMin", currentWeatherData.getTempMin());
            json.put("tempMax", currentWeatherData.getTempMax());
            json.put("description", currentWeatherData.getDescription());
            json.put("humidity", currentWeatherData.getHumidity());
            json.put("windSpeed", currentWeatherData.getWindSpeed());
            json.put("windDeg", currentWeatherData.getWindDeg());
            json.put("visibility", currentWeatherData.getVisibility());
            json.put("aqi", currentWeatherData.getAqi());
            json.put("aqiCategory", currentWeatherData.getAqiCategory());
            json.put("aqiProminent", currentWeatherData.getAqiProminentPollutant());
            json.put("pm25", currentWeatherData.getPm25());
            json.put("pm10", currentWeatherData.getPm10());
            json.put("no2", currentWeatherData.getNo2());
            json.put("so2", currentWeatherData.getSo2());
            json.put("co", currentWeatherData.getCo());
            json.put("o3", currentWeatherData.getO3());
            json.put("pressure", currentWeatherData.getPressure());
            json.put("sunrise", currentWeatherData.getSunrise());
            json.put("sunset", currentWeatherData.getSunset());
            json.put("uvIndex", currentWeatherData.getUvIndex());

            JSONArray forecastArray = new JSONArray();
            if (currentWeatherData.getForecast() != null) {
                for (WeatherData.ForecastItem item : currentWeatherData.getForecast()) {
                    JSONObject fItem = new JSONObject();
                    fItem.put("time", item.getTime());
                    fItem.put("temperature", item.getTemperature());
                    fItem.put("description", item.getDescription());
                    forecastArray.put(fItem);
                }
            }
            json.put("forecast", forecastArray);

            String script = "if (window.updateWeatherFromAndroid) { window.updateWeatherFromAndroid(" + json.toString() + "); }";
            runOnUiThread(() -> webView3D.evaluateJavascript(script, null));
        } catch (Exception e) {
            Log.e(TAG, "Error pushing data to 3D WebView", e);
        }
    }

    public class WeatherAppBridge {
        @JavascriptInterface
        public void searchCity(String city) {
            runOnUiThread(() -> {
                if (city != null && !city.trim().isEmpty()) {
                    if (etCitySearch != null) etCitySearch.setText(city);
                    showProgressDialog("Searching for " + city);
                    weatherAPIClient.getWeatherData(city.trim(), MainActivity.this);
                }
            });
        }

        @JavascriptInterface
        public void searchCoordinates(double lat, double lon, String cityName) {
            runOnUiThread(() -> {
                if (etCitySearch != null && cityName != null) etCitySearch.setText(cityName);
                showProgressDialog("Searching for " + (cityName != null ? cityName : "location"));
                weatherAPIClient.getWeatherData(lat, lon, MainActivity.this);
            });
        }

        @JavascriptInterface
        public void requestCurrentLocation() {
            runOnUiThread(() -> getLocation());
        }

        @JavascriptInterface
        public void toggleMenu() {
            runOnUiThread(() -> MainActivity.this.toggleMenu());
        }

        @JavascriptInterface
        public void onWebReady() {
            runOnUiThread(() -> pushWeatherDataToWeb());
        }
    }

    @Override
    public void onBackPressed() {
        if (drawerLayout != null && drawerLayout.isDrawerOpen(GravityCompat.END)) {
            drawerLayout.closeDrawer(GravityCompat.END);
        } else if (webView3D != null && webView3D.canGoBack()) {
            webView3D.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

