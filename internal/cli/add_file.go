package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

type addFileAmount struct {
	raw        string
	fromNumber bool
}

func (a addFileAmount) String() string {
	return a.raw
}

func (a *addFileAmount) UnmarshalJSON(data []byte) error {
	a.raw = ""
	a.fromNumber = false

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil
	}

	var value any
	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("amount must be a string or number")
	}

	switch value := value.(type) {
	case nil:
		a.raw = ""
	case string:
		a.raw = strings.TrimSpace(value)
	case json.Number:
		a.raw = value.String()
		a.fromNumber = true
	default:
		return fmt.Errorf("amount must be a string or number")
	}
	return nil
}

type addFileInput struct {
	Budget     *string        `json:"budget"`
	AccountID  *string        `json:"account_id"`
	Amount     addFileAmount  `json:"amount"`
	Currency   string         `json:"currency"`
	Payee      string         `json:"payee"`
	Date       string         `json:"date"`
	CategoryID string         `json:"category_id"`
	Memo       string         `json:"memo"`
	Splits     []addFileSplit `json:"splits"`
}

type addFileSplit struct {
	Amount     addFileAmount `json:"amount"`
	Payee      string        `json:"payee"`
	CategoryID string        `json:"category_id"`
	Memo       string        `json:"memo"`
}

type normalizedAddFileInput struct {
	addInput
	AmountMilliunits int64
	Splits           []transactions.SplitInput
	ExplicitBudget   bool
	ExplicitAccount  bool
}

func loadAddFileInput(path string) (addFileInput, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return addFileInput{}, fmt.Errorf("--file is required")
	}

	body, err := os.ReadFile(path)
	if err != nil {
		return addFileInput{}, fmt.Errorf("read %s: %w", path, err)
	}
	if err := rejectExplicitAddFileNulls(body); err != nil {
		return addFileInput{}, fmt.Errorf("parse %s: %w", path, err)
	}

	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()

	var input addFileInput
	if err := decoder.Decode(&input); err != nil {
		return addFileInput{}, fmt.Errorf("parse %s: %w", path, err)
	}

	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return addFileInput{}, fmt.Errorf("parse %s: multiple JSON values", path)
	} else if err != io.EOF {
		return addFileInput{}, fmt.Errorf("parse %s: %w", path, err)
	}

	return input, nil
}

func rejectExplicitAddFileNulls(body []byte) error {
	var raw map[string]json.RawMessage
	decoder := json.NewDecoder(bytes.NewReader(body))
	if err := decoder.Decode(&raw); err != nil {
		return nil
	}

	for _, field := range []string{"budget", "account_id", "splits"} {
		if value, ok := raw[field]; ok && bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("%s cannot be null", field)
		}
	}
	return nil
}

func normalizeAddFileInput(input addFileInput) (normalizedAddFileInput, error) {
	currency := strings.TrimSpace(input.Currency)
	if currency == "" {
		currency = "CLP"
	}

	normalized := normalizedAddFileInput{
		addInput: addInput{
			Amount:     strings.TrimSpace(input.Amount.String()),
			Currency:   currency,
			Payee:      strings.TrimSpace(input.Payee),
			Date:       strings.TrimSpace(input.Date),
			CategoryID: strings.TrimSpace(input.CategoryID),
			Memo:       strings.TrimSpace(input.Memo),
		},
		ExplicitBudget:  input.Budget != nil,
		ExplicitAccount: input.AccountID != nil,
	}
	if input.Budget != nil {
		normalized.Budget = strings.TrimSpace(*input.Budget)
	}
	if input.AccountID != nil {
		normalized.AccountID = strings.TrimSpace(*input.AccountID)
	}

	if normalized.Amount == "" {
		return normalizedAddFileInput{}, fmt.Errorf("amount is required")
	}
	if normalized.Payee == "" {
		return normalizedAddFileInput{}, fmt.Errorf("payee is required")
	}
	if normalized.Date == "" {
		return normalizedAddFileInput{}, fmt.Errorf("date is required")
	}
	if err := validateAddFileAmount(input.Amount, normalized.Currency, "amount"); err != nil {
		return normalizedAddFileInput{}, err
	}

	parentMilliunits, err := money.ParseExpenseMilliunits(normalized.Amount, normalized.Currency)
	if err != nil {
		return normalizedAddFileInput{}, err
	}
	normalized.AmountMilliunits = parentMilliunits

	if len(input.Splits) == 0 {
		if normalized.CategoryID == "" {
			return normalizedAddFileInput{}, fmt.Errorf("category_id is required")
		}
		return normalized, nil
	}

	if normalized.CategoryID != "" {
		return normalizedAddFileInput{}, fmt.Errorf("category_id must be omitted when splits are provided")
	}
	if len(input.Splits) < 2 {
		return normalizedAddFileInput{}, fmt.Errorf("at least two split lines are required")
	}

	var splitTotal int64
	normalized.Splits = make([]transactions.SplitInput, 0, len(input.Splits))
	for i, split := range input.Splits {
		amount := strings.TrimSpace(split.Amount.String())
		categoryID := strings.TrimSpace(split.CategoryID)
		if amount == "" {
			return normalizedAddFileInput{}, fmt.Errorf("splits[%d].amount is required", i)
		}
		if categoryID == "" {
			return normalizedAddFileInput{}, fmt.Errorf("splits[%d].category_id is required", i)
		}
		if err := validateAddFileAmount(split.Amount, normalized.Currency, fmt.Sprintf("splits[%d].amount", i)); err != nil {
			return normalizedAddFileInput{}, err
		}

		splitMilliunits, err := money.ParseExpenseMilliunits(amount, normalized.Currency)
		if err != nil {
			return normalizedAddFileInput{}, fmt.Errorf("splits[%d].amount: %w", i, err)
		}
		splitTotal += splitMilliunits
		normalized.Splits = append(normalized.Splits, transactions.SplitInput{
			AmountMilliunits: splitMilliunits,
			PayeeName:        strings.TrimSpace(split.Payee),
			CategoryID:       categoryID,
			Memo:             strings.TrimSpace(split.Memo),
		})
	}

	if splitTotal != parentMilliunits {
		return normalizedAddFileInput{}, fmt.Errorf(
			"split amounts must sum to transaction amount: splits total %s, transaction amount %s",
			formatExpenseUnits(splitTotal, normalized.Currency),
			formatExpenseUnits(parentMilliunits, normalized.Currency),
		)
	}

	return normalized, nil
}

func validateAddFileAmount(amount addFileAmount, currency string, field string) error {
	if amount.fromNumber && strings.EqualFold(strings.TrimSpace(currency), "CLP") && strings.ContainsAny(amount.String(), ".eE") {
		return fmt.Errorf("%s: CLP numeric amounts must be whole numbers; use a string for CLP thousands separators", field)
	}
	return nil
}

func formatExpenseUnits(milliunits int64, currency string) string {
	if milliunits < 0 {
		milliunits = -milliunits
	}

	amount := fmt.Sprintf("%d", milliunits/1000)
	if fraction := milliunits % 1000; fraction != 0 {
		fractionText := fmt.Sprintf("%03d", fraction)
		fractionText = strings.TrimRight(fractionText, "0")
		amount += "." + fractionText
	}

	return fmt.Sprintf("%s %s", amount, strings.ToUpper(strings.TrimSpace(currency)))
}
