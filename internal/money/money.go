package money

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	clpAmountPattern = regexp.MustCompile(`^(?:\d+|\d{1,3}(?:\.\d{3})+)$`)
	usdAmountPattern = regexp.MustCompile(`^(?:(?:\d+)|(?:\d{1,3}(?:,\d{3})+))(?:\.\d{1,3})?$`)
)

func ParseExpenseMilliunits(input string, currency string) (int64, error) {
	normalizedCurrency := strings.ToUpper(strings.TrimSpace(currency))

	switch normalizedCurrency {
	case "CLP":
		return parseCLPExpenseMilliunits(input)
	case "USD":
		return parseUSDExpenseMilliunits(input)
	default:
		return 0, fmt.Errorf("unsupported currency: %s", currency)
	}
}

func parseCLPExpenseMilliunits(input string) (int64, error) {
	amount, err := normalizeAmountInput(input, "CLP")
	if err != nil {
		return 0, fmt.Errorf("invalid CLP amount: %q", input)
	}
	if !clpAmountPattern.MatchString(amount) {
		return 0, fmt.Errorf("invalid CLP amount: %q", input)
	}
	amount = strings.ReplaceAll(amount, ".", "")

	units, err := strconv.ParseInt(amount, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid CLP amount: %q", input)
	}

	return -absInt64(units * 1000), nil
}

func parseUSDExpenseMilliunits(input string) (int64, error) {
	amount, err := normalizeAmountInput(input, "USD")
	if err != nil {
		return 0, fmt.Errorf("invalid USD amount: %q", input)
	}
	if !usdAmountPattern.MatchString(amount) {
		return 0, fmt.Errorf("invalid USD amount: %q", input)
	}
	amount = strings.ReplaceAll(amount, ",", "")

	parts := strings.SplitN(amount, ".", 2)
	units, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid USD amount: %q", input)
	}
	milliunits := units * 1000
	if len(parts) == 2 {
		fraction := parts[1]
		for len(fraction) < 3 {
			fraction += "0"
		}
		fractionUnits, err := strconv.ParseInt(fraction, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid USD amount: %q", input)
		}
		milliunits += fractionUnits
	}

	return -absInt64(milliunits), nil
}

func normalizeAmountInput(input string, currency string) (string, error) {
	amount := strings.TrimSpace(input)
	if amount == "" {
		return "", fmt.Errorf("empty amount")
	}

	amount = trimBoundaryCurrencyLabel(amount, currency)
	amount = trimBoundaryCurrencyLabel(amount, currency)
	amount = strings.TrimSpace(amount)

	if strings.Count(amount, "$") > 1 {
		return "", fmt.Errorf("invalid currency symbol")
	}
	if strings.HasPrefix(amount, "$") {
		amount = strings.TrimSpace(strings.TrimPrefix(amount, "$"))
	} else if strings.HasSuffix(amount, "$") {
		amount = strings.TrimSpace(strings.TrimSuffix(amount, "$"))
	} else if strings.Contains(amount, "$") {
		return "", fmt.Errorf("invalid currency symbol")
	}

	if amount == "" {
		return "", fmt.Errorf("empty amount")
	}
	return amount, nil
}

func trimBoundaryCurrencyLabel(input string, currency string) string {
	amount := strings.TrimSpace(input)
	upperAmount := strings.ToUpper(amount)
	if strings.HasPrefix(upperAmount, currency) && hasBoundaryAfter(amount, len(currency)) {
		return strings.TrimSpace(amount[len(currency):])
	}
	if strings.HasSuffix(upperAmount, currency) && hasBoundaryBefore(amount, len(amount)-len(currency)) {
		return strings.TrimSpace(amount[:len(amount)-len(currency)])
	}
	return amount
}

func hasBoundaryAfter(input string, index int) bool {
	return index >= len(input) || input[index] == ' ' || input[index] == '\t' || input[index] == '$'
}

func hasBoundaryBefore(input string, index int) bool {
	return index <= 0 || input[index-1] == ' ' || input[index-1] == '\t' || input[index-1] == '$'
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
