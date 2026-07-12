package ynab

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/scheduled"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
)

const DefaultBaseURL = "https://api.ynab.com/v1"

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewClient(baseURL string, token string, httpClient *http.Client) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		token:      token,
		httpClient: httpClient,
	}
}

func (c *Client) GetPlans(ctx context.Context) ([]byte, error) {
	return c.get(ctx, "/plans")
}

func (c *Client) GetAccounts(ctx context.Context, budget string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/accounts")
}

func (c *Client) GetCategories(ctx context.Context, budget string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/categories")
}

func (c *Client) GetTransactions(ctx context.Context, budget string, since string, until string) ([]byte, error) {
	path := "/plans/" + url.PathEscape(budget) + "/transactions"
	values := url.Values{}
	if since != "" {
		values.Set("since_date", since)
	}
	if until != "" {
		values.Set("until_date", until)
	}
	if query := values.Encode(); query != "" {
		path += "?" + query
	}

	return c.get(ctx, path)
}

func (c *Client) GetTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/transactions/"+url.PathEscape(transactionID))
}

func (c *Client) GetScheduledTransactions(ctx context.Context, budget string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/scheduled_transactions")
}

func (c *Client) GetScheduledTransaction(ctx context.Context, budget string, scheduledTransactionID string) ([]byte, error) {
	return c.get(ctx, "/plans/"+url.PathEscape(budget)+"/scheduled_transactions/"+url.PathEscape(scheduledTransactionID))
}

func (c *Client) CreateTransaction(ctx context.Context, budget string, payload transactions.PostTransactionRequest) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return c.do(ctx, http.MethodPost, "/plans/"+url.PathEscape(budget)+"/transactions", body)
}

func (c *Client) CreateScheduledTransaction(ctx context.Context, budget string, payload scheduled.PostScheduledTransactionRequest) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, http.MethodPost, "/plans/"+url.PathEscape(budget)+"/scheduled_transactions", body)
}

func (c *Client) PatchTransactions(ctx context.Context, budget string, payload transactions.PatchTransactionsRequest) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, http.MethodPatch, "/plans/"+url.PathEscape(budget)+"/transactions", body)
}

func (c *Client) UpdateScheduledTransaction(ctx context.Context, budget string, scheduledTransactionID string, payload scheduled.PutScheduledTransactionRequest) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, http.MethodPut, "/plans/"+url.PathEscape(budget)+"/scheduled_transactions/"+url.PathEscape(scheduledTransactionID), body)
}

func (c *Client) DeleteTransaction(ctx context.Context, budget string, transactionID string) ([]byte, error) {
	return c.do(ctx, http.MethodDelete, "/plans/"+url.PathEscape(budget)+"/transactions/"+url.PathEscape(transactionID), nil)
}

func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	return c.do(ctx, http.MethodGet, path, nil)
}

func (c *Client) do(ctx context.Context, method string, path string, body []byte) ([]byte, error) {
	var requestBody io.Reader
	if body != nil {
		requestBody = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, requestBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, apiError(resp.StatusCode, responseBody)
	}

	return responseBody, nil
}

func apiError(statusCode int, body []byte) error {
	var wrapper struct {
		Error struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Detail string `json:"detail"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &wrapper); err == nil && wrapper.Error.Name != "" {
		return fmt.Errorf("ynab api error %d: %s: %s", statusCode, wrapper.Error.Name, wrapper.Error.Detail)
	}

	return fmt.Errorf("ynab api error %d: %s", statusCode, strings.TrimSpace(string(body)))
}
