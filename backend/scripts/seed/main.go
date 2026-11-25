package main

import (
	"context"
	"fmt"
	"os"

	"pharmastock/backend/internal/seed"
	"pharmastock/backend/pkg/config"
	"pharmastock/backend/pkg/database"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()
	mongo, err := database.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		fmt.Fprintf(os.Stderr, "mongo: %v\n", err)
		os.Exit(1)
	}
	defer mongo.Close(ctx)
	if err := seed.Run(ctx, mongo.DB, cfg.DemoPassword); err != nil {
		fmt.Fprintf(os.Stderr, "seed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("seed ok")
}
