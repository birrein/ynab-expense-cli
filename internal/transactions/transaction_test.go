package transactions

import (
	"regexp"
	"testing"
)

func TestBuildExpenseDefaults(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "",
	})

	if transaction.AccountID != "account-1" {
		t.Fatalf("AccountID = %q, want %q", transaction.AccountID, "account-1")
	}
	if transaction.Date != "2026-06-05" {
		t.Fatalf("Date = %q, want %q", transaction.Date, "2026-06-05")
	}
	if transaction.Amount != -12990000 {
		t.Fatalf("Amount = %d, want %d", transaction.Amount, int64(-12990000))
	}
	if transaction.PayeeName != "Comercio" {
		t.Fatalf("PayeeName = %q, want %q", transaction.PayeeName, "Comercio")
	}
	if transaction.CategoryID == nil {
		t.Fatal("CategoryID = nil, want category-1")
	}
	if *transaction.CategoryID != "category-1" {
		t.Fatalf("CategoryID = %q, want %q", *transaction.CategoryID, "category-1")
	}
	if transaction.Memo != SourceMemo {
		t.Fatalf("Memo = %q, want %q", transaction.Memo, SourceMemo)
	}
	if transaction.Cleared != "uncleared" {
		t.Fatalf("Cleared = %q, want %q", transaction.Cleared, "uncleared")
	}
	if transaction.Approved {
		t.Fatal("Approved = true, want false")
	}
	if transaction.ImportID == "" {
		t.Fatal("ImportID is empty")
	}
	if len(transaction.ImportID) > 36 {
		t.Fatalf("ImportID length = %d, want <= 36", len(transaction.ImportID))
	}
}

func TestBuildExpenseAppendsAuditMemo(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "boleta 123",
	})

	want := "boleta 123; source=ynab-expense-cli"
	if transaction.Memo != want {
		t.Fatalf("Memo = %q, want %q", transaction.Memo, want)
	}
}

func TestBuildExpenseStableImportID(t *testing.T) {
	input := Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "boleta 123",
	}

	first := BuildExpense(input)
	second := BuildExpense(input)

	if first.ImportID != second.ImportID {
		t.Fatalf("ImportID = %q, want stable %q", second.ImportID, first.ImportID)
	}
}

func TestBuildExpenseSimpleImportIDPreservesLegacyValue(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        "account-123",
		Date:             "2026-06-20",
		AmountMilliunits: -6300000,
		PayeeName:        "Verduleria",
		CategoryID:       "category-123",
		Memo:             "Frutas",
	})
	const want = "YNABEXP:044598212BFEFCAD7017"

	if transaction.ImportID != want {
		t.Fatalf("ImportID = %q, want legacy value %q", transaction.ImportID, want)
	}
}

func TestAuditMemoIsIdempotent(t *testing.T) {
	memo := "boleta 123; source=ynab-expense-cli"

	if got := AuditMemo(memo); got != memo {
		t.Fatalf("AuditMemo(%q) = %q, want %q", memo, got, memo)
	}
}

func TestAuditMemoWhitespaceOnlyUsesSourceMemo(t *testing.T) {
	memo := "   "

	if got := AuditMemo(memo); got != SourceMemo {
		t.Fatalf("AuditMemo(%q) = %q, want %q", memo, got, SourceMemo)
	}
}

func TestBuildExpenseTrimsInput(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        " account-1 ",
		Date:             " 2026-06-05 ",
		AmountMilliunits: -12990000,
		PayeeName:        " Comercio ",
		CategoryID:       " category-1 ",
		Memo:             " boleta 123 ",
	})

	if transaction.AccountID != "account-1" {
		t.Fatalf("AccountID = %q, want %q", transaction.AccountID, "account-1")
	}
	if transaction.Date != "2026-06-05" {
		t.Fatalf("Date = %q, want %q", transaction.Date, "2026-06-05")
	}
	if transaction.PayeeName != "Comercio" {
		t.Fatalf("PayeeName = %q, want %q", transaction.PayeeName, "Comercio")
	}
	if transaction.CategoryID == nil {
		t.Fatal("CategoryID = nil, want category-1")
	}
	if *transaction.CategoryID != "category-1" {
		t.Fatalf("CategoryID = %q, want %q", *transaction.CategoryID, "category-1")
	}
	wantMemo := "boleta 123; source=ynab-expense-cli"
	if transaction.Memo != wantMemo {
		t.Fatalf("Memo = %q, want %q", transaction.Memo, wantMemo)
	}
}

func TestBuildExpenseWhitespaceOnlyCategoryIDIsNil(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "   ",
		Memo:             "",
	})

	if transaction.CategoryID != nil {
		t.Fatalf("CategoryID = %q, want nil", *transaction.CategoryID)
	}
}

func TestBuildExpenseImportIDFormat(t *testing.T) {
	transaction := BuildExpense(Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "boleta 123",
	})
	match, err := regexp.MatchString(`^YNABEXP:[0-9A-F]{20}$`, transaction.ImportID)
	if err != nil {
		t.Fatal(err)
	}

	if !match {
		t.Fatalf("ImportID = %q, want YNABEXP plus 20 uppercase hex chars", transaction.ImportID)
	}
}

func TestBuildExpenseImportIDExcludesCategoryID(t *testing.T) {
	input := Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "boleta 123",
	}

	first := BuildExpense(input)
	input.CategoryID = "category-2"
	second := BuildExpense(input)

	if first.ImportID != second.ImportID {
		t.Fatalf("ImportID changed from %q to %q, want category excluded from hash", first.ImportID, second.ImportID)
	}
}

func TestBuildExpenseImportIDIncludesFinalMemo(t *testing.T) {
	input := Input{
		AccountID:        "account-1",
		Date:             "2026-06-05",
		AmountMilliunits: -12990000,
		PayeeName:        "Comercio",
		CategoryID:       "category-1",
		Memo:             "boleta 123",
	}

	first := BuildExpense(input)
	input.Memo = "boleta 456"
	second := BuildExpense(input)

	if first.ImportID == second.ImportID {
		t.Fatalf("ImportID = %q for different final memos, want different values", first.ImportID)
	}
}

func TestBuildExpenseWithSplitsOmitsParentCategoryAndAddsSubtransactions(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID:        "account-123",
		Date:             "2026-06-26",
		AmountMilliunits: -10990000,
		PayeeName:        "Main Merchant",
		CategoryID:       "parent-category",
		Memo:             "Split payment",
		Splits: []SplitInput{
			{
				AmountMilliunits: -10000000,
				PayeeName:        "Main Merchant",
				CategoryID:       "primary-category",
				Memo:             "Primary charge",
			},
			{
				AmountMilliunits: -990000,
				PayeeName:        "Payment Processor",
				CategoryID:       "fee-category",
				Memo:             "Processing fee",
			},
		},
	})

	if tx.CategoryID != nil {
		t.Fatalf("split parent category = %q, want nil", *tx.CategoryID)
	}
	if len(tx.Subtransactions) != 2 {
		t.Fatalf("subtransactions length = %d, want 2", len(tx.Subtransactions))
	}
	if tx.Subtransactions[0] != (Subtransaction{
		Amount:     -10000000,
		PayeeName:  "Main Merchant",
		CategoryID: "primary-category",
		Memo:       "Primary charge",
	}) {
		t.Fatalf("first split = %#v", tx.Subtransactions[0])
	}
	if tx.Subtransactions[1] != (Subtransaction{
		Amount:     -990000,
		PayeeName:  "Payment Processor",
		CategoryID: "fee-category",
		Memo:       "Processing fee",
	}) {
		t.Fatalf("second split = %#v", tx.Subtransactions[1])
	}
	if tx.Memo != "Split payment; source=ynab-expense-cli" {
		t.Fatalf("parent memo = %q", tx.Memo)
	}
}

func TestBuildExpenseSplitImportIDIncludesSplitDetails(t *testing.T) {
	base := Input{
		AccountID:        "account-123",
		Date:             "2026-06-26",
		AmountMilliunits: -10990000,
		PayeeName:        "Main Merchant",
		Memo:             "Split payment",
		Splits: []SplitInput{
			{AmountMilliunits: -10000000, PayeeName: "Main Merchant", CategoryID: "primary-category", Memo: "Primary charge"},
			{AmountMilliunits: -990000, PayeeName: "Payment Processor", CategoryID: "fee-category", Memo: "Processing fee"},
		},
	}

	first := BuildExpense(base)
	second := BuildExpense(base)
	if first.ImportID != second.ImportID {
		t.Fatalf("identical split import IDs differ: %q vs %q", first.ImportID, second.ImportID)
	}

	changed := base
	changed.Splits = []SplitInput{
		{AmountMilliunits: -9900000, PayeeName: "Main Merchant", CategoryID: "primary-category", Memo: "Primary charge"},
		{AmountMilliunits: -1090000, PayeeName: "Payment Processor", CategoryID: "fee-category", Memo: "Processing fee"},
	}
	if BuildExpense(changed).ImportID == first.ImportID {
		t.Fatal("split import ID did not change after split allocation changed")
	}
}

func TestBuildExpenseSplitImportIDDistinguishesDelimitedFields(t *testing.T) {
	base := Input{
		AccountID:        "account-123",
		Date:             "2026-06-26",
		AmountMilliunits: -1000000,
		PayeeName:        "Main Merchant",
		Memo:             "Split payment",
		Splits: []SplitInput{
			{AmountMilliunits: -1000000, PayeeName: "a:b", CategoryID: "c", Memo: "d"},
		},
	}
	changed := base
	changed.Splits = []SplitInput{
		{AmountMilliunits: -1000000, PayeeName: "a", CategoryID: "b:c", Memo: "d"},
	}

	if BuildExpense(base).ImportID == BuildExpense(changed).ImportID {
		t.Fatal("split import ID collapsed distinct delimited fields")
	}
}

func TestBuildExpenseWithoutSplitsKeepsSimplePayload(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID:        "account-123",
		Date:             "2026-06-20",
		AmountMilliunits: -6300000,
		PayeeName:        "Verduleria",
		CategoryID:       "category-123",
		Memo:             "Frutas",
	})

	if tx.CategoryID == nil || *tx.CategoryID != "category-123" {
		t.Fatalf("simple category = %#v, want category-123", tx.CategoryID)
	}
	if len(tx.Subtransactions) != 0 {
		t.Fatalf("simple transaction has splits: %#v", tx.Subtransactions)
	}
}
