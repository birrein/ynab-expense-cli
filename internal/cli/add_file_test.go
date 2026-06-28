package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadAddFileInputSimpleExpense(t *testing.T) {
	path := writeTempExpenseFile(t, `{
		"date": "2026-06-20",
		"amount": 6300,
		"currency": "CLP",
		"payee": "Verduleria",
		"category_id": "category-123",
		"memo": "Frutas"
	}`)

	got, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}
	if got.Amount.String() != "6300" {
		t.Fatalf("amount = %q, want 6300", got.Amount.String())
	}
	if got.Payee != "Verduleria" || got.CategoryID != "category-123" {
		t.Fatalf("parsed input = %#v", got)
	}
}

func TestLoadAddFileInputSplitExpense(t *testing.T) {
	path := writeTempExpenseFile(t, `{
		"date": "2026-06-26",
		"amount": "10.990",
		"currency": "CLP",
		"payee": "Main Merchant",
		"memo": "Split payment",
		"splits": [
			{"amount": 10000, "payee": "Main Merchant", "category_id": "primary-category", "memo": "Primary charge"},
			{"amount": 990, "payee": "Payment Processor", "category_id": "fee-category", "memo": "Processing fee"}
		]
	}`)

	got, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}
	if got.Amount.String() != "10.990" {
		t.Fatalf("parent amount = %q, want 10.990", got.Amount.String())
	}
	if len(got.Splits) != 2 {
		t.Fatalf("splits length = %d, want 2", len(got.Splits))
	}
	if got.Splits[1].Amount.String() != "990" {
		t.Fatalf("second split amount = %q, want 990", got.Splits[1].Amount.String())
	}
}

func TestLoadAddFileInputRejectsUnknownFields(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":"2026-06-20","amount":6300,"payee":"Store","category_id":"category-123","unexpected":true}`)

	_, err := loadAddFileInput(path)
	if err == nil {
		t.Fatal("loadAddFileInput accepted an unknown field")
	}
	if !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("expected unknown field error, got %q", err.Error())
	}
}

func TestLoadAddFileInputMalformedJSONIncludesPath(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":`)

	_, err := loadAddFileInput(path)
	if err == nil {
		t.Fatal("loadAddFileInput accepted malformed JSON")
	}
	if !strings.Contains(err.Error(), path) {
		t.Fatalf("expected error to include path %q, got %q", path, err.Error())
	}
}

func TestLoadAddFileInputRejectsNullBudgetAndAccount(t *testing.T) {
	for name, body := range map[string]string{
		"budget":     `{"budget":null,"date":"2026-06-20","amount":6300,"payee":"Store","category_id":"category-123"}`,
		"account_id": `{"account_id":null,"date":"2026-06-20","amount":6300,"payee":"Store","category_id":"category-123"}`,
	} {
		t.Run(name, func(t *testing.T) {
			path := writeTempExpenseFile(t, body)

			_, err := loadAddFileInput(path)
			if err == nil {
				t.Fatalf("loadAddFileInput accepted explicit null %s", name)
			}
			if !strings.Contains(err.Error(), name+" cannot be null") {
				t.Fatalf("expected null %s error, got %q", name, err.Error())
			}
		})
	}
}

func TestLoadAddFileInputRejectsNullSplits(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":"2026-06-20","amount":6300,"payee":"Store","category_id":"category-123","splits":null}`)

	_, err := loadAddFileInput(path)
	if err == nil {
		t.Fatal("loadAddFileInput accepted explicit null splits")
	}
	if !strings.Contains(err.Error(), "splits cannot be null") {
		t.Fatalf("expected null splits error, got %q", err.Error())
	}
}

func TestNormalizeAddFileInputValidatesSplitSum(t *testing.T) {
	input := addFileInput{
		Date:     "2026-06-26",
		Amount:   addFileAmount{raw: "10990"},
		Currency: "CLP",
		Payee:    "Main Merchant",
		Splits: []addFileSplit{
			{Amount: addFileAmount{raw: "10000"}, CategoryID: "primary-category"},
			{Amount: addFileAmount{raw: "990"}, CategoryID: "fee-category"},
		},
	}

	got, err := normalizeAddFileInput(input)
	if err != nil {
		t.Fatalf("normalizeAddFileInput returned error: %v", err)
	}
	if got.AmountMilliunits != -10990000 {
		t.Fatalf("parent milliunits = %d, want -10990000", got.AmountMilliunits)
	}
	if got.Splits[0].AmountMilliunits != -10000000 || got.Splits[1].AmountMilliunits != -990000 {
		t.Fatalf("split milliunits = %#v", got.Splits)
	}
}

func TestNormalizeAddFileInputRejectsNumericCLPDecimal(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":"2026-06-20","amount":10.990,"currency":"CLP","payee":"Store","category_id":"category-123"}`)

	input, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}

	_, err = normalizeAddFileInput(input)
	if err == nil {
		t.Fatal("normalizeAddFileInput accepted numeric CLP decimal")
	}
	if !strings.Contains(err.Error(), "CLP numeric amounts must be whole numbers") {
		t.Fatalf("expected numeric CLP decimal error, got %q", err.Error())
	}
}

func TestNormalizeAddFileInputAcceptsStringCLPThousands(t *testing.T) {
	path := writeTempExpenseFile(t, `{"date":"2026-06-20","amount":"10.990","currency":"CLP","payee":"Store","category_id":"category-123"}`)

	input, err := loadAddFileInput(path)
	if err != nil {
		t.Fatalf("loadAddFileInput returned error: %v", err)
	}

	got, err := normalizeAddFileInput(input)
	if err != nil {
		t.Fatalf("normalizeAddFileInput returned error: %v", err)
	}
	if got.AmountMilliunits != -10990000 {
		t.Fatalf("amount milliunits = %d, want -10990000", got.AmountMilliunits)
	}
}

func TestNormalizeAddFileInputRejectsSplitSumMismatch(t *testing.T) {
	input := addFileInput{
		Date:     "2026-06-26",
		Amount:   addFileAmount{raw: "10990"},
		Currency: "CLP",
		Payee:    "Main Merchant",
		Splits: []addFileSplit{
			{Amount: addFileAmount{raw: "10000"}, CategoryID: "primary-category"},
			{Amount: addFileAmount{raw: "900"}, CategoryID: "fee-category"},
		},
	}

	_, err := normalizeAddFileInput(input)
	if err == nil {
		t.Fatal("normalizeAddFileInput accepted mismatched split totals")
	}
	if !strings.Contains(err.Error(), "split amounts must sum to transaction amount") {
		t.Fatalf("expected split sum error, got %q", err.Error())
	}
}

func writeTempExpenseFile(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "expense.json")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	return path
}
