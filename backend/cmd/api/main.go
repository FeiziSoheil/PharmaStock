package main

import (
	"context"
	"os"

	"pharmastock/backend/cmd/api/bootstrap"
	"pharmastock/backend/internal/seed"
	"pharmastock/backend/pkg/config"
	"pharmastock/backend/pkg/logger"
)

func main() {
	log := logger.New()
	cfg := config.Load()
	ctx := context.Background()

	app, err := bootstrap.New(ctx, cfg, log)
	if err != nil {
		log.Error("bootstrap failed", "err", err)
		os.Exit(1)
	}

	if cfg.SeedOnStart {
		if err := seed.Run(ctx, app.Mongo.DB, cfg.DemoPassword); err != nil {
			log.Error("seed failed", "err", err)
			os.Exit(1)
		}
		log.Info("seed completed")
	}

	if err := app.Run(); err != nil {
		log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
