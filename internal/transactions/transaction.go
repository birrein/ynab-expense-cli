package transactions

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

const SourceMemo = "source=ynab-expense-cli"

type Input struct {
	AccountID        string
	Date             string
	AmountMilliunits int64
	PayeeName        string
	CategoryID       string
	Memo             string
}

type Transaction struct {
	AccountID  string  `json:"account_id"`
	Date       string  `json:"date"`
	Amount     int64   `json:"amount"`
	PayeeName  string  `json:"payee_name"`
	CategoryID *string `json:"category_id,omitempty"`
	Memo       string  `json:"memo"`
	Cleared    string  `json:"cleared"`
	Approved   bool    `json:"approved"`
	ImportID   string  `json:"import_id"`
}

type PostTransactionRequest struct {
	Transaction Transaction `json:"transaction"`
}

func BuildExpense(input Input) Transaction {
	accountID := strings.TrimSpace(input.AccountID)
	date := strings.TrimSpace(input.Date)
	payeeName := strings.TrimSpace(input.PayeeName)
	categoryID := strings.TrimSpace(input.CategoryID)
	memo := AuditMemo(input.Memo)
	transaction := Transaction{
		AccountID: accountID,
		Date:      date,
		Amount:    input.AmountMilliunits,
		PayeeName: payeeName,
		Memo:      memo,
		Cleared:   "uncleared",
		Approved:  false,
		ImportID:  StableImportID(accountID, date, input.AmountMilliunits, payeeName, memo),
	}

	if categoryID != "" {
		transaction.CategoryID = &categoryID
	}

	return transaction
}

func AuditMemo(memo string) string {
	cleaned := strings.TrimSpace(memo)
	if cleaned == "" {
		return SourceMemo
	}
	if strings.Contains(cleaned, SourceMemo) {
		return cleaned
	}

	return cleaned + "; " + SourceMemo
}

func StableImportID(accountID string, date string, amount int64, payee string, memo string) string {
	material := fmt.Sprintf(
		"%s|%s|%d|%s|%s",
		accountID,
		date,
		amount,
		normalizeHashPart(payee),
		normalizeHashPart(memo),
	)
	sum := sha256.Sum256([]byte(material))

	return fmt.Sprintf("YNABEXP:%X", sum)[:28]
}

func normalizeHashPart(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
