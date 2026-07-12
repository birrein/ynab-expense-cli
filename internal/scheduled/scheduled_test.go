package scheduled

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

func TestBuildExpenseDefaultsAndTrims(t *testing.T) {
	tx := BuildExpense(Input{
		AccountID:        " account-1 ",
		Date:             " 2026-08-23 ",
		AmountMilliunits: -23332000,
		PayeeName:        " Mercado Libre ",
		CategoryID:       " category-1 ",
		Memo:             " Mouse 2/6 ",
	})

	if tx.AccountID != "account-1" {
		t.Fatalf("AccountID = %q", tx.AccountID)
	}
	if tx.Date != "2026-08-23" {
		t.Fatalf("Date = %q", tx.Date)
	}
	if tx.Amount != -23332000 {
		t.Fatalf("Amount = %d", tx.Amount)
	}
	if tx.PayeeName == nil || *tx.PayeeName != "Mercado Libre" {
		t.Fatalf("PayeeName = %#v", tx.PayeeName)
	}
	if tx.CategoryID == nil || *tx.CategoryID != "category-1" {
		t.Fatalf("CategoryID = %#v", tx.CategoryID)
	}
	if tx.Memo != "Mouse 2/6; "+transactions.SourceMemo {
		t.Fatalf("Memo = %q", tx.Memo)
	}
	if tx.Frequency != "never" {
		t.Fatalf("Frequency = %q", tx.Frequency)
	}
}

func TestValidateFrequency(t *testing.T) {
	for _, value := range []string{"", "never", "monthly", "everyOtherYear"} {
		if err := ValidateFrequency(value); err != nil {
			t.Fatalf("ValidateFrequency(%q) returned %v", value, err)
		}
	}
	if err := ValidateFrequency("sometimes"); err == nil || !strings.Contains(err.Error(), "never") {
		t.Fatalf("ValidateFrequency invalid = %v", err)
	}
}

func TestValidateScheduledDate(t *testing.T) {
	today := time.Date(2026, 7, 7, 12, 0, 0, 0, time.Local)

	if err := ValidateScheduledDate("2026-07-08", today); err != nil {
		t.Fatalf("future date returned %v", err)
	}
	for _, value := range []string{"2026-07-07", "2026-07-06"} {
		if err := ValidateScheduledDate(value, today); err == nil || !strings.Contains(err.Error(), "future") {
			t.Fatalf("ValidateScheduledDate(%q) = %v", value, err)
		}
	}
	if err := ValidateScheduledDate("2031-07-08", today); err == nil || !strings.Contains(err.Error(), "five years") {
		t.Fatalf("beyond range error = %v", err)
	}
	if err := ValidateScheduledDate("not-a-date", today); err == nil || !strings.Contains(err.Error(), "YYYY-MM-DD") {
		t.Fatalf("bad date error = %v", err)
	}
}

func TestFilterListResponseByDateNext(t *testing.T) {
	body := []byte(`{"data":{"scheduled_transactions":[{"id":"before","date_next":"2026-07-31"},{"id":"first","date_next":"2026-08-01"},{"id":"inside","date_next":"2026-08-15"},{"id":"last","date_next":"2026-08-31"},{"id":"after","date_next":"2026-09-01"}],"server_knowledge":42}}`)

	filtered, err := FilterListResponse(body, "2026-08-01", "2026-08-31")
	if err != nil {
		t.Fatal(err)
	}
	var wrapper struct {
		Data struct {
			ScheduledTransactions []struct {
				ID string `json:"id"`
			} `json:"scheduled_transactions"`
			ServerKnowledge *int64 `json:"server_knowledge"`
		} `json:"data"`
	}
	if err := json.Unmarshal(filtered, &wrapper); err != nil {
		t.Fatal(err)
	}
	got := make([]string, 0, len(wrapper.Data.ScheduledTransactions))
	for _, tx := range wrapper.Data.ScheduledTransactions {
		got = append(got, tx.ID)
	}
	if strings.Join(got, ",") != "first,inside,last" {
		t.Fatalf("filtered ids = %v", got)
	}
	if wrapper.Data.ServerKnowledge == nil || *wrapper.Data.ServerKnowledge != 42 {
		t.Fatalf("server knowledge = %#v", wrapper.Data.ServerKnowledge)
	}
}

func TestFilterListResponseWithoutFiltersPreservesRawBody(t *testing.T) {
	body := []byte(`{"data":{"scheduled_transactions":[]}}`)

	filtered, err := FilterListResponse(body, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if string(filtered) != string(body) {
		t.Fatalf("filtered = %s, want %s", filtered, body)
	}
}

func TestParseDetailResponseAndBuildFromDetail(t *testing.T) {
	body := []byte(`{"data":{"scheduled_transaction":{"id":"scheduled-1","date_next":"2026-08-23","frequency":"monthly","amount":-1000000,"account_id":"account-1","payee_id":"payee-1","category_id":"category-1","memo":"old memo","subtransactions":[]}}}`)

	detail, raw, err := ParseDetailResponse(body)
	if err != nil {
		t.Fatal(err)
	}
	if detail.ID != "scheduled-1" || !strings.Contains(string(raw), "scheduled-1") {
		t.Fatalf("detail = %#v raw = %s", detail, raw)
	}
	amount := int64(-23332000)
	memo := "new memo"
	save, err := BuildFromDetail(detail, ChangeInput{
		Amount:    &amount,
		PayeeName: "New Payee",
		Memo:      &memo,
	})
	if err != nil {
		t.Fatal(err)
	}
	if save.Date != "2026-08-23" {
		t.Fatalf("Date = %q", save.Date)
	}
	if save.Amount != -23332000 {
		t.Fatalf("Amount = %d", save.Amount)
	}
	if save.PayeeID != nil {
		t.Fatalf("PayeeID = %#v, want nil after payee change", save.PayeeID)
	}
	if save.PayeeName == nil || *save.PayeeName != "New Payee" {
		t.Fatalf("PayeeName = %#v", save.PayeeName)
	}
	if save.CategoryID == nil || *save.CategoryID != "category-1" {
		t.Fatalf("CategoryID = %#v", save.CategoryID)
	}
	if save.Memo != "new memo; "+transactions.SourceMemo {
		t.Fatalf("Memo = %q", save.Memo)
	}
}

func TestBuildFromDetailPreservesPayeeIDWithoutPayeeName(t *testing.T) {
	payeeID := "payee-1"
	payeeName := "Existing Payee"
	save, err := BuildFromDetail(Detail{
		ID:        "scheduled-1",
		DateNext:  "2026-08-23",
		Frequency: "monthly",
		Amount:    -1000000,
		AccountID: "account-1",
		PayeeID:   &payeeID,
		PayeeName: &payeeName,
	}, ChangeInput{Memo: ptr("updated")})
	if err != nil {
		t.Fatal(err)
	}
	if save.PayeeID == nil || *save.PayeeID != "payee-1" {
		t.Fatalf("PayeeID = %#v", save.PayeeID)
	}
	if save.PayeeName != nil {
		t.Fatalf("PayeeName = %#v, want nil when payee_id is preserved", save.PayeeName)
	}
}

func TestBuildFromDetailPreservesFlagColor(t *testing.T) {
	flagColor := "purple"
	detail := Detail{
		ID:        "scheduled-1",
		DateNext:  "2026-08-23",
		Frequency: "monthly",
		Amount:    -1000000,
		AccountID: "account-1",
		FlagColor: &flagColor,
	}

	got, err := BuildFromDetail(detail, ChangeInput{})
	if err != nil {
		t.Fatal(err)
	}
	if got.FlagColor == nil || *got.FlagColor != flagColor {
		t.Fatalf("flag color = %#v, want %q", got.FlagColor, flagColor)
	}
}

func TestBuildFromDetailPreservesUnchangedMemoExactly(t *testing.T) {
	memo := "  keep surrounding whitespace  "
	detail := Detail{
		ID:        "scheduled-1",
		DateNext:  "2026-08-23",
		Frequency: "monthly",
		Amount:    -1000000,
		AccountID: "account-1",
		Memo:      &memo,
	}

	got, err := BuildFromDetail(detail, ChangeInput{})
	if err != nil {
		t.Fatal(err)
	}
	if got.Memo != memo {
		t.Fatalf("memo = %q, want exact preservation of %q", got.Memo, memo)
	}
}

func TestBuildFromDetailRejectsSplit(t *testing.T) {
	_, err := BuildFromDetail(Detail{
		ID:              "scheduled-1",
		DateNext:        "2026-08-23",
		AccountID:       "account-1",
		Subtransactions: []json.RawMessage{json.RawMessage(`{"id":"sub-1"}`)},
	}, ChangeInput{Memo: ptr("updated")})

	if err == nil || !strings.Contains(err.Error(), "split") {
		t.Fatalf("split error = %v", err)
	}
}

func ptr(value string) *string {
	return &value
}
