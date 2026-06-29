package cli

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
	"github.com/spf13/cobra"
)

type editOptions struct {
	budget       string
	id           string
	accountID    string
	date         string
	amount       string
	currency     string
	payee        string
	categoryID   string
	memo         string
	cleared      string
	approved     bool
	filePath     string
	dryRun       bool
	commit       bool
	replaceSplit bool
}

type editDryRunOutput struct {
	DryRun        bool                          `json:"dry_run"`
	Budget        string                        `json:"budget"`
	Operation     string                        `json:"operation"`
	TransactionID string                        `json:"transaction_id"`
	Before        json.RawMessage               `json:"before"`
	Patch         transactions.PatchTransaction `json:"patch"`
}

type transactionResponse struct {
	Data struct {
		Transaction rawTransaction `json:"transaction"`
	} `json:"data"`
}

type rawTransaction struct {
	ID              string            `json:"id"`
	AccountID       string            `json:"account_id"`
	Date            string            `json:"date"`
	Amount          int64             `json:"amount"`
	PayeeName       string            `json:"payee_name"`
	CategoryID      *string           `json:"category_id"`
	Memo            *string           `json:"memo"`
	Subtransactions []json.RawMessage `json:"subtransactions"`
}

func (a *App) newEditCommand() *cobra.Command {
	opts := editOptions{currency: "CLP"}
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Edit an existing YNAB transaction",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.runEdit(cmd, opts)
		},
	}
	cmd.Flags().StringVar(&opts.budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&opts.id, "id", "", "YNAB transaction ID")
	cmd.Flags().StringVar(&opts.accountID, "account-id", "", "New YNAB account ID")
	cmd.Flags().StringVar(&opts.date, "date", "", "New transaction date in YYYY-MM-DD")
	cmd.Flags().StringVar(&opts.amount, "amount", "", "New expense amount")
	cmd.Flags().StringVar(&opts.currency, "currency", "CLP", "Amount currency")
	cmd.Flags().StringVar(&opts.payee, "payee", "", "New payee name")
	cmd.Flags().StringVar(&opts.categoryID, "category-id", "", "New YNAB category ID")
	cmd.Flags().StringVar(&opts.memo, "memo", "", "New transaction memo")
	cmd.Flags().StringVar(&opts.cleared, "cleared", "", "New cleared status")
	cmd.Flags().BoolVar(&opts.approved, "approved", false, "New approved status")
	cmd.Flags().StringVar(&opts.filePath, "file", "", "Read replacement split input from a JSON file")
	cmd.Flags().BoolVar(&opts.dryRun, "dry-run", false, "Preview edit without sending it")
	cmd.Flags().BoolVar(&opts.commit, "commit", false, "Commit edit to YNAB")
	cmd.Flags().BoolVar(&opts.replaceSplit, "replace-split", false, "Replace a transaction with a split transaction from --file")
	return cmd
}

func (a *App) runEdit(cmd *cobra.Command, opts editOptions) error {
	if err := validateEditCommon(cmd, &opts); err != nil {
		return err
	}
	if cmd.Flags().Changed("file") || opts.replaceSplit {
		return a.runReplaceSplitEdit(cmd, opts)
	}
	if len(editDetailFlagsChanged(cmd)) == 0 {
		return fmt.Errorf("at least one edit field is required")
	}

	resolvedBudget, err := a.resolveBudget(cmd, opts.budget)
	if err != nil {
		return err
	}
	patch, err := buildSimpleEditPatch(cmd, opts)
	if err != nil {
		return err
	}
	client, err := a.clientForCommand(cmd)
	if err != nil {
		return err
	}
	body, err := client.GetTransaction(cmd.Context(), resolvedBudget, opts.id)
	if err != nil {
		return err
	}
	_, rawBefore, err := parseTransactionResponse(body)
	if err != nil {
		return err
	}
	if !opts.commit {
		preview, err := json.MarshalIndent(editDryRunOutput{
			DryRun:        true,
			Budget:        resolvedBudget,
			Operation:     "edit",
			TransactionID: opts.id,
			Before:        rawBefore,
			Patch:         patch,
		}, "", "  ")
		if err != nil {
			return err
		}
		return a.writeJSON(preview)
	}
	response, err := client.PatchTransactions(cmd.Context(), resolvedBudget, transactions.PatchTransactionsRequest{
		Transactions: []transactions.PatchTransaction{patch},
	})
	if err != nil {
		return err
	}
	return a.writeJSON(response)
}

func validateEditCommon(cmd *cobra.Command, opts *editOptions) error {
	if opts.dryRun && opts.commit {
		return fmt.Errorf("--dry-run cannot be used with --commit")
	}
	opts.id = strings.TrimSpace(opts.id)
	if opts.id == "" {
		return fmt.Errorf("--id is required")
	}
	if cmd.Flags().Changed("currency") && !cmd.Flags().Changed("amount") {
		return fmt.Errorf("--currency requires --amount")
	}
	if strings.TrimSpace(opts.date) != "" {
		parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(opts.date))
		if err != nil || parsedDate.Format("2006-01-02") != strings.TrimSpace(opts.date) {
			return fmt.Errorf("--date must be YYYY-MM-DD")
		}
	}
	if strings.TrimSpace(opts.cleared) != "" {
		switch strings.TrimSpace(opts.cleared) {
		case "cleared", "uncleared", "reconciled":
		default:
			return fmt.Errorf("--cleared must be one of: cleared, uncleared, reconciled")
		}
	}
	return nil
}

func parseTransactionResponse(body []byte) (rawTransaction, json.RawMessage, error) {
	var wrapper struct {
		Data struct {
			Transaction json.RawMessage `json:"transaction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return rawTransaction{}, nil, err
	}
	if len(wrapper.Data.Transaction) == 0 {
		return rawTransaction{}, nil, fmt.Errorf("transaction response missing transaction")
	}
	var tx rawTransaction
	if err := json.Unmarshal(wrapper.Data.Transaction, &tx); err != nil {
		return rawTransaction{}, nil, err
	}
	return tx, wrapper.Data.Transaction, nil
}

func buildSimpleEditPatch(cmd *cobra.Command, opts editOptions) (transactions.PatchTransaction, error) {
	input := transactions.PatchInput{ID: opts.id}
	if cmd.Flags().Changed("account-id") {
		accountID := strings.TrimSpace(opts.accountID)
		if accountID == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--account-id is required")
		}
		input.AccountID = accountID
	}
	if cmd.Flags().Changed("date") {
		input.Date = strings.TrimSpace(opts.date)
	}
	if cmd.Flags().Changed("amount") {
		milliunits, err := money.ParseExpenseMilliunits(opts.amount, opts.currency)
		if err != nil {
			return transactions.PatchTransaction{}, err
		}
		input.Amount = &milliunits
	}
	if cmd.Flags().Changed("payee") {
		payee := strings.TrimSpace(opts.payee)
		if payee == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--payee is required")
		}
		input.PayeeName = payee
	}
	if cmd.Flags().Changed("category-id") {
		categoryID := strings.TrimSpace(opts.categoryID)
		if categoryID == "" {
			return transactions.PatchTransaction{}, fmt.Errorf("--category-id is required")
		}
		input.CategoryID = &categoryID
	}
	if cmd.Flags().Changed("memo") {
		memo := strings.TrimSpace(opts.memo)
		input.Memo = &memo
	}
	if cmd.Flags().Changed("cleared") {
		input.Cleared = strings.TrimSpace(opts.cleared)
	}
	if cmd.Flags().Changed("approved") {
		input.Approved = &opts.approved
	}
	return transactions.BuildPatch(input), nil
}

func (a *App) runReplaceSplitEdit(cmd *cobra.Command, opts editOptions) error {
	return fmt.Errorf("replace-split edit is not implemented")
}

func editDetailFlagsChanged(cmd *cobra.Command) []string {
	names := []string{"account-id", "date", "amount", "payee", "category-id", "memo", "cleared", "approved"}
	changed := make([]string, 0, len(names))
	for _, name := range names {
		if cmd.Flags().Changed(name) {
			changed = append(changed, "--"+name)
		}
	}
	return changed
}
