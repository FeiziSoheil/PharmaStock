package bootstrap

import (
	"net/http"

	"github.com/labstack/echo/v4"

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
	"pharmastock/backend/internal/users"
	jwtpkg "pharmastock/backend/pkg/jwt"
	mw "pharmastock/backend/pkg/middleware"
)

type Routes struct {
	JWT            *jwtpkg.Manager
	Auth           *auth.Handler
	Drug           *drug.Handler
	Shelf          *shelf.Handler
	Expiry         *expiry.Handler
	Reorder        *reorder.Handler
	Audit          *audit.Handler
	Cardex         *cardex.Handler
	Controlled     *controlled.Handler
	Receipt        *receipt.Handler
	Dispensing     *dispensing.Handler
	Transfer       *transfer.Handler
	Stocktake      *stocktake.Handler
	Users          *users.Handler
	Reconciliation *reconciliation.Handler
	Inventory      *inventory.Handler
	Returns        *returns.Handler
	Settings       *settings.Handler
}

func RegisterRoutes(e *echo.Echo, r Routes) {
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	api := e.Group("/api/v1")
	api.POST("/auth/login", r.Auth.Login)

	secured := api.Group("", mw.JWT(r.JWT))
	secured.GET("/auth/me", r.Auth.Me)
	secured.PATCH("/auth/me", r.Auth.UpdateMe)
	secured.POST("/auth/change-password", r.Auth.ChangePassword)

	secured.GET("/drugs", r.Drug.List)
	secured.GET("/drugs/:id", r.Drug.Get)
	secured.POST("/drugs", r.Drug.Create)
	secured.PUT("/drugs/:id", r.Drug.Update)
	secured.GET("/ttac/lookup", r.Drug.LookupTTAC)
	secured.GET("/ttac/search", r.Drug.SearchTTAC)
	secured.GET("/drugs/:id/cardex", r.Cardex.List)

	secured.GET("/shelves", r.Shelf.List)
	secured.GET("/shelves/:id", r.Shelf.Get)

	secured.GET("/expiry-batches", r.Expiry.List)
	secured.POST("/expiry-batches", r.Expiry.Create)
	secured.PATCH("/expiry-batches/:batchId/status", r.Expiry.UpdateStatus)
	secured.PATCH("/expiry-batches/:batchId/location", r.Expiry.UpdateLocation)

	secured.GET("/reorder-suggestions", r.Reorder.List)
	secured.GET("/reorder-suggestions/settings", r.Reorder.GetSettings)
	secured.PUT("/reorder-suggestions/settings", r.Reorder.UpdateSettings)
	secured.POST("/reorder-suggestions/export", r.Reorder.Export)
	secured.POST("/reorder-suggestions/draft", r.Reorder.Draft)
	secured.POST("/reorder-suggestions/dismiss", r.Reorder.Dismiss)
	secured.GET("/purchase-orders", r.Reorder.ListOrders)
	secured.PATCH("/purchase-orders/:id/status", r.Reorder.UpdateOrderStatus)
	secured.GET("/purchase-orders/:id/export", r.Reorder.ExportOrder)

	secured.GET("/audit-events", r.Audit.List)
	secured.GET("/audit-events/export", r.Audit.Export)

	secured.GET("/controlled-ledger", r.Controlled.List)
	secured.POST("/controlled-ledger", r.Controlled.Create)
	secured.GET("/controlled-ledger/export", r.Controlled.Export)

	secured.POST("/receipts", r.Receipt.Create)
	secured.GET("/receipts", r.Receipt.List)
	secured.GET("/receipts/:id", r.Receipt.Get)
	secured.PATCH("/receipts/:id", r.Receipt.Patch)
	secured.POST("/receipts/:id/lines", r.Receipt.AddLine)
	secured.PATCH("/receipts/:id/lines/:lineId", r.Receipt.PatchLine)
	secured.DELETE("/receipts/:id/lines/:lineId", r.Receipt.DeleteLine)
	secured.POST("/receipts/:id/confirm", r.Receipt.Confirm)

	secured.GET("/dispenses/fefo-preview", r.Dispensing.FEFOPreview)
	secured.POST("/dispenses", r.Dispensing.Create)
	secured.GET("/dispenses", r.Dispensing.List)
	secured.GET("/dispenses/:id", r.Dispensing.Get)
	secured.PATCH("/dispenses/:id", r.Dispensing.Patch)
	secured.POST("/dispenses/:id/lines", r.Dispensing.AddLine)
	secured.PATCH("/dispenses/:id/lines/:lineId", r.Dispensing.PatchLine)
	secured.DELETE("/dispenses/:id/lines/:lineId", r.Dispensing.DeleteLine)
	secured.POST("/dispenses/:id/clear-lines", r.Dispensing.ClearLines)
	secured.POST("/dispenses/:id/confirm", r.Dispensing.Confirm)

	secured.POST("/transfers", r.Transfer.Create)
	secured.GET("/transfers", r.Transfer.List)
	secured.GET("/transfers/:id", r.Transfer.Get)
	secured.PATCH("/transfers/:id", r.Transfer.Patch)
	secured.POST("/transfers/:id/lines", r.Transfer.AddLine)
	secured.PATCH("/transfers/:id/lines/:lineId", r.Transfer.PatchLine)
	secured.DELETE("/transfers/:id/lines/:lineId", r.Transfer.DeleteLine)
	secured.POST("/transfers/:id/clear-lines", r.Transfer.ClearLines)
	secured.POST("/transfers/:id/confirm", r.Transfer.Confirm)

	secured.GET("/stocktakes", r.Stocktake.List)
	secured.POST("/stocktakes", r.Stocktake.Create)
	secured.GET("/stocktakes/:id", r.Stocktake.Get)
	secured.PATCH("/stocktakes/:id", r.Stocktake.Patch)
	secured.PATCH("/stocktakes/:id/items/:itemId", r.Stocktake.RecordItem)
	secured.POST("/stocktakes/:id/confirm", r.Stocktake.Confirm)
	secured.GET("/stocktakes/:id/export", r.Stocktake.Export)

	secured.GET("/users", r.Users.List)
	secured.GET("/users/:id", r.Users.Get)
	secured.POST("/users", r.Users.Create)
	secured.PATCH("/users/:id", r.Users.Update)
	secured.PATCH("/users/:id/status", r.Users.UpdateStatus)
	secured.PUT("/users/:id/permissions", r.Users.UpdatePermissions)
	secured.POST("/users/:id/reset-password", r.Users.ResetPassword)
	secured.GET("/rbac/matrix", r.Users.GetMatrix)
	secured.PUT("/rbac/matrix", r.Users.UpdateMatrix)

	secured.GET("/inventory/dashboard", r.Inventory.Dashboard)
	secured.GET("/inventory/export", r.Inventory.Export)
	secured.POST("/inventory/stock-in", r.Inventory.StockIn)
	secured.POST("/inventory/bulk-status", r.Inventory.BulkStatus)

	secured.GET("/reconciliations/template", r.Reconciliation.Template)
	secured.POST("/reconciliations/upload", r.Reconciliation.Upload)
	secured.GET("/reconciliations", r.Reconciliation.List)
	secured.GET("/reconciliations/:id", r.Reconciliation.Get)
	secured.PATCH("/reconciliations/:id", r.Reconciliation.Patch)
	secured.PATCH("/reconciliations/:id/mapping", r.Reconciliation.UpdateMapping)
	secured.POST("/reconciliations/:id/rematch", r.Reconciliation.Rematch)
	secured.PATCH("/reconciliations/:id/rows/:rowId", r.Reconciliation.PatchRow)
	secured.DELETE("/reconciliations/:id/rows/:rowId", r.Reconciliation.DeleteRow)
	secured.POST("/reconciliations/:id/confirm", r.Reconciliation.Confirm)

	secured.GET("/returns/eligible", r.Returns.Eligible)
	secured.POST("/returns", r.Returns.Create)
	secured.GET("/returns", r.Returns.List)
	secured.GET("/returns/:id", r.Returns.Get)
	secured.POST("/returns/:id/confirm", r.Returns.Confirm)
	secured.POST("/returns/:id/settle", r.Returns.Settle)

	if r.Settings != nil {
		secured.GET("/settings", r.Settings.Get)
		secured.PUT("/settings", r.Settings.Update)
		secured.POST("/settings/test-ttac", r.Settings.TestTTAC)
	}
}
