# Kavach: Phase 2 Architecture Deep-Dive

This document answers the core architectural and implementation questions for the "Unicorn-tier" Kavach Parametric Insurance Platform.

---

## 1. How can we implement Section 144 social disruption monitoring?

Monitoring Section 144 (unlawful assembly / curfews) requires a multi-layered, hybrid approach since it isn't always pushed to standard APIs immediately.

1. **Primary: Official Government / News OSINT APIs**
   - We must poll OSINT (Open Source Intelligence) providers or local news aggregator APIs (like Event Registry or Google News API) looking for keywords like `"Section 144" + "Delhi" + "Zone Name"`.
   - **Trigger:** If >3 reliable news sources report a curfew in a specific polygon, the system moves the zone to "High Risk" and primes the auto-claim engine.

2. **Secondary: Traffic API Anomalies (The Proxy)**
   - Section 144 usually results in road barricades. We monitor TomTom/Google Maps APIs. If average speed on arterial roads drops to **< 5 km/h** yet there is no reported accident or rain, it’s a high-probability social disruption proxy. 

3. **Tertiary: The Crowdsourced "Poll-Based" Back-stop**
   - If Raj reports a disruption manually, the Claim Service triggers **Pathway B**. 
   - A silent push notification is sent to 5–10 other active riders currently in the same 3km radius (fetched via Redis Geo queries).
   - They get a 1-tap poll: *"Are roads blocked in Saket Market right now? (Yes/No)"*
   - If **>60% say Yes**, the system trusts the aggregate gig-worker consensus and validates the Zone Event.

---

## 2. What fields are needed for OCR-validating income screenshots?

To establish the **Historical Income Profile**, riders upload screenshots from Swiggy/Zomato partner apps during onboarding. Our OCR pipeline (e.g., AWS Textract or GCP Vision) must reliably extract these exact fields to prevent fraud:

- **`Rider_Name`**: Must cross-check against the Aadhaar/KYC name provided to us.
- **`Platform_Logo / Watermark`**: To detect MS Paint/Photoshop alterations.
- **`Date_Range`**: (e.g., "Oct 12 - Oct 18"). We must ensure this is a recent, consecutive 7-day period.
- **`Total_Earnings`**: The final payout amount (e.g., ₹4,500).
- **`Total_Deliveries`**: Raw count of orders completed (e.g., 90).
- **`Active_Hours` / `Login_Hours`**: (e.g., "45 hrs").

*Calculated Baseline:* 
`avg_hourly_rate` = `Total_Earnings` / `Active_Hours`. 
Kavach caps the maximum insured rate at the 90th percentile of city averages to prevent inflated screenshots.

---

## 3. How should the Redis schema track live worker sessions?

Redis is the high-bandwidth backbone for live tracking, preventing "teleportation" fraud, and dynamic pricing calculations.

### Key Structure & TTL
- **Key Pattern:** `rider:session:<uuid>`
- **TTL (Time To Live):** 10 minutes (App heartbeats every 2 minutes. If the app goes offline, the key expires naturally, marking the rider as offline/out-of-zone).

### JSON Payload Schema
```json
{
  "user_id": "uuid",
  "current_zone": "Malviya_Nagar_Polygon",
  "latitude": 28.5355,
  "longitude": 77.2158,
  "prev_latitude": 28.5300,
  "prev_longitude": 77.2100,
  "last_seen_at": "timestamp",
  "prev_seen_at": "timestamp",
  "device_rooted": false,
  "is_emulator": false,
  "vpn_active": false
}
```

### The Speed-Up Location Anomaly Engine
Every time the mobile app pings the Go backend with a new lat/long, the backend:
1. Reads the `last_seen_at` and `latitude/longitude` from Redis.
2. Moves those to `prev_seen_at` and `prev_latitude/prev_longitude`.
3. Writes the new heartbeat data.

The **Fraud Model** calculates Haversine distance over Time (Δd / Δt). 
If Raj's phone reports moving 15 kilometers across Delhi in 3 minutes (implied speed = 300 km/h), the model detects a GPS spoofer. The claim is instantly flagged, and the trust score drops.
