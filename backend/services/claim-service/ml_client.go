package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var mlHTTPClient = &http.Client{Timeout: 10 * time.Second}

// mlServiceCall is a generic POST helper to the FastAPI ML service.
// endpoint: e.g. "predict", "fraud/score", "payout/calculate"
func mlServiceCall(endpoint string, requestBody interface{}, result interface{}) error {
	baseURL := os.Getenv("ML_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8085"
	}

	body, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal ML request: %w", err)
	}

	resp, err := mlHTTPClient.Post(
		baseURL+"/"+endpoint,
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("ML service unreachable at %s/%s: %w", baseURL, endpoint, err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read ML response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("ML service returned HTTP %d: %s", resp.StatusCode, string(respBytes))
	}

	if err := json.Unmarshal(respBytes, result); err != nil {
		return fmt.Errorf("failed to parse ML response: %w", err)
	}

	return nil
}
