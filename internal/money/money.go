package money

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode"
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
	amount := stripAmountDecorations(input)
	amount = strings.ReplaceAll(amount, ".", "")
	amount = strings.ReplaceAll(amount, ",", "")

	units, err := strconv.ParseInt(amount, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid CLP amount: %q", input)
	}

	return -absInt64(units * 1000), nil
}

func parseUSDExpenseMilliunits(input string) (int64, error) {
	amount := stripAmountDecorations(input)
	amount = strings.ReplaceAll(amount, ",", "")

	units, err := strconv.ParseFloat(amount, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid USD amount: %q", input)
	}

	return -int64(math.Round(math.Abs(units) * 1000)), nil
}

func stripAmountDecorations(input string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsSpace(r) || r == '$' {
			return -1
		}
		return r
	}, input)
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
