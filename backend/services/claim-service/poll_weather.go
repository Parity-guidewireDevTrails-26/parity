package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"kavach/pkg/models"
)


// ── Zone definitions — the zones Parity monitors in Delhi ────────────────────
type Zone struct {
	ID   string
	Name string
	Lat  float64
	Lng  float64
}

var MonitoredZones = []Zone{
	{ID: "DEL-SAKET-01", Name: "Saket, Delhi", Lat: 28.5274, Lng: 77.2167},
	{ID: "DEL-MALVIYA-01", Name: "Malviya Nagar, Delhi", Lat: 28.5355, Lng: 77.2158},
	{ID: "DEL-HAUZ-01", Name: "Hauz Khas, Delhi", Lat: 28.5621, Lng: 77.2041},
	{ID: "DEL-CONNAUGHT-01", Name: "Connaught Place, Delhi", Lat: 28.6315, Lng: 77.2167},
	{ID: "DEL-LAJPAT-01", Name: "Lajpat Nagar, Delhi", Lat: 28.5677, Lng: 77.2433},
}

// ── OpenWeatherMap response structs ─────────────────────────────────────────
type OWMWeather struct {
	Main struct {
		Temp     float64 `json:"temp"`
		Humidity float64 `json:"humidity"`
	} `json:"main"`
	Rain struct {
		OneHour float64 `json:"1h"`
	} `json:"rain"`
	Wind struct {
		Speed float64 `json:"speed"`
	} `json:"wind"`
	Weather []struct {
		Main        string `json:"main"`
		Description string `json:"description"`
	} `json:"weather"`
}

// ── TomTom Flow Segment response ─────────────────────────────────────────────
type TomTomFlowResp struct {
	FlowSegmentData struct {
		CurrentSpeed       float64 `json:"currentSpeed"`
		FreeFlowSpeed      float64 `json:"freeFlowSpeed"`
		CurrentTravelTime  int     `json:"currentTravelTime"`
		FreeFlowTravelTime int     `json:"freeFlowTravelTime"`
		Confidence         float64 `json:"confidence"`
	} `json:"flowSegmentData"`
}

// ── TomTom Incidents response ────────────────────────────────────────────────
type TomTomIncidentsResp struct {
	Incidents []struct {
		Type string `json:"type"`
		Properties struct {
			IconCategory int    `json:"iconCategory"`
			Delay        int    `json:"delay"`
			Magnitude    string `json:"magnitudeOfDelay"`
		} `json:"properties"`
	} `json:"incidents"`
}

var owmHTTPClient = &http.Client{Timeout: 8 * time.Second}

// ── fetchCurrentWeather calls OWM current weather API ────────────────────────
func fetchCurrentWeather(lat, lng float64) (*OWMWeather, error) {
	apiKey := os.Getenv("OWM_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OWM_API_KEY not set")
	}

	url := fmt.Sprintf(
		"https://api.openweathermap.org/data/2.5/weather?lat=%f&lon=%f&appid=%s&units=metric",
		lat, lng, apiKey,
	)

	resp, err := owmHTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("OWM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OWM HTTP %d: %s", resp.StatusCode, string(body))
	}

	var weather OWMWeather
	if err := json.NewDecoder(resp.Body).Decode(&weather); err != nil {
		return nil, fmt.Errorf("OWM decode error: %w", err)
	}
	return &weather, nil
}

// ── fetchTrafficFlow calls TomTom Flow Segment API ───────────────────────────
func fetchTrafficFlow(lat, lng float64) (*TomTomFlowResp, error) {
	apiKey := os.Getenv("TOMTOM_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("TOMTOM_API_KEY not set")
	}

	url := fmt.Sprintf(
		"https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=%f,%f&key=%s&unit=KMPH",
		lat, lng, apiKey,
	)

	resp, err := owmHTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("TomTom request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TomTom flow HTTP %d: %s", resp.StatusCode, string(body))
	}

	var flow TomTomFlowResp
	if err := json.NewDecoder(resp.Body).Decode(&flow); err != nil {
		return nil, fmt.Errorf("TomTom flow decode error: %w", err)
	}
	return &flow, nil
}

// ── fetchTrafficIncidents calls TomTom Incidents v5 with a bounding box ──────
func fetchTrafficIncidents(lat, lng float64) (*TomTomIncidentsResp, error) {
	apiKey := os.Getenv("TOMTOM_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("TOMTOM_API_KEY not set")
	}

	// ~3 km bounding box around the zone centre
	delta := 0.027
	bbox := fmt.Sprintf("%f,%f,%f,%f", lng-delta, lat-delta, lng+delta, lat+delta)

	url := fmt.Sprintf(
		"https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=%s&key=%s&fields={incidents{type,properties{iconCategory,delay,magnitudeOfDelay}}}&timeValidityFilter=present",
		bbox, apiKey,
	)

	resp, err := owmHTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("TomTom incidents request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TomTom incidents HTTP %d: %s", resp.StatusCode, string(body))
	}

	var incidents TomTomIncidentsResp
	if err := json.NewDecoder(resp.Body).Decode(&incidents); err != nil {
		return nil, fmt.Errorf("TomTom incidents decode error: %w", err)
	}
	return &incidents, nil
}

// ── saveParametricEvent stores a confirmed disruption event in Supabase ──────
func saveParametricEvent(cp *ClaimProcessor, eventType, zone string, severity, threshold float64) {
	// Check if we already triggered this event in the last 30 minutes (debounce)
	var count int
	debounceQuery := `
		SELECT COUNT(*) FROM parametric_events
		WHERE event_type = $1 AND zone = $2
		AND triggered_at > NOW() - INTERVAL '30 minutes'
		AND is_active = true
	`
	if err := cp.db.QueryRow(debounceQuery, eventType, zone).Scan(&count); err == nil && count > 0 {
		log.Printf("⏭️  [%s] %s already triggered recently — skipping", zone, eventType)
		return
	}

	// Compute probability score from ML service risk scorer
	probScore := 0.80 // default
	if eventType == "HEAVY_RAIN" {
		probScore = 0.90 + (severity-40.0)*0.002
		if probScore > 0.99 { probScore = 0.99 }
	} else if eventType == "MOBILITY_COLLAPSE" {
		probScore = 0.85
	} else if eventType == "HEAT_WAVE" {
		probScore = 0.75
	}

	insertQuery := `
		INSERT INTO parametric_events
			(event_type, zone, severity, threshold, probability_score, triggered_at, is_active)
		VALUES ($1, $2, $3, $4, $5, NOW(), true)
		RETURNING id
	`
	var eventID string
	err := cp.db.QueryRow(insertQuery, eventType, zone, severity, threshold, probScore).Scan(&eventID)
	if err != nil {
		log.Printf("❌ Failed to save parametric event [%s/%s]: %v", eventType, zone, err)
		return
	}

	log.Printf("🚨 Parametric event saved: %s in %s (severity=%.2f, id=%s)", eventType, zone, severity, eventID)

	// Trigger the claim processor for all active users in this zone
	event := &models.ParametricEvent{
		ID:          eventID,
		EventType:   eventType,
		Zone:        zone,
		Severity:    severity,
		Threshold:   threshold,
		TriggeredAt: time.Now(),
		IsActive:    true,
	}
	if err := cp.ProcessParametricEvent(event); err != nil {
		log.Printf("⚠️  ClaimProcessor error for event %s: %v", eventID, err)
	}

	// Deactivate zone_risk_scores cache and update with fresh score
	updateZoneRisk(cp, zone, severity, eventType)
}

// ── updateZoneRisk upserts a live risk score for the zone ────────────────────
func updateZoneRisk(cp *ClaimProcessor, zone string, severity float64, eventType string) {
	riskScore := 0.5
	switch eventType {
	case "HEAVY_RAIN":
		riskScore = 0.5 + (severity-40.0)*0.01
	case "HEAT_WAVE":
		riskScore = 0.6
	case "MOBILITY_COLLAPSE":
		riskScore = 0.7
	case "TRAFFIC_INCIDENT":
		riskScore = 0.55
	}
	if riskScore > 1.0 { riskScore = 1.0 }

	factors := fmt.Sprintf(`{"event":"%s","severity":%.2f,"updated_at":"%s"}`,
		eventType, severity, time.Now().Format(time.RFC3339))

	upsertQuery := `
		UPDATE zone_risk_scores
		SET risk_score = $1, contributing_factors = $2, calculated_at = NOW(), expires_at = NOW() + INTERVAL '1 hour'
		WHERE zone = $3
	`
	_, err := cp.db.Exec(upsertQuery, riskScore, factors, zone)
	if err != nil {
		log.Printf("⚠️  zone_risk_scores update failed for %s: %v", zone, err)
	}
}

// ── checkZone is the per-zone evaluation function ────────────────────────────
func checkZone(cp *ClaimProcessor, zone Zone) {
	log.Printf("🔄 Polling zone: %s (%.4f, %.4f)", zone.ID, zone.Lat, zone.Lng)

	// ── Weather check (OWM) ──
	weather, err := fetchCurrentWeather(zone.Lat, zone.Lng)
	if err != nil {
		log.Printf("⚠️  OWM error for %s: %v", zone.ID, err)
	} else {
		rain1h := weather.Rain.OneHour
		temp := weather.Main.Temp

		log.Printf("🌧️  %s — rain=%.1fmm, temp=%.1f°C", zone.ID, rain1h, temp)

		// Trigger: Heavy Rain > 40mm/h
		if rain1h > 40.0 {
			log.Printf("🚨 HEAVY_RAIN triggered in %s (%.1fmm)", zone.ID, rain1h)
			saveParametricEvent(cp, "HEAVY_RAIN", zone.ID, rain1h, 40.0)
		}

		// Trigger: Heat Wave > 45°C
		if temp > 45.0 {
			log.Printf("🚨 HEAT_WAVE triggered in %s (%.1f°C)", zone.ID, temp)
			saveParametricEvent(cp, "HEAT_WAVE", zone.ID, temp, 45.0)
		}
	}

	// ── Traffic flow check (TomTom) ──
	flow, err := fetchTrafficFlow(zone.Lat, zone.Lng)
	if err != nil {
		log.Printf("⚠️  TomTom flow error for %s: %v", zone.ID, err)
	} else {
		speed := flow.FlowSegmentData.CurrentSpeed
		freeFlow := flow.FlowSegmentData.FreeFlowSpeed
		log.Printf("🚗 %s — speed=%.1f km/h (free-flow=%.1f km/h)", zone.ID, speed, freeFlow)

		// Trigger: Mobility Collapse < 10 km/h
		if speed > 0 && speed < 10.0 {
			log.Printf("🚨 MOBILITY_COLLAPSE triggered in %s (%.1f km/h)", zone.ID, speed)
			saveParametricEvent(cp, "MOBILITY_COLLAPSE", zone.ID, speed, 10.0)
		}
	}

	// ── Traffic incidents check (TomTom Incidents v5) ──
	incidents, err := fetchTrafficIncidents(zone.Lat, zone.Lng)
	if err != nil {
		log.Printf("⚠️  TomTom incidents error for %s: %v", zone.ID, err)
	} else {
		// Count severe incidents (iconCategory 8–11 = major)
		severeCount := 0
		for _, inc := range incidents.Incidents {
			if inc.Properties.IconCategory >= 8 {
				severeCount++
			}
		}
		log.Printf("🚧 %s — incidents=%d (severe=%d)", zone.ID, len(incidents.Incidents), severeCount)

		if severeCount >= 3 {
			log.Printf("🚨 TRAFFIC_INCIDENT triggered in %s (%d severe)", zone.ID, severeCount)
			saveParametricEvent(cp, "TRAFFIC_INCIDENT", zone.ID, float64(severeCount), 3.0)
		}
	}
}

// ── SeedZoneRiskScoresDB ensures base zone data exists in the database ───────
func SeedZoneRiskScoresDB(cp *ClaimProcessor) {
	type zoneRow struct {
		ID       string
		Risk     float64
		Lat      float64
		Lng      float64
		RadiusKm float64
	}
	zones := []zoneRow{
		{"DEL-SAKET-01", 0.72, 28.5274, 77.2167, 3.0},
		{"DEL-MALVIYA-01", 0.85, 28.5355, 77.2158, 3.0},
		{"DEL-HAUZ-01", 0.65, 28.5621, 77.2041, 3.0},
		{"DEL-CONNAUGHT-01", 0.58, 28.6315, 77.2167, 3.0},
		{"DEL-LAJPAT-01", 0.70, 28.5677, 77.2433, 3.0},
	}

	for _, z := range zones {
		factors := fmt.Sprintf(`{"lat":%f,"lng":%f,"radius_km":%.1f}`, z.Lat, z.Lng, z.RadiusKm)
		query := `
			INSERT INTO zone_risk_scores (zone, risk_score, contributing_factors, calculated_at, expires_at)
			VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour')
			ON CONFLICT (zone) DO UPDATE
			SET expires_at = NOW() + INTERVAL '1 hour'
			WHERE zone_risk_scores.expires_at < NOW()
		`
		if _, err := cp.db.Exec(query, z.ID, z.Risk, factors); err != nil {
			log.Printf("⚠️  Seed zone_risk_scores for %s: %v", z.ID, err)
		}
	}
	log.Println("✅ Zone risk scores seeded")
}


// ── StartPoller launches the background polling goroutine ────────────────────
func StartPoller(cp *ClaimProcessor) {
	go func() {
		log.Println("🚀 Environment poller started — polling every 5 minutes")
		log.Printf("📍 Monitoring %d zones", len(MonitoredZones))

		// First poll immediately on startup
		for _, zone := range MonitoredZones {
			checkZone(cp, zone)
		}

		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			log.Printf("⏰ Poll tick at %s", time.Now().Format("15:04:05"))
			for _, zone := range MonitoredZones {
				go checkZone(cp, zone) // run zones concurrently for speed
			}
		}
	}()
}
