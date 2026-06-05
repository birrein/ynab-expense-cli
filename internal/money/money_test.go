package money

import "testing"

func TestParseExpenseMilliunitsCLP(t *testing.T) {
	cases := map[string]int64{
		"12.990":     -12990000,
		"$12.990":    -12990000,
		"12990":      -12990000,
		"CLP 12.990": -12990000,
	}

	for input, want := range cases {
		got, err := ParseExpenseMilliunits(input, "CLP")
		if err != nil {
			t.Fatalf("ParseExpenseMilliunits(%q, CLP) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("ParseExpenseMilliunits(%q, CLP) = %d, want %d", input, got, want)
		}
	}
}

func TestParseExpenseMilliunitsUSD(t *testing.T) {
	cases := map[string]int64{
		"12.99":     -12990,
		"$12.99":    -12990,
		"USD 12.99": -12990,
		"12990":     -12990000,
	}

	for input, want := range cases {
		got, err := ParseExpenseMilliunits(input, "USD")
		if err != nil {
			t.Fatalf("ParseExpenseMilliunits(%q, USD) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("ParseExpenseMilliunits(%q, USD) = %d, want %d", input, got, want)
		}
	}
}

func TestParseExpenseMilliunitsRejectsUnknownCurrency(t *testing.T) {
	if _, err := ParseExpenseMilliunits("12.990", "EUR"); err == nil {
		t.Fatal("ParseExpenseMilliunits with unknown currency returned nil error")
	}
}

func TestParseExpenseMilliunitsRejectsInvalidAmount(t *testing.T) {
	if _, err := ParseExpenseMilliunits("not an amount", "CLP"); err == nil {
		t.Fatal("ParseExpenseMilliunits with invalid amount returned nil error")
	}
}
