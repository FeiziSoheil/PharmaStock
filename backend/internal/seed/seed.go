package seed

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"

	"pharmastock/backend/internal/auth"
	"pharmastock/backend/internal/controlled"
	"pharmastock/backend/internal/dispensing"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/receipt"
	"pharmastock/backend/internal/reconciliation"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/internal/stocktake"
	"pharmastock/backend/internal/transfer"
	"pharmastock/backend/internal/users"
	"pharmastock/backend/pkg/validator"
)

// Run upserts demo data. Password is hashed at runtime from DEMO_PASSWORD (never stored plaintext).
func Run(ctx context.Context, db *mongo.Database, demoPassword string) error {
	if demoPassword == "" {
		return fmt.Errorf("demo password empty")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	branches := []auth.Branch{
		{ID: "branch-central", NameFa: "داروخانه مرکزی - انبار شماره ۱ (کاردکس کل)", Active: true},
		{ID: "branch-cold", NameFa: "انبار زنجیره سرد (واکسن و بیولوژیک)", Active: true},
		{ID: "branch-valiasr", NameFa: "واحد توزیع و بالینی شعبه ولیعصر", Active: true},
		{ID: "branch-er", NameFa: "ترالی اورژانس و اقلام حیاتی", Active: true},
	}
	for _, b := range branches {
		_, err := db.Collection("branches").UpdateByID(ctx, b.ID, bson.M{"$set": b}, upsert())
		if err != nil {
			return err
		}
	}

	now := time.Now().UTC()
	coreUsers := []auth.User{
		{
			ID: "user-operator", Username: "operator", Name: "اپراتور انبار",
			NameNorm: validator.NormalizeFa("اپراتور انبار"), Email: "operator@pharmastock.ir",
			Phone: "09121000001", PersonnelCode: "EMP-1001", Role: "warehouse_operator",
			BranchID: "branch-central", UnitLabel: "انبار مرکزی و قرنطینه دارویی",
			Status: "active", PasswordHash: string(hash), CreatedAt: now, UpdatedAt: now,
		},
		{
			ID: "user-locked", Username: "locked", Name: "حساب قفل",
			NameNorm: validator.NormalizeFa("حساب قفل"), Email: "locked@pharmastock.ir",
			PersonnelCode: "EMP-0000", Role: "warehouse_operator",
			BranchID: "branch-central", UnitLabel: "حساب مسدودشده",
			Status: "inactive", PasswordHash: string(hash), PermanentlyLocked: true, CreatedAt: now, UpdatedAt: now,
		},
	}
	for _, u := range coreUsers {
		_, err := db.Collection("users").UpdateByID(ctx, u.ID, bson.M{"$set": u}, upsert())
		if err != nil {
			return err
		}
	}

	rezaeiLogin := now.Add(-45 * time.Minute)
	kazemiLogin := now.Add(-18 * time.Hour)
	yazdaniLogin := now.Add(-20 * time.Minute)
	hosseiniLogin := now.Add(-90 * time.Minute)
	staffUsers := []auth.User{
		{
			ID: "user-rezaei", Username: "dr.rezaei", Name: "دکتر محمدرضا رضایی",
			NameNorm: validator.NormalizeFa("دکتر محمدرضا رضایی"), Email: "m.rezaei@pharmastock.ir",
			Phone: "09123456789", PersonnelCode: "د-۴۸۲۹۱", MedicalCouncilNo: "نظام پزشکی دائم",
			Role: "technical_officer", BranchID: "branch-central", UnitLabel: "داروخانه مرکزی (بخش بالینی)",
			Status: "active", PasswordHash: string(hash), LastLoginAt: &rezaeiLogin, LastLoginIP: "192.168.1.104",
			LastLoginDevice: "ایستگاه بالینی #۱", CreatedAt: now, UpdatedAt: now,
		},
		{
			ID: "user-kazemi", Username: "m.kazemi", Name: "مرتضی کاظمی",
			NameNorm: validator.NormalizeFa("مرتضی کاظمی"), Email: "m.kazemi@pharmastock.ir",
			Phone: "09124445566", PersonnelCode: "EMP-1038", Role: "warehouse_lead",
			BranchID: "branch-central", UnitLabel: "انبار مرکزی و قرنطینه دارویی",
			Status: "active", PasswordHash: string(hash), LastLoginAt: &kazemiLogin, LastLoginIP: "192.168.1.112",
			LastLoginDevice: "بارکدخوان بی‌سیم #۲", CreatedAt: now, UpdatedAt: now,
		},
		{
			ID: "user-yazdani", Username: "e.yazdani", Name: "الهام یزدانی",
			NameNorm: validator.NormalizeFa("الهام یزدانی"), Email: "e.yazdani@pharmastock.ir",
			Phone: "09127778899", PersonnelCode: "EMP-2054", Role: "dispensing_clerk",
			BranchID: "branch-valiasr", UnitLabel: "باجه پذیرش نسخ و بیمه تأمین",
			Status: "active", PasswordHash: string(hash), LastLoginAt: &yazdaniLogin, LastLoginIP: "192.168.1.120",
			LastLoginDevice: "ترمینال فروشگاه #۴", CreatedAt: now, UpdatedAt: now,
		},
		{
			ID: "user-hosseini", Username: "a.hosseini", Name: "مهندس آریا حسینی",
			NameNorm: validator.NormalizeFa("مهندس آریا حسینی"), Email: "a.hosseini@pharmastock.ir",
			Phone: "09120001122", PersonnelCode: "ADM-001", Role: "super_admin",
			BranchID: "branch-central", UnitLabel: "دفتر مدیریت و فناوری اطلاعات",
			Status: "active", PasswordHash: string(hash), LastLoginAt: &hosseiniLogin, LastLoginIP: "192.168.1.101",
			LastLoginDevice: "ورود دومرحله‌ای تأییدشده", CreatedAt: now, UpdatedAt: now,
		},
	}
	for _, u := range staffUsers {
		_, err := db.Collection("users").UpdateByID(ctx, u.ID, bson.M{"$setOnInsert": u}, upsert())
		if err != nil {
			return err
		}
	}

	defaultPolicy := users.MatrixPolicy{
		ID:        "default",
		Matrix:    users.DefaultMatrix(),
		UpdatedAt: now,
		UpdatedBy: "سیستم اولیه",
	}
	if _, err := db.Collection("rbac_policies").UpdateByID(ctx, "default", bson.M{"$setOnInsert": defaultPolicy}, upsert()); err != nil {
		return err
	}

	drugs := []drug.Drug{
		{
			ID: "drug-amox", NameFa: "آموکسی‌سیلین", BrandName: "Amoxil", DosageForm: "کپسول", Strength: "500mg",
			GTIN: "6260001000001", GenericCode: "12345", Manufacturer: "داروسازی فارابی", Category: "آنتی‌بیوتیک و ضدباکتری",
			ReorderLevel: 40, TargetStock: 120, PackSize: 10, AvgDailyUsage: 8, UnitCost: 45000,
			DistributorID: "daroupakhsh", LeadTimeDays: 5, UnitLabel: "عدد", StorageTemp: "room",
			NearestExpiry: "2026-12-01", TotalStock: 25, NameNorm: validator.NormalizeFa("آموکسی‌سیلین"),
		},
		{
			ID: "drug-insulin", NameFa: "انسولین قلمی", BrandName: "Lantus", DosageForm: "قلم تزریقی", Strength: "100IU/ml",
			GTIN: "6260001000002", GenericCode: "77881", Manufacturer: "سانوفی", Category: "دیابت و غدد",
			IsControlled: false, ReorderLevel: 20, TargetStock: 60, PackSize: 5, AvgDailyUsage: 3, UnitCost: 890000,
			DistributorID: "hejrat", LeadTimeDays: 7, UnitLabel: "قلم", StorageTemp: "fridge",
			NearestExpiry: "2026-11-20", TotalStock: 8, NameNorm: validator.NormalizeFa("انسولین قلمی"),
		},
		{
			ID: "drug-morphine", NameFa: "مورفین سولفات", BrandName: "Morphine", DosageForm: "آمپول", Strength: "10mg/ml",
			GTIN: "6260001000003", GenericCode: "99001", Manufacturer: "داروپخش", Category: "تحت کنترل / مخدر",
			IsControlled: true, ReorderLevel: 10, TargetStock: 30, PackSize: 5, AvgDailyUsage: 1, UnitCost: 120000,
			DistributorID: "razi", LeadTimeDays: 10, UnitLabel: "آمپول", StorageTemp: "room",
			NearestExpiry: "2027-03-01", TotalStock: 12, NameNorm: validator.NormalizeFa("مورفین سولفات"),
		},
		{
			ID: "drug-methadone", NameFa: "قرص متادون ۴۰ میلی‌گرم", BrandName: "Methadone", DosageForm: "قرص", Strength: "40mg",
			GTIN: "6260001000004", GenericCode: "99002", Manufacturer: "سها هلال", Category: "تحت کنترل / مخدر",
			IsControlled: true, ReorderLevel: 15, TargetStock: 60, PackSize: 10, AvgDailyUsage: 2, UnitCost: 65000,
			DistributorID: "daroupakhsh", LeadTimeDays: 7, UnitLabel: "قرص", StorageTemp: "room",
			NearestExpiry: "2027-05-01", TotalStock: 20, NameNorm: validator.NormalizeFa("قرص متادون ۴۰ میلی‌گرم"),
		},
		{
			ID: "drug-ritalin", NameFa: "قرص ریتالین (متیل‌فنیدات) ۱۰ میلی‌گرم", BrandName: "Ritalin", DosageForm: "قرص", Strength: "10mg",
			GTIN: "6260001000005", GenericCode: "99003", Manufacturer: "نووارتیس", Category: "تحت کنترل / مخدر",
			IsControlled: true, ReorderLevel: 15, TargetStock: 40, PackSize: 10, AvgDailyUsage: 2, UnitCost: 240000,
			DistributorID: "hejrat", LeadTimeDays: 10, UnitLabel: "قرص", StorageTemp: "room",
			NearestExpiry: "2027-04-15", TotalStock: 8, NameNorm: validator.NormalizeFa("قرص ریتالین (متیل‌فنیدات) ۱۰ میلی‌گرم"),
		},
	}
	for _, d := range drugs {
		_, err := db.Collection("drugs").UpdateByID(ctx, d.ID, bson.M{"$set": d}, upsert())
		if err != nil {
			return err
		}
	}

	amoxCacheID := drug.TTACCacheID("6260001000001001", "6260001000001")
	amoxRaw, err := bson.Marshal(drug.TtacCache{
		IRC: "6260001000001001", GTIN: "6260001000001", GenericCode: "12345",
		FetchedAt: time.Now().UTC(),
		Product: drug.TtacProduct{
			NameFa: "آموکسی‌سیلین", BrandName: "Amoxil", DosageForm: "کپسول", Strength: "500mg",
			GTIN: "6260001000001", IRC: "6260001000001001", GenericCode: "12345", Manufacturer: "داروسازی فارابی",
			ATCCode: "J01CA04", LicenseExpiry: "2028-01-01", Category: "آنتی‌بیوتیک و ضدباکتری",
		},
	})
	if err != nil {
		return err
	}
	var amoxDoc bson.M
	if err = bson.Unmarshal(amoxRaw, &amoxDoc); err != nil {
		return err
	}
	delete(amoxDoc, "_id")
	// Drop the legacy id before the canonical upsert. Unique sparse irc/gtin
	// indexes reject a second document that still holds the same values.
	if _, err = db.Collection("ttac_cache").DeleteOne(ctx, bson.M{"_id": "ttac-amox"}); err != nil {
		return err
	}
	if _, err = db.Collection("ttac_cache").UpdateByID(ctx, amoxCacheID, bson.M{"$set": amoxDoc}, upsert()); err != nil {
		return err
	}

	bins := []shelf.Bin{
		{ID: "bin-a030204", Zone: "A", ZoneLabel: "سالن اصلی A (داروهای روتین)", Rack: "03", Shelf: "2", Bin: "04", Address: "A-03-2-04", Capacity: 200, MacroLocation: "main"},
		{ID: "bin-c010101", Zone: "C", ZoneLabel: "پیشخوان تحویل نسخه", Rack: "01", Shelf: "1", Bin: "01", Address: "C-01-1-01", Capacity: 100, MacroLocation: "dispensing"},
		{ID: "bin-c010102", Zone: "C", ZoneLabel: "پیشخوان تحویل نسخه", Rack: "01", Shelf: "1", Bin: "02", Address: "C-01-1-02", Capacity: 100, MacroLocation: "dispensing"},
		{ID: "bin-r010101", Zone: "R", ZoneLabel: "اتاق سرد / زنجیره سرد", Rack: "01", Shelf: "1", Bin: "01", Address: "R-01-1-01", Capacity: 80, MacroLocation: "cold"},
		{ID: "bin-s010101", Zone: "S", ZoneLabel: "اتاق حفاظت‌شده (گاوصندوق)", Rack: "01", Shelf: "1", Bin: "01", Address: "S-01-1-01", Capacity: 40, IsControlled: true, MacroLocation: "controlled"},
		{ID: "bin-s010102", Zone: "S", ZoneLabel: "اتاق حفاظت‌شده (گاوصندوق)", Rack: "01", Shelf: "1", Bin: "02", Address: "S-01-1-02", Capacity: 40, IsControlled: true, MacroLocation: "controlled"},
	}
	for _, b := range bins {
		_, err := db.Collection("bins").UpdateByID(ctx, b.ID, bson.M{"$set": b}, upsert())
		if err != nil {
			return err
		}
	}

	batches := []shelf.StockBatch{
		{ID: "batch-amox-1", DrugID: "drug-amox", BinID: "bin-a030204", NameFa: "آموکسی‌سیلین", BatchNo: "AX-2401", Expiry: "2026-12-01", Quantity: 20, Status: "active", Zone: "A", LocationLabel: "A-03-2-04", Category: "آنتی‌بیوتیک و ضدباکتری", UnitLabel: "عدد", Manufacturer: "فارابی", Distributor: "داروپخش", ProductionISO: "2025-06-01", BuyPriceRial: 32000, ConsumerPriceRial: 45000},
		{ID: "batch-amox-2", DrugID: "drug-amox", BinID: "bin-a030204", NameFa: "آموکسی‌سیلین", BatchNo: "AX-2402", Expiry: "2027-06-01", Quantity: 5, Status: "active", Zone: "A", LocationLabel: "A-03-2-04", Category: "آنتی‌بیوتیک و ضدباکتری", UnitLabel: "عدد", ProductionISO: "2025-09-01", BuyPriceRial: 33000, ConsumerPriceRial: 46000},
		{ID: "batch-ins-1", DrugID: "drug-insulin", BinID: "bin-r010101", NameFa: "انسولین قلمی", BatchNo: "IN-110", Expiry: "2026-11-20", Quantity: 8, Status: "active", Zone: "R", LocationLabel: "R-01-1-01", Category: "دیابت و غدد", StorageNote: "۲–۸°C", UnitLabel: "قلم", ProductionISO: "2025-08-15", BuyPriceRial: 700000, ConsumerPriceRial: 890000},
		{ID: "batch-mor-1", DrugID: "drug-morphine", BinID: "bin-s010101", NameFa: "مورفین سولفات", BatchNo: "MR-09", Expiry: "2027-03-01", Quantity: 12, Status: "active", Zone: "S", LocationLabel: "S-01-1-01", Category: "تحت کنترل / مخدر", IsControlled: true, UnitLabel: "آمپول", ProductionISO: "2025-01-10", BuyPriceRial: 90000, ConsumerPriceRial: 120000},
		{ID: "batch-meth-1", DrugID: "drug-methadone", BinID: "bin-s010101", NameFa: "قرص متادون ۴۰ میلی‌گرم", BatchNo: "SH-9921M", Expiry: "2027-05-01", Quantity: 20, Status: "active", Zone: "S", LocationLabel: "S-01-1-01", Category: "تحت کنترل / مخدر", IsControlled: true, UnitLabel: "قرص", ProductionISO: "2025-03-01", BuyPriceRial: 48000, ConsumerPriceRial: 65000},
		{ID: "batch-rit-1", DrugID: "drug-ritalin", BinID: "bin-s010102", NameFa: "قرص ریتالین (متیل‌فنیدات) ۱۰ میلی‌گرم", BatchNo: "NV-77180", Expiry: "2027-04-15", Quantity: 8, Status: "active", Zone: "S", LocationLabel: "S-01-1-02", Category: "تحت کنترل / مخدر", IsControlled: true, UnitLabel: "قرص", ProductionISO: "2025-02-20", BuyPriceRial: 190000, ConsumerPriceRial: 240000},
	}
	for _, b := range batches {
		_, err := db.Collection("stock_batches").UpdateByID(ctx, b.ID, bson.M{"$set": b}, upsert())
		if err != nil {
			return err
		}
	}

	cardexN, err := db.Collection("cardex_movements").CountDocuments(ctx, bson.M{"drugId": "drug-amox"})
	if err != nil {
		return err
	}
	if cardexN == 0 {
		now := time.Now().UTC()
		seeds := []bson.M{
			{"_id": "cardex-amox-1", "drugId": "drug-amox", "timestamp": now.Add(-28 * 24 * time.Hour), "type": "inbound", "batchNo": "AX-2401", "qtyIn": 20, "qtyOut": 0, "actorName": "اپراتور انبار", "shiftLabel": "صبح", "note": "ورود فاکتور خرید INV-SEED-1001"},
			{"_id": "cardex-amox-2", "drugId": "drug-amox", "timestamp": now.Add(-20 * 24 * time.Hour), "type": "inbound", "batchNo": "AX-2402", "qtyIn": 5, "qtyOut": 0, "actorName": "اپراتور انبار", "shiftLabel": "صبح", "note": "ورود فاکتور خرید INV-SEED-1002"},
			{"_id": "cardex-amox-3", "drugId": "drug-amox", "timestamp": now.Add(-10 * 24 * time.Hour), "type": "outbound", "batchNo": "AX-2401", "qtyIn": 0, "qtyOut": 4, "actorName": "سارا حسینی", "shiftLabel": "عصر", "note": "خروج نسخه POS"},
			{"_id": "cardex-amox-4", "drugId": "drug-amox", "timestamp": now.Add(-2 * 24 * time.Hour), "type": "adjustment", "batchNo": "AX-2401", "qtyIn": 0, "qtyOut": 0, "actorName": "اپراتور انبار", "shiftLabel": "صبح", "note": "شمارش دوره‌ای"},
		}
		for _, doc := range seeds {
			if _, err := db.Collection("cardex_movements").InsertOne(ctx, doc); err != nil {
				return err
			}
		}
	}

	draftCount, err := db.Collection("invoice_receipts").CountDocuments(ctx, bson.M{"_id": "receipt-draft-seed"})
	if err != nil {
		return err
	}
	if draftCount == 0 {
		draftAt := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)
		draft := receipt.Receipt{
			ID: "receipt-draft-seed", Status: receipt.StatusDraft, CurrentStep: 3,
			Header: receipt.Header{
				InvoiceNo: "F-SEED-1", Distributor: "داروپخش", IssuedAt: "2026-11-01", ReceivedAt: "2026-11-02",
				WarehouseLabel: "مرکزی", PurchaseType: "official_ttac",
			},
			Lines: []receipt.Line{{
				ID: "line-seed-1", DrugID: "drug-amox", NameFa: "آموکسی‌سیلین", GTIN: "6260001000001",
				BatchNo: "AX-SEED", Expiry: "2027-12-01", Quantity: 10, UnitLabel: "عدد",
				BuyPriceRial: 32000, ConsumerPriceRial: 45000, LocationLabel: "A-03-2-04", BinID: "bin-a030204", Zone: "A",
			}},
			CreatedBy: receipt.CreatedBy{UserID: "user-operator", Name: "اپراتور انبار", Role: "warehouse_operator"},
			CreatedAt: draftAt, UpdatedAt: draftAt,
		}
		if _, err := db.Collection("invoice_receipts").InsertOne(ctx, draft); err != nil {
			return err
		}
	}

	dispenseCount, err := db.Collection("dispense_orders").CountDocuments(ctx, bson.M{"_id": "dispense-draft-seed"})
	if err != nil {
		return err
	}
	if dispenseCount == 0 {
		draftAt := time.Date(2026, 11, 1, 9, 0, 0, 0, time.UTC)
		order := dispensing.Order{
			ID: "dispense-draft-seed", Status: dispensing.StatusDraft,
			Patient: dispensing.Patient{NameFa: "بیمار نمونه"},
			Lines: []dispensing.Line{{
				ID: "dline-seed-1", DrugID: "drug-amox", NameFa: "آموکسی‌سیلین",
				UnitLabel: "عدد", Quantity: 2, ConsumerPrice: 45000,
				BatchID: "batch-amox-1", BatchNo: "AX-2401", Expiry: "2026-12-01",
				LocationLabel: "A-03-2-04", BinID: "bin-a030204", Allocation: dispensing.AllocationFEFO,
			}},
			Fees:      dispensing.Fees{TechnicalFee: 50000},
			CreatedBy: dispensing.CreatedBy{UserID: "user-operator", Name: "اپراتور انبار", Role: "warehouse_operator"},
			CreatedAt: draftAt, UpdatedAt: draftAt,
		}
		if _, err := db.Collection("dispense_orders").InsertOne(ctx, order); err != nil {
			return err
		}
	}

	transferCount, err := db.Collection("internal_transfers").CountDocuments(ctx, bson.M{"_id": "transfer-draft-seed"})
	if err != nil {
		return err
	}
	if transferCount == 0 {
		draftAt := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)
		tr := transfer.Transfer{
			ID:          "transfer-draft-seed",
			Status:      transfer.StatusDraft,
			CurrentStep: 1,
			Header: transfer.Header{
				Reason:      "routine_front",
				SourceZone:  "main",
				DestZone:    "dispensing",
				SourceLabel: "انبار مرکزی - سالن نگهداری دارویی",
				DestLabel:   "پیشخوان نسخه‌پیچی و تحویل فوری",
			},
			Lines: []transfer.Line{{
				ID:                  "tline-seed-1",
				DrugID:              "drug-amox",
				NameFa:              "آموکسی‌سیلین",
				BatchNo:             "AX-2402",
				Expiry:              "2027-06-01",
				SourceBatchID:       "batch-amox-2",
				SourceBinID:         "bin-a030204",
				SourceLocationLabel: "A-03-2-04",
				DestBinID:           "bin-c010101",
				DestLocationLabel:   "پیشخوان تحویل نسخه › C-01-1-01",
				Quantity:            2,
				UnitLabel:           "عدد",
				MatchStatus:         "barcode",
			}},
			CreatedBy: transfer.CreatedBy{UserID: "user-operator", Name: "اپراتور انبار", Role: "warehouse_operator"},
			CreatedAt: draftAt,
			UpdatedAt: draftAt,
		}
		if _, err := db.Collection("internal_transfers").InsertOne(ctx, tr); err != nil {
			return err
		}
	}

	// sample audit (append-only; skip if already has events)
	n, err := db.Collection("audit_events").CountDocuments(ctx, bson.M{})
	if err != nil {
		return err
	}
	if n == 0 {
		_, err = db.Collection("audit_events").InsertOne(ctx, bson.M{
			"_id": uuid.NewString(), "timestamp": time.Now().UTC(),
			"actor":  bson.M{"id": "user-operator", "name": "اپراتور انبار", "role": "warehouse_operator", "initials": "اا"},
			"action": "item_created", "entityType": "drug", "entityId": "drug-amox", "entityLabel": "آموکسی‌سیلین",
			"description": "داده اولیه seed", "severity": "info", "source": "seed", "ip": "127.0.0.1",
			"terminal": "seed", "securityStatus": "ok", "isControlledSubstance": false,
		})
		if err != nil {
			return err
		}
	}

	ledgerN, err := db.Collection("controlled_ledger_entries").CountDocuments(ctx, bson.M{})
	if err != nil {
		return err
	}
	if ledgerN == 0 {
		now := time.Now().UTC()
		signer := controlled.SignedBy{UserID: "user-operator", Name: "دکتر رضایی (مسئول فنی)", Role: "technical_officer", LicenseNo: "۳۲۴۰"}
		entries := []controlled.Entry{
			{
				ID: "ctrl-seed-1", SeqNo: 1, Timestamp: now.Add(-6 * 24 * time.Hour),
				DrugID: "drug-morphine", DrugNameFa: "مورفین سولفات", DosageStrength: "آمپول 10mg/ml", Manufacturer: "داروپخش", UnitLabel: "آمپول",
				BatchID: "batch-mor-1", BatchNo: "MR-09", Expiry: "2027-03-01",
				TxType: controlled.TxInDistributor, TxSubLabel: "ورود محموله دولتی", QtyIn: 16, BalanceAfter: 16,
				VaultBinAddress: "S-01-1-01", PhysicianName: "پخش رازی (حواله سهمیه)", PhysicianLicense: "حواله ۲۲۹۰۱-ص",
				PatientNote: "مامور تحویل: اصغری (کارت ۹۸۱)", TrackingCode: "TTAC-BARCODE-9941", SepasCode: "۷۷۴۰۱",
				TechnicalAck: true, SignedBy: signer, Source: controlled.SourceSeed,
				SearchNorm: validator.NormalizeFa("مورفین سولفات MR-09 پخش رازی TTAC-BARCODE-9941 77401"),
			},
			{
				ID: "ctrl-seed-2", SeqNo: 2, Timestamp: now.Add(-3 * 24 * time.Hour),
				DrugID: "drug-morphine", DrugNameFa: "مورفین سولفات", DosageStrength: "آمپول 10mg/ml", Manufacturer: "داروپخش", UnitLabel: "آمپول",
				BatchID: "batch-mor-1", BatchNo: "MR-09", Expiry: "2027-03-01",
				TxType: controlled.TxOutPrescription, TxSubLabel: "خروج با نسخه الکترونیک", QtyOut: 4, BalanceAfter: 12,
				VaultBinAddress: "S-01-1-01", PhysicianName: "دکتر محمدرضا صابری", PhysicianLicense: "م-۴۸۹۲۱",
				PatientNationalID: "0071234583", PatientNote: "پرونده شیمی‌درمانی بیمارستان پارس", TrackingCode: "TTAC-8849201948", SepasCode: "۱۸۰۴۹۲۸",
				TechnicalAck: true, SignedBy: signer, Source: controlled.SourceSeed,
				SearchNorm: validator.NormalizeFa("مورفین سولفات MR-09 دکتر محمدرضا صابری 0071234583 TTAC-8849201948 1804928"),
			},
			{
				ID: "ctrl-seed-3", SeqNo: 3, Timestamp: now.Add(-2 * 24 * time.Hour),
				DrugID: "drug-morphine", DrugNameFa: "مورفین سولفات", DosageStrength: "آمپول 10mg/ml", Manufacturer: "داروپخش", UnitLabel: "آمپول",
				BatchID: "batch-mor-1", BatchNo: "MR-09", Expiry: "2027-03-01",
				TxType: controlled.TxWasteReturn, TxSubLabel: "پلمب پوکه مصرف‌شده", WasteMode: controlled.WasteModeUsedAmpoule,
				AmpouleWasteCount: 4, BalanceAfter: 12,
				VaultBinAddress: "S-01-1-01", PhysicianName: "دکتر محمدرضا صابری", PhysicianLicense: "م-۴۸۹۲۱",
				PatientNationalID: "0071234583", PatientNote: "پوکه تحویل و پلمب گردید", TrackingCode: "TTAC-WASTE-8849", SepasCode: "۱۸۰۴۹۲۹",
				TechnicalAck: true, SignedBy: signer, Source: controlled.SourceSeed,
				SearchNorm: validator.NormalizeFa("مورفین سولفات MR-09 پوکه دکتر محمدرضا صابری TTAC-WASTE-8849 1804929"),
			},
			{
				ID: "ctrl-seed-4", SeqNo: 4, Timestamp: now.Add(-24 * time.Hour),
				DrugID: "drug-methadone", DrugNameFa: "قرص متادون ۴۰ میلی‌گرم", DosageStrength: "قرص 40mg", Manufacturer: "سها هلال", UnitLabel: "قرص",
				BatchID: "batch-meth-1", BatchNo: "SH-9921M", Expiry: "2027-05-01",
				TxType: controlled.TxInDistributor, TxSubLabel: "ورود محموله دولتی", QtyIn: 20, BalanceAfter: 20,
				VaultBinAddress: "S-01-1-01", PhysicianName: "داروپخش (سهمیه MMT)", PhysicianLicense: "حواله ۲۲۹۴۵-م",
				PatientNote: "تحویل به گاوصندوق مرکزی", TrackingCode: "TTAC-4491028472", SepasCode: "۱۸۰۴۸۹۰",
				TechnicalAck: true, SignedBy: signer, Source: controlled.SourceSeed,
				SearchNorm: validator.NormalizeFa("قرص متادون ۴۰ میلی‌گرم SH-9921M داروپخش TTAC-4491028472 1804890"),
			},
		}
		for _, entry := range entries {
			if _, err := db.Collection("controlled_ledger_entries").InsertOne(ctx, entry); err != nil {
				return err
			}
		}
		if _, err := db.Collection("counters").UpdateByID(ctx, "controlled_ledger_seq", bson.M{"$max": bson.M{"seq": int64(len(entries))}}, upsert()); err != nil {
			return err
		}
	}

	stocktakeCount, err := db.Collection("stocktake_cycles").CountDocuments(ctx, bson.M{"_id": "stocktake-seed-1"})
	if err != nil {
		return err
	}
	if stocktakeCount == 0 {
		seedAt := time.Date(2026, 11, 11, 8, 30, 0, 0, time.UTC)
		countedAt := time.Date(2026, 11, 11, 9, 15, 0, 0, time.UTC)
		physAmox1 := 18
		physAmox2 := 5
		physIns := 9
		cycle := stocktake.Cycle{
			ID:             "stocktake-seed-1",
			CycleCode:      "AUD-140308-01",
			Status:         stocktake.StatusActive,
			Zone:           "all",
			ZoneLabel:      "همه بخش‌ها و قفسه‌های انبار",
			Method:         stocktake.MethodBlind,
			CounterName:    "مرتضی کاظمی",
			SupervisorName: "دکتر رضایی",
			Note:           "دوره انبارگردانی فصلی — مرحله شمارش قفسه‌ها",
			Items: []stocktake.CycleItem{
				{
					ID: "st-item-1", BatchID: "batch-amox-1", DrugID: "drug-amox",
					NameFa: "آموکسی‌سیلین", NameEn: "Amoxil 500mg", GTIN: "6260001000001", GenericCode: "12345",
					Manufacturer: "داروسازی فارابی", BatchNo: "AX-2401", Expiry: "2026-12-01",
					Zone: "A", BinID: "bin-a030204", LocationLabel: "A-03-2-04", UnitLabel: "عدد",
					UnitPriceRial: 32000, SystemQty: 20, PhysicalQty: &physAmox1,
					CountStatus: stocktake.ItemStatusCounted, VarianceReason: "کسری احتمالی نسخه‌پیچی ثبت‌نشده",
					CountedAt: &countedAt, CountedBy: "مرتضی کاظمی",
				},
				{
					ID: "st-item-2", BatchID: "batch-amox-2", DrugID: "drug-amox",
					NameFa: "آموکسی‌سیلین", NameEn: "Amoxil 500mg", GTIN: "6260001000001", GenericCode: "12345",
					Manufacturer: "داروسازی فارابی", BatchNo: "AX-2402", Expiry: "2027-06-01",
					Zone: "A", BinID: "bin-a030204", LocationLabel: "A-03-2-04", UnitLabel: "عدد",
					UnitPriceRial: 33000, SystemQty: 5, PhysicalQty: &physAmox2,
					CountStatus: stocktake.ItemStatusCounted, VarianceReason: "شمارش مطابق کاردکس",
					CountedAt: &countedAt, CountedBy: "مرتضی کاظمی",
				},
				{
					ID: "st-item-3", BatchID: "batch-ins-1", DrugID: "drug-insulin",
					NameFa: "انسولین قلمی", NameEn: "Lantus 100IU/ml", GTIN: "6260001000002", GenericCode: "77881",
					Manufacturer: "سانوفی", BatchNo: "IN-110", Expiry: "2026-11-20",
					Zone: "R", BinID: "bin-r010101", LocationLabel: "R-01-1-01", UnitLabel: "قلم",
					UnitPriceRial: 700000, SystemQty: 8, PhysicalQty: &physIns,
					CountStatus: stocktake.ItemStatusCounted, VarianceReason: "عدم ثبت مرجوعی قفسه سردخانه",
					CountedAt: &countedAt, CountedBy: "مرتضی کاظمی",
				},
				{
					ID: "st-item-4", BatchID: "batch-mor-1", DrugID: "drug-morphine",
					NameFa: "مورفین سولفات", NameEn: "Morphine 10mg/ml", GTIN: "6260001000003", GenericCode: "99001",
					Manufacturer: "داروپخش", BatchNo: "MR-09", Expiry: "2027-03-01",
					Zone: "S", BinID: "bin-s010101", LocationLabel: "S-01-1-01", UnitLabel: "آمپول",
					IsControlled: true, UnitPriceRial: 90000, SystemQty: 12,
					CountStatus: stocktake.ItemStatusPending,
				},
			},
			CreatedBy: stocktake.CreatedBy{UserID: "user-operator", Name: "اپراتور انبار", Role: "warehouse_operator"},
			CreatedAt: seedAt,
			UpdatedAt: countedAt,
		}
		if _, err := db.Collection("stocktake_cycles").InsertOne(ctx, cycle); err != nil {
			return err
		}
	}

	reconcileCount, err := db.Collection("purchase_reconciliations").CountDocuments(ctx, bson.M{"_id": "reconcile-seed-hijrat"})
	if err != nil {
		return err
	}
	if reconcileCount == 0 {
		recAt := time.Date(2026, 11, 10, 10, 30, 0, 0, time.UTC)
		sampleRec := reconciliation.Reconciliation{
			ID:                 "reconcile-seed-hijrat",
			Status:             reconciliation.StatusMapped,
			CurrentStep:        3,
			FileName:           "فاکتور_پخش_هجرت_۱۴۰۵۰۸۲۴.xlsx",
			FileSizeBytes:      143360,
			InvoiceNo:          "HJR-1405-8824",
			Distributor:        "پخش هجرت",
			IssuedAt:           "2026-11-09",
			ReceivedAt:         "2026-11-10",
			WarehouseLabel:     "انبار مرکزی",
			DiscountRial:       200000,
			VatRial:            0,
			TemplateID:         "hijrat",
			Headers:            []string{"ردیف", "نام کالا (دارو)", "بارکد تجاری / GTIN", "شناسه IRC", "شماره بچ (سری ساخت)", "تاریخ انقضا (شمسی)", "تعداد / بسته", "قیمت خرید فاکتور", "قیمت مصرف‌کننده"},
			ColumnLabels:       []string{"A", "B", "C", "D", "E", "F", "G", "H", "I"},
			QuarantineOnIntake: true,
			Mapping: reconciliation.ColumnMapping{
				NameFa: 1, GTIN: 2, IRC: 3, BatchNo: 4, Expiry: 5, Quantity: 6, BuyPriceRial: 7, ConsumerPriceRial: 8, UnitLabel: -1,
			},
			RawRows: [][]string{
				{"1", "کپسول آموکسی‌سیلین ۵۰۰ (فارابی)", "6260001000001", "12345", "AMX-2026A", "1406/03/15", "40", "45000", "45000"},
				{"2", "انسولین قلمی لانتوس", "6260001000002", "77881", "INS-9031", "1405/11/20", "15", "890000", "890000"},
				{"3", "کپسول دوکسوروبیسین ۵۰ م‌گ (نانودارو)", "6268800109924", "6268800109924001", "DOX-204", "1406/07/10", "10", "1850000", "1850000"},
				{"4", "آمپول مورفین سولفات ۱۰ (داروپخش)", "6260001000003", "99001", "MRF-9980", "1406/09/01", "20", "128000", "128000"},
			},
			Rows: []reconciliation.ReconciledRow{
				{
					ID: "rrow-seed-1", RowNumber: 1, ExcelName: "کپسول آموکسی‌سیلین ۵۰۰ (فارابی)",
					GTIN: "6260001000001", IRC: "12345", BatchNo: "AMX-2026A",
					ExpiryRaw: "1406/03/15", ExpiryISO: "2027-06-05", Quantity: 40, UnitLabel: "عدد",
					BuyPriceRial: 45000, ConsumerPriceRial: 45000, ApprovedPriceRial: 45000,
					DrugID: "drug-amox", CatalogNameFa: "کپسول آموکسی‌سیلین 500mg", MatchStatus: reconciliation.RowMatched,
				},
				{
					ID: "rrow-seed-2", RowNumber: 2, ExcelName: "انسولین قلمی لانتوس",
					GTIN: "6260001000002", IRC: "77881", BatchNo: "INS-9031",
					ExpiryRaw: "1405/11/20", ExpiryISO: "2027-02-09", Quantity: 15, UnitLabel: "قلم",
					BuyPriceRial: 890000, ConsumerPriceRial: 890000, ApprovedPriceRial: 890000,
					DrugID: "drug-insulin", CatalogNameFa: "قلم تزریقی انسولین قلمی 100IU/ml", MatchStatus: reconciliation.RowMatched,
				},
				{
					ID: "rrow-seed-3", RowNumber: 3, ExcelName: "کپسول دوکسوروبیسین ۵۰ م‌گ (نانودارو)",
					GTIN: "6268800109924", IRC: "6268800109924001", BatchNo: "DOX-204",
					ExpiryRaw: "1406/07/10", ExpiryISO: "2027-10-02", Quantity: 10, UnitLabel: "ویال",
					BuyPriceRial: 1850000, ConsumerPriceRial: 1850000, ApprovedPriceRial: 1850000,
					MatchStatus: reconciliation.RowNewItem,
				},
				{
					ID: "rrow-seed-4", RowNumber: 4, ExcelName: "آمپول مورفین سولفات ۱۰ (داروپخش)",
					GTIN: "6260001000003", IRC: "99001", BatchNo: "MRF-9980",
					ExpiryRaw: "1406/09/01", ExpiryISO: "2027-11-22", Quantity: 20, UnitLabel: "آمپول",
					BuyPriceRial: 128000, ConsumerPriceRial: 128000, ApprovedPriceRial: 120000, PriceDiffPct: 6.7,
					DrugID: "drug-morphine", CatalogNameFa: "آمپول مورفین سولفات 10mg/ml", MatchStatus: reconciliation.RowPriceMismatch,
				},
			},
			CreatedBy: reconciliation.CreatedBy{UserID: "user-operator", Name: "اپراتور انبار", Role: "warehouse_operator"},
			CreatedAt: recAt,
			UpdatedAt: recAt,
		}
		if _, err := db.Collection("purchase_reconciliations").InsertOne(ctx, sampleRec); err != nil {
			return err
		}
	}
	return nil
}

func upsert() *options.UpdateOptions {
	return options.Update().SetUpsert(true)
}
