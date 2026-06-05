package ynab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

func TestClientGetPlansUsesAuthHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans" {
			t.Fatalf("path = %q, want /plans", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token-123" {
			t.Fatalf("Authorization = %q, want Bearer token-123", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"plans":[{"name":"Main"}]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	body, err := client.GetPlans(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(body), "Main") {
		t.Fatalf("body = %s, want it to contain Main", body)
	}
}

func TestClientGetTransactionsUsesSinceAndUntil(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %q, want /plans/default/transactions", r.URL.Path)
		}
		if got := r.URL.Query().Get("since_date"); got != "2026-06-01" {
			t.Fatalf("since_date = %q, want 2026-06-01", got)
		}
		if got := r.URL.Query().Get("until_date"); got != "2026-06-05" {
			t.Fatalf("until_date = %q, want 2026-06-05", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"transactions":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetTransactions(context.Background(), "default", "2026-06-01", "2026-06-05")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientCreateTransactionPostsPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %q, want /plans/default/transactions", r.URL.Path)
		}
		var payload transactions.PostTransactionRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Transaction.ImportID == "" {
			t.Fatal("Transaction.ImportID is empty")
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"data":{"transaction":{"id":"tx-1"}}}`))
	}))
	defer server.Close()

	payload := transactions.PostTransactionRequest{
		Transaction: transactions.BuildExpense(transactions.Input{
			AccountID:        "account-1",
			Date:             "2026-06-05",
			AmountMilliunits: -12990000,
			PayeeName:        "Comercio",
			Memo:             "boleta 123",
		}),
	}
	client := NewClient(server.URL, "token-123", server.Client())

	_, err := client.CreateTransaction(context.Background(), "default", payload)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientReturnsReadableAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"id":"401","name":"not_authorized","detail":"Invalid token"}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetPlans(context.Background())
	if err == nil {
		t.Fatal("err = nil, want API error")
	}

	message := err.Error()
	for _, want := range []string{"401", "not_authorized", "Invalid token"} {
		if !strings.Contains(message, want) {
			t.Fatalf("err = %q, want it to contain %q", message, want)
		}
	}
}
