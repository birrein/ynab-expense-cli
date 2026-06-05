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
