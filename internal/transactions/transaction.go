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
	Splits           []SplitInput
}

type SplitInput struct {
	AmountMilliunits int64
	PayeeName        string
	CategoryID       string
	Memo             string
}

type Transaction struct {
	AccountID       string           `json:"account_id"`
	Date            string           `json:"date"`
	Amount          int64            `json:"amount"`
	PayeeName       string           `json:"payee_name"`
	CategoryID      *string          `json:"category_id,omitempty"`
	Memo            string           `json:"memo"`
	Cleared         string           `json:"cleared"`
	Approved        bool             `json:"approved"`
	ImportID        string           `json:"import_id"`
	Subtransactions []Subtransaction `json:"subtransactions,omitempty"`
}

type Subtransaction struct {
	Amount     int64  `json:"amount"`
	PayeeName  string `json:"payee_name,omitempty"`
	CategoryID string `json:"category_id"`
	Memo       string `json:"memo,omitempty"`
}

type PostTransactionRequest struct {
	Transaction Transaction `json:"transaction"`
}

type PatchTransactionsRequest struct {
	Transactions []PatchTransaction `json:"transactions"`
}

type PatchTransaction struct {
	ID         string  `json:"id,omitempty"`
	ImportID   string  `json:"import_id,omitempty"`
	AccountID  string  `json:"account_id,omitempty"`
	Date       string  `json:"date,omitempty"`
	Amount     *int64  `json:"amount,omitempty"`
	PayeeName  string  `json:"payee_name,omitempty"`
	CategoryID *string `json:"category_id,omitempty"`
	Memo       *string `json:"memo,omitempty"`
	Cleared    string  `json:"cleared,omitempty"`
	Approved   *bool   `json:"approved,omitempty"`
}

type PatchInput struct {
	ID         string
	ImportID   string
	AccountID  string
	Date       string
	Amount     *int64
	PayeeName  string
	CategoryID *string
	Memo       *string
	Cleared    string
	Approved   *bool
}

func BuildExpense(input Input) Transaction {
	accountID := strings.TrimSpace(input.AccountID)
	date := strings.TrimSpace(input.Date)
	payeeName := strings.TrimSpace(input.PayeeName)
	categoryID := strings.TrimSpace(input.CategoryID)
	memo := AuditMemo(input.Memo)
	subtransactions := buildSubtransactions(input.Splits)
	transaction := Transaction{
		AccountID:       accountID,
		Date:            date,
		Amount:          input.AmountMilliunits,
		PayeeName:       payeeName,
		Memo:            memo,
		Cleared:         "uncleared",
		Approved:        false,
		ImportID:        StableImportID(accountID, date, input.AmountMilliunits, payeeName, memo, input.Splits),
		Subtransactions: subtransactions,
	}

	if len(subtransactions) == 0 && categoryID != "" {
		transaction.CategoryID = &categoryID
	}

	return transaction
}

func BuildPatch(input PatchInput) PatchTransaction {
	patch := PatchTransaction{
		ID:        strings.TrimSpace(input.ID),
		ImportID:  strings.TrimSpace(input.ImportID),
		AccountID: strings.TrimSpace(input.AccountID),
		Date:      strings.TrimSpace(input.Date),
		Amount:    input.Amount,
		PayeeName: strings.TrimSpace(input.PayeeName),
		Cleared:   strings.TrimSpace(input.Cleared),
		Approved:  input.Approved,
	}
	if input.CategoryID != nil {
		categoryID := strings.TrimSpace(*input.CategoryID)
		patch.CategoryID = &categoryID
	}
	if input.Memo != nil {
		memo := strings.TrimSpace(*input.Memo)
		patch.Memo = &memo
	}
	return patch
}

func buildSubtransactions(splits []SplitInput) []Subtransaction {
	if len(splits) == 0 {
		return nil
	}

	subtransactions := make([]Subtransaction, 0, len(splits))
	for _, split := range splits {
		subtransactions = append(subtransactions, Subtransaction{
			Amount:     split.AmountMilliunits,
			PayeeName:  strings.TrimSpace(split.PayeeName),
			CategoryID: strings.TrimSpace(split.CategoryID),
			Memo:       strings.TrimSpace(split.Memo),
		})
	}

	return subtransactions
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

func StableImportID(accountID string, date string, amount int64, payee string, memo string, splits []SplitInput) string {
	if len(splits) == 0 {
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

	material := fmt.Sprintf(
		"%s|%s|%d|%s|%s|%s",
		accountID,
		date,
		amount,
		normalizeHashPart(payee),
		normalizeHashPart(memo),
		normalizeSplitsForHash(splits),
	)
	sum := sha256.Sum256([]byte(material))

	return fmt.Sprintf("YNABEXP:%X", sum)[:28]
}

func normalizeSplitsForHash(splits []SplitInput) string {
	if len(splits) == 0 {
		return ""
	}

	parts := make([]string, 0, len(splits))
	for _, split := range splits {
		payeeName := normalizeHashPart(split.PayeeName)
		categoryID := normalizeHashPart(split.CategoryID)
		memo := normalizeHashPart(split.Memo)
		parts = append(parts, fmt.Sprintf(
			"%d|%d:%s|%d:%s|%d:%s",
			split.AmountMilliunits,
			len(payeeName),
			payeeName,
			len(categoryID),
			categoryID,
			len(memo),
			memo,
		))
	}

	return strings.Join(parts, ";")
}

func normalizeHashPart(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
