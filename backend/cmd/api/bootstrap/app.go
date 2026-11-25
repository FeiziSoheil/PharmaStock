package bootstrap

import (
	"context"
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/auth"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/controlled"
	"pharmastock/backend/internal/dispensing"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/inventory"
	"pharmastock/backend/internal/receipt"
	"pharmastock/backend/internal/reconciliation"
	"pharmastock/backend/internal/reorder"
	"pharmastock/backend/internal/returns"
	"pharmastock/backend/internal/settings"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/internal/stocktake"
	"pharmastock/backend/internal/transfer"
	"pharmastock/backend/internal/ttac"
	"pharmastock/backend/internal/users"
	"pharmastock/backend/pkg/config"
	"pharmastock/backend/pkg/database"
	"pharmastock/backend/pkg/errormap"
	jwtpkg "pharmastock/backend/pkg/jwt"
)

type App struct {
	Echo   *echo.Echo
	Config config.Config
	Mongo  *database.Mongo
	Log    *slog.Logger
}

func New(ctx context.Context, cfg config.Config, log *slog.Logger) (*App, error) {
	mongo, err := database.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		return nil, err
	}

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errormap.HTTPErrorHandler
	e.Use(echomw.Recover())
	e.Use(echomw.RequestID())
	e.Use(echomw.Logger())
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: cfg.CORSOrigins,
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))

	jwtMgr := jwtpkg.NewManager(cfg.JWTSecret, cfg.JWTTTL)

	auditRepo := audit.NewRepository(mongo.DB)
	auditSvc := audit.NewService(auditRepo)
	auditH := audit.NewHandler(auditSvc)

	authRepo := auth.NewRepository(mongo.DB)
	authSvc := auth.NewService(authRepo, jwtMgr, auditSvc)
	authH := auth.NewHandler(authSvc)

	drugRepo := drug.NewRepository(mongo.DB)
	ttacClient := ttac.NewClient(cfg.TTACBaseURL, cfg.TTACTimeout)
	drugSvc := drug.NewService(drugRepo, auditSvc, ttacClient, cfg.TTACEnabled, 24*time.Hour)
	drugH := drug.NewHandler(drugSvc)

	shelfRepo := shelf.NewRepository(mongo.DB)
	shelfSvc := shelf.NewService(shelfRepo)
	shelfH := shelf.NewHandler(shelfSvc)

	cardexRepo := cardex.NewRepository(mongo.DB)
	cardexSvc := cardex.NewService(cardexRepo)
	cardexH := cardex.NewHandler(cardexSvc)

	expirySvc := expiry.NewService(shelfRepo, drugRepo, cardexSvc, auditSvc)
	expiryH := expiry.NewHandler(expirySvc)

	reorderRepo := reorder.NewRepository(mongo.DB)
	reorderSvc := reorder.NewService(drugRepo, shelfRepo, reorderRepo, auditSvc)
	reorderH := reorder.NewHandler(reorderSvc)

	controlledRepo := controlled.NewRepository(mongo.DB)
	controlledSvc := controlled.NewService(controlledRepo, drugRepo, shelfRepo, cardexSvc, auditSvc)
	controlledH := controlled.NewHandler(controlledSvc)

	receiptRepo := receipt.NewRepository(mongo.DB)
	receiptSvc := receipt.NewService(receiptRepo, drugRepo, expirySvc, shelfRepo, cardexSvc, auditSvc)
	receiptSvc.SetControlledLedger(controlledSvc)
	receiptH := receipt.NewHandler(receiptSvc)

	dispenseRepo := dispensing.NewRepository(mongo.DB)
	dispenseSvc := dispensing.NewService(dispenseRepo, drugRepo, shelfRepo, cardexSvc, auditSvc)
	dispenseSvc.SetControlledLedger(controlledSvc)
	dispenseH := dispensing.NewHandler(dispenseSvc)

	transferRepo := transfer.NewRepository(mongo.DB)
	transferSvc := transfer.NewService(transferRepo, shelfRepo, cardexSvc, auditSvc)
	transferH := transfer.NewHandler(transferSvc)

	stocktakeRepo := stocktake.NewRepository(mongo.DB)
	stocktakeSvc := stocktake.NewService(stocktakeRepo, shelfRepo, drugRepo, cardexSvc, auditSvc)
	stocktakeH := stocktake.NewHandler(stocktakeSvc)

	usersRepo := users.NewRepository(mongo.DB)
	usersSvc := users.NewService(usersRepo, auditSvc)
	usersH := users.NewHandler(usersSvc)

	reconcileRepo := reconciliation.NewRepository(mongo.DB)
	reconcileSvc := reconciliation.NewService(reconcileRepo, drugRepo, drugSvc, expirySvc, shelfRepo, cardexSvc, shelfRepo, receiptRepo, auditSvc)
	reconcileH := reconciliation.NewHandler(reconcileSvc)

	inventorySvc := inventory.NewService(drugRepo, shelfRepo, expirySvc, cardexSvc, auditSvc)
	inventoryH := inventory.NewHandler(inventorySvc)

	returnsRepo := returns.NewRepository(mongo.DB)
	returnsSvc := returns.NewService(returnsRepo, shelfRepo, drugRepo, cardexSvc, auditSvc)
	returnsH := returns.NewHandler(returnsSvc)

	settingsRepo := settings.NewRepository(mongo.DB)
	settingsSvc := settings.NewService(settingsRepo, auditSvc)
	settingsH := settings.NewHandler(settingsSvc)

	RegisterRoutes(e, Routes{
		JWT:            jwtMgr,
		Auth:           authH,
		Drug:           drugH,
		Shelf:          shelfH,
		Expiry:         expiryH,
		Reorder:        reorderH,
		Audit:          auditH,
		Cardex:         cardexH,
		Controlled:     controlledH,
		Receipt:        receiptH,
		Dispensing:     dispenseH,
		Transfer:       transferH,
		Stocktake:      stocktakeH,
		Users:          usersH,
		Reconciliation: reconcileH,
		Inventory:      inventoryH,
		Returns:        returnsH,
		Settings:       settingsH,
	})

	return &App{Echo: e, Config: cfg, Mongo: mongo, Log: log}, nil
}
