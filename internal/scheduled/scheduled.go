package scheduled

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

const dateLayout = "2006-01-02"

var allowedFrequencies = map[string]struct{}{
	"never":           {},
	"daily":           {},
	"weekly":          {},
	"everyOtherWeek":  {},
	"twiceAMonth":     {},
	"every4Weeks":     {},
	"monthly":         {},
	"everyOtherMonth": {},
	"every3Months":    {},
	"every4Months":    {},
	"twiceAYear":      {},
	"yearly":          {},
	"everyOtherYear":  {},
}

type Input struct {
	AccountID        string
	Date             string
	AmountMilliunits int64
	PayeeName        string
	CategoryID       string
	Memo             string
	Frequency        string
}

type ChangeInput struct {
	AccountID  string
	Date       string
	Amount     *int64
	PayeeName  string
	CategoryID *string
	Memo       *string
	Frequency  string
}

type SaveScheduledTransaction struct {
	AccountID  string  `json:"account_id"`
	Date       string  `json:"date"`
	Amount     int64   `json:"amount"`
	PayeeID    *string `json:"payee_id,omitempty"`
	PayeeName  *string `json:"payee_name,omitempty"`
	CategoryID *string `json:"category_id,omitempty"`
	Memo       string  `json:"memo,omitempty"`
	Frequency  string  `json:"frequency,omitempty"`
	FlagColor  *string `json:"flag_color,omitempty"`
}

type PostScheduledTransactionRequest struct {
	ScheduledTransaction SaveScheduledTransaction `json:"scheduled_transaction"`
}

type PutScheduledTransactionRequest struct {
	ScheduledTransaction SaveScheduledTransaction `json:"scheduled_transaction"`
}

type Detail struct {
	ID              string            `json:"id"`
	DateNext        string            `json:"date_next"`
	Frequency       string            `json:"frequency"`
	Amount          int64             `json:"amount"`
	AccountID       string            `json:"account_id"`
	PayeeID         *string           `json:"payee_id"`
	PayeeName       *string           `json:"payee_name"`
	CategoryID      *string           `json:"category_id"`
	Memo            *string           `json:"memo"`
	FlagColor       *string           `json:"flag_color"`
	Subtransactions []json.RawMessage `json:"subtransactions"`
}

func BuildExpense(input Input) SaveScheduledTransaction {
	frequency := strings.TrimSpace(input.Frequency)
	if frequency == "" {
		frequency = "never"
	}

	payeeName := strings.TrimSpace(input.PayeeName)
	memo := transactions.AuditMemo(input.Memo)
	tx := SaveScheduledTransaction{
		AccountID: strings.TrimSpace(input.AccountID),
		Date:      strings.TrimSpace(input.Date),
		Amount:    input.AmountMilliunits,
		PayeeName: &payeeName,
		Memo:      memo,
		Frequency: frequency,
	}

	if categoryID := strings.TrimSpace(input.CategoryID); categoryID != "" {
		tx.CategoryID = &categoryID
	}
	return tx
}

func BuildFromDetail(detail Detail, change ChangeInput) (SaveScheduledTransaction, error) {
	if len(detail.Subtransactions) > 0 {
		return SaveScheduledTransaction{}, fmt.Errorf("scheduled split edits are not supported")
	}
	if strings.TrimSpace(detail.DateNext) == "" {
		return SaveScheduledTransaction{}, fmt.Errorf("scheduled transaction response missing date_next")
	}
	if strings.TrimSpace(detail.AccountID) == "" {
		return SaveScheduledTransaction{}, fmt.Errorf("scheduled transaction response missing account_id")
	}

	tx := SaveScheduledTransaction{
		AccountID:  strings.TrimSpace(detail.AccountID),
		Date:       strings.TrimSpace(detail.DateNext),
		Amount:     detail.Amount,
		PayeeID:    trimPtr(detail.PayeeID),
		CategoryID: trimPtr(detail.CategoryID),
		Frequency:  strings.TrimSpace(detail.Frequency),
		FlagColor:  trimPtr(detail.FlagColor),
	}
	if tx.PayeeID == nil {
		tx.PayeeName = trimPtr(detail.PayeeName)
	}
	if detail.Memo != nil {
		tx.Memo = *detail.Memo
	}

	if strings.TrimSpace(change.AccountID) != "" {
		tx.AccountID = strings.TrimSpace(change.AccountID)
	}
	if strings.TrimSpace(change.Date) != "" {
		tx.Date = strings.TrimSpace(change.Date)
	}
	if change.Amount != nil {
		tx.Amount = *change.Amount
	}
	if strings.TrimSpace(change.PayeeName) != "" {
		payeeName := strings.TrimSpace(change.PayeeName)
		tx.PayeeName = &payeeName
		tx.PayeeID = nil
	}
	if change.CategoryID != nil {
		categoryID := strings.TrimSpace(*change.CategoryID)
		tx.CategoryID = &categoryID
	}
	if change.Memo != nil {
		tx.Memo = transactions.AuditMemo(*change.Memo)
	}
	if strings.TrimSpace(change.Frequency) != "" {
		tx.Frequency = strings.TrimSpace(change.Frequency)
	}

	return tx, nil
}

func ParseDetailResponse(body []byte) (Detail, json.RawMessage, error) {
	var wrapper struct {
		Data struct {
			ScheduledTransaction json.RawMessage `json:"scheduled_transaction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return Detail{}, nil, err
	}
	raw := bytes.TrimSpace(wrapper.Data.ScheduledTransaction)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return Detail{}, nil, fmt.Errorf("scheduled transaction response missing scheduled_transaction")
	}
	var detail Detail
	if err := json.Unmarshal(raw, &detail); err != nil {
		return Detail{}, nil, err
	}
	if strings.TrimSpace(detail.ID) == "" {
		return Detail{}, nil, fmt.Errorf("scheduled transaction response missing scheduled_transaction")
	}
	return detail, raw, nil
}

func ValidateFrequency(frequency string) error {
	frequency = strings.TrimSpace(frequency)
	if frequency == "" {
		return nil
	}
	if _, ok := allowedFrequencies[frequency]; !ok {
		return fmt.Errorf("--frequency must be one of: %s", strings.Join(Frequencies(), ", "))
	}
	return nil
}

func Frequencies() []string {
	return []string{
		"never",
		"daily",
		"weekly",
		"everyOtherWeek",
		"twiceAMonth",
		"every4Weeks",
		"monthly",
		"everyOtherMonth",
		"every3Months",
		"every4Months",
		"twiceAYear",
		"yearly",
		"everyOtherYear",
	}
}

func ValidateScheduledDate(value string, today time.Time) error {
	parsed, err := ParseDate(value)
	if err != nil {
		return fmt.Errorf("--date must be YYYY-MM-DD")
	}

	localToday := dateOnly(today)
	if !parsed.After(localToday) {
		return fmt.Errorf("--date must be a future date")
	}
	if parsed.After(localToday.AddDate(5, 0, 0)) {
		return fmt.Errorf("--date must be no more than five years in the future")
	}
	return nil
}

func ParseDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	parsed, err := time.Parse(dateLayout, value)
	if err != nil || parsed.Format(dateLayout) != value {
		return time.Time{}, fmt.Errorf("date must be YYYY-MM-DD")
	}
	return parsed, nil
}

func FilterListResponse(body []byte, since string, until string) ([]byte, error) {
	since = strings.TrimSpace(since)
	until = strings.TrimSpace(until)
	if since == "" && until == "" {
		return body, nil
	}

	var sinceDate time.Time
	var untilDate time.Time
	var err error
	if since != "" {
		sinceDate, err = ParseDate(since)
		if err != nil {
			return nil, fmt.Errorf("--since must be YYYY-MM-DD")
		}
	}
	if until != "" {
		untilDate, err = ParseDate(until)
		if err != nil {
			return nil, fmt.Errorf("--until must be YYYY-MM-DD")
		}
	}

	var wrapper struct {
		Data struct {
			ScheduledTransactions []json.RawMessage `json:"scheduled_transactions"`
			ServerKnowledge       *int64            `json:"server_knowledge,omitempty"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, err
	}

	filtered := make([]json.RawMessage, 0, len(wrapper.Data.ScheduledTransactions))
	for _, raw := range wrapper.Data.ScheduledTransactions {
		var item struct {
			DateNext string `json:"date_next"`
		}
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, err
		}
		dateNext, err := ParseDate(item.DateNext)
		if err != nil {
			return nil, fmt.Errorf("scheduled transaction date_next must be YYYY-MM-DD")
		}
		if since != "" && dateNext.Before(sinceDate) {
			continue
		}
		if until != "" && dateNext.After(untilDate) {
			continue
		}
		filtered = append(filtered, raw)
	}
	wrapper.Data.ScheduledTransactions = filtered

	return json.Marshal(wrapper)
}

func dateOnly(value time.Time) time.Time {
	year, month, day := value.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func trimPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
