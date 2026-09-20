package com.example.weatherapp;

import android.graphics.PorterDuff;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ForecastAdapter extends RecyclerView.Adapter<ForecastAdapter.ForecastViewHolder> {
    private List<WeatherData.ForecastItem> forecast;

    public ForecastAdapter(List<WeatherData.ForecastItem> forecast) {
        this.forecast = forecast;
    }

    @NonNull
    @Override
    public ForecastViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_forecast, parent, false);
        return new ForecastViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ForecastViewHolder holder, int position) {
        WeatherData.ForecastItem item = forecast.get(position);

        holder.tvTime.setText(formatTime(item.getTime()));
        holder.tvForecastTemp.setText(String.format("%.0f°", item.getTemperature()));

        String description = item.getDescription();
        holder.tvForecastDesc.setText(capitalize(description));

        int iconRes = iconForDescription(description);
        holder.ivForecastIcon.setImageResource(iconRes);
        holder.ivForecastIcon.setColorFilter(
                ContextCompat.getColor(holder.itemView.getContext(), tintFor(iconRes)),
                PorterDuff.Mode.SRC_IN);
    }

    @Override
    public int getItemCount() {
        return forecast.size();
    }

    private String formatTime(String timeString) {
        try {
            SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
            SimpleDateFormat outputFormat = new SimpleDateFormat("h a", Locale.getDefault());
            Date date = inputFormat.parse(timeString);
            return outputFormat.format(date);
        } catch (Exception e) {
            Log.e("ForecastAdapter", "Error formatting time", e);
            return timeString; // Return original string if parsing fails
        }
    }

    private int iconForDescription(String description) {
        String d = description == null ? "" : description.toLowerCase(Locale.getDefault());
        if (d.contains("clear") || d.contains("sun")) {
            return R.drawable.ic_sunny;
        } else if (d.contains("cloud")) {
            return R.drawable.ic_cloudy;
        } else if (d.contains("rain") || d.contains("drizzle")) {
            return R.drawable.ic_rainy;
        } else if (d.contains("snow")) {
            return R.drawable.ic_snowy;
        }
        return R.drawable.ic_default;
    }

    private int tintFor(int iconRes) {
        if (iconRes == R.drawable.ic_sunny) {
            return R.color.weather_sun;
        } else if (iconRes == R.drawable.ic_cloudy) {
            return R.color.weather_cloud;
        } else if (iconRes == R.drawable.ic_rainy) {
            return R.color.weather_rain;
        } else if (iconRes == R.drawable.ic_snowy) {
            return R.color.weather_snow;
        } else {
            return R.color.weather_default;
        }
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    static class ForecastViewHolder extends RecyclerView.ViewHolder {
        TextView tvTime, tvForecastTemp, tvForecastDesc;
        ImageView ivForecastIcon;

        ForecastViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTime = itemView.findViewById(R.id.tvTime);
            tvForecastTemp = itemView.findViewById(R.id.tvForecastTemp);
            tvForecastDesc = itemView.findViewById(R.id.tvForecastDesc);
            ivForecastIcon = itemView.findViewById(R.id.ivForecastIcon);
        }
    }
}
