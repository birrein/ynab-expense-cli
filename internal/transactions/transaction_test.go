package transactions

import "testing"

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
