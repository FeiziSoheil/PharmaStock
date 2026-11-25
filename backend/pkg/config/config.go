package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr     string
	MongoURI     string
	MongoDB      string
	JWTSecret    string
	JWTTTL       time.Duration
	CORSOrigins  []string
	DemoPassword string
	SeedOnStart  bool
	TTACBaseURL  string
	TTACTimeout  time.Duration
	TTACEnabled  bool
}

func Load() Config {
	ttlHours := envInt("JWT_TTL_HOURS", 12)
	return Config{
		HTTPAddr:     env("HTTP_ADDR", ":8080"),
		MongoURI:     env("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:      env("MONGO_DB", "pharmastock"),
		JWTSecret:    env("JWT_SECRET", "dev-only-change-me"),
		JWTTTL:       time.Duration(ttlHours) * time.Hour,
		CORSOrigins:  splitCSV(env("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3001")),
		DemoPassword: env("DEMO_PASSWORD", "change-me-demo-only"),
		SeedOnStart:  envBool("SEED_ON_START", false),
		TTACBaseURL:  env("TTAC_BASE_URL", "https://newapi.ttac.ir"),
		TTACTimeout:  time.Duration(envInt("TTAC_TIMEOUT_MS", 5000)) * time.Millisecond,
		TTACEnabled:  envBool("TTAC_ENABLED", true),
	}
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envBool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
