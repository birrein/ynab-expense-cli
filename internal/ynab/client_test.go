package ynab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/birrein/ynab-expense-cli/internal/scheduled"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

func TestNewClientUsesDefaultBaseURLAndHTTPClient(t *testing.T) {
	client := NewClient("", "token-123", nil)

	if client.baseURL != DefaultBaseURL {
		t.Fatalf("baseURL = %q, want %q", client.baseURL, DefaultBaseURL)
	}
	if client.httpClient == nil {
		t.Fatal("httpClient = nil, want non-nil default client")
	}
}

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

func TestClientGetAccountsUsesPathAndAcceptHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans/default/accounts" {
			t.Fatalf("path = %q, want /plans/default/accounts", r.URL.Path)
		}
		if got := r.Header.Get("Accept"); got != "application/json" {
			t.Fatalf("Accept = %q, want application/json", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"accounts":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetAccounts(context.Background(), "default")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientGetAccountsTrimsTrailingSlashFromBaseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans/default/accounts" {
			t.Fatalf("path = %q, want /plans/default/accounts", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"accounts":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL+"/", "token-123", server.Client())
	_, err := client.GetAccounts(context.Background(), "default")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientGetAccountsEscapesBudgetPathSegment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.EscapedPath() != "/plans/budget%2Fwith%2Fslash/accounts" {
			t.Fatalf("escaped path = %q, want /plans/budget%%2Fwith%%2Fslash/accounts", r.URL.EscapedPath())
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"accounts":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetAccounts(context.Background(), "budget/with/slash")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientGetCategoriesUsesPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/plans/default/categories" {
			t.Fatalf("path = %q, want /plans/default/categories", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"categories":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetCategories(context.Background(), "default")
	if err != nil {
		t.Fatal(err)
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
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", got)
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

func TestClientGetTransactionUsesEscapedPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %q, want GET", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/budget%2Fid/transactions/tx%2Fid" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token-123" {
			t.Fatalf("Authorization = %q, want Bearer token-123", got)
		}
		_, _ = w.Write([]byte(`{"data":{"transaction":{"id":"tx/id"}}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	body, err := client.GetTransaction(context.Background(), "budget/id", "tx/id")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"tx/id"`) {
		t.Fatalf("body = %s", body)
	}
}

func TestClientGetScheduledTransactionsUsesPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %q, want GET", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/budget%2Fid/scheduled_transactions" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		if got := r.Header.Get("Authorization"); got != "Bearer token-123" {
			t.Fatalf("Authorization = %q, want Bearer token-123", got)
		}
		_, _ = w.Write([]byte(`{"data":{"scheduled_transactions":[]}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.GetScheduledTransactions(context.Background(), "budget/id")
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientGetScheduledTransactionUsesEscapedPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %q, want GET", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/budget%2Fid/scheduled_transactions/scheduled%2Fid" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		_, _ = w.Write([]byte(`{"data":{"scheduled_transaction":{"id":"scheduled/id"}}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	body, err := client.GetScheduledTransaction(context.Background(), "budget/id", "scheduled/id")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"scheduled/id"`) {
		t.Fatalf("body = %s", body)
	}
}

func TestClientCreateScheduledTransactionPostsPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/plans/default/scheduled_transactions" {
			t.Fatalf("path = %q, want /plans/default/scheduled_transactions", r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", got)
		}
		var payload scheduled.PostScheduledTransactionRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.ScheduledTransaction.AccountID != "account-1" {
			t.Fatalf("payload = %#v", payload)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"data":{"scheduled_transaction":{"id":"scheduled-1"}}}`))
	}))
	defer server.Close()

	payload := scheduled.PostScheduledTransactionRequest{
		ScheduledTransaction: scheduled.BuildExpense(scheduled.Input{
			AccountID:        "account-1",
			Date:             "2026-08-23",
			AmountMilliunits: -23332000,
			PayeeName:        "Mercado Libre",
			Frequency:        "never",
		}),
	}
	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.CreateScheduledTransaction(context.Background(), "default", payload)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientUpdateScheduledTransactionPutsPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Fatalf("method = %q, want PUT", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/default/scheduled_transactions/scheduled%2F1" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", got)
		}
		var payload scheduled.PutScheduledTransactionRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.ScheduledTransaction.Memo != "Updated memo" {
			t.Fatalf("payload = %#v", payload)
		}
		_, _ = w.Write([]byte(`{"data":{"scheduled_transaction":{"id":"scheduled/1"}}}`))
	}))
	defer server.Close()

	payload := scheduled.PutScheduledTransactionRequest{
		ScheduledTransaction: scheduled.SaveScheduledTransaction{
			AccountID: "account-1",
			Date:      "2026-08-23",
			Amount:    -23332000,
			Memo:      "Updated memo",
		},
	}
	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.UpdateScheduledTransaction(context.Background(), "default", "scheduled/1", payload)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientPatchTransactionsSendsPatchPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Fatalf("method = %q, want PATCH", r.Method)
		}
		if r.URL.Path != "/plans/default/transactions" {
			t.Fatalf("path = %q, want /plans/default/transactions", r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", got)
		}
		var payload transactions.PatchTransactionsRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Transactions) != 1 || payload.Transactions[0].ID != "tx-123" {
			t.Fatalf("payload = %#v", payload)
		}
		_, _ = w.Write([]byte(`{"data":{"transaction_ids":["tx-123"]}}`))
	}))
	defer server.Close()

	memo := "Uber One"
	payload := transactions.PatchTransactionsRequest{
		Transactions: []transactions.PatchTransaction{
			transactions.BuildPatch(transactions.PatchInput{ID: "tx-123", Memo: &memo}),
		},
	}
	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.PatchTransactions(context.Background(), "default", payload)
	if err != nil {
		t.Fatal(err)
	}
}

func TestClientDeleteTransactionUsesDelete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("method = %q, want DELETE", r.Method)
		}
		if r.URL.EscapedPath() != "/plans/default/transactions/tx%2F123" {
			t.Fatalf("escaped path = %q", r.URL.EscapedPath())
		}
		_, _ = w.Write([]byte(`{"data":{"transaction":{"id":"tx/123","deleted":true}}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "token-123", server.Client())
	_, err := client.DeleteTransaction(context.Background(), "default", "tx/123")
	if err != nil {
		t.Fatal(err)
	}
}
