package cli

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/scheduled"
	"github.com/spf13/cobra"
)

type scheduledAddInput struct {
	Budget     string
	AccountID  string
	Amount     string
	Currency   string
	Payee      string
	Date       string
	CategoryID string
	Memo       string
	Frequency  string
}

type scheduledEditOptions struct {
	budget     string
	id         string
	accountID  string
	date       string
	amount     string
	currency   string
	payee      string
	categoryID string
	memo       string
	frequency  string
	dryRun     bool
	commit     bool
}

type scheduledEditDryRunOutput struct {
	DryRun                 bool                                     `json:"dry_run"`
	Budget                 string                                   `json:"budget"`
	Operation              string                                   `json:"operation"`
	ScheduledTransactionID string                                   `json:"scheduled_transaction_id"`
	Before                 json.RawMessage                          `json:"before"`
	Payload                scheduled.PutScheduledTransactionRequest `json:"payload"`
}

func (a *App) newScheduledCommand() *cobra.Command {
	var budget string
	var since string
	var until string
	cmd := &cobra.Command{
		Use:   "scheduled",
		Short: "List YNAB scheduled transactions",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if strings.TrimSpace(since) != "" {
				if _, err := scheduled.ParseDate(since); err != nil {
					return fmt.Errorf("--since must be YYYY-MM-DD")
				}
			}
			if strings.TrimSpace(until) != "" {
				if _, err := scheduled.ParseDate(until); err != nil {
					return fmt.Errorf("--until must be YYYY-MM-DD")
				}
			}

			resolvedBudget, err := a.resolveBudget(cmd, budget)
			if err != nil {
				return err
			}
			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}
			body, err := client.GetScheduledTransactions(cmd.Context(), resolvedBudget)
			if err != nil {
				return err
			}
			filtered, err := scheduled.FilterListResponse(body, since, until)
			if err != nil {
				return err
			}
			return a.writeJSON(filtered)
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&since, "since", "", "Start date in YYYY-MM-DD")
	cmd.Flags().StringVar(&until, "until", "", "End date in YYYY-MM-DD")
	cmd.AddCommand(a.newScheduledAddCommand())
	cmd.AddCommand(a.newScheduledEditCommand())
	return cmd
}

func (a *App) newScheduledAddCommand() *cobra.Command {
	var input scheduledAddInput
	var filePath string
	var dryRun bool
	var commit bool
	input.Budget = "default"
	input.Currency = "CLP"
	input.Frequency = "never"

	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add a YNAB scheduled expense transaction",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if dryRun && commit {
				return fmt.Errorf("--dry-run cannot be used with --commit")
			}
			if cmd.Flags().Changed("file") {
				return fmt.Errorf("--file is not supported for scheduled transactions")
			}

			resolvedBudget, err := a.resolveBudget(cmd, input.Budget)
			if err != nil {
				return err
			}
			input.Budget = resolvedBudget

			resolvedAccountID, err := a.resolveAccountID(cmd, input.AccountID)
			if err != nil {
				return err
			}
			input.AccountID = resolvedAccountID

			normalized, err := validateScheduledAddInput(input, time.Now())
			if err != nil {
				return err
			}
			milliunits, err := money.ParseExpenseMilliunits(normalized.Amount, normalized.Currency)
			if err != nil {
				return err
			}

			payload := scheduled.PostScheduledTransactionRequest{
				ScheduledTransaction: scheduled.BuildExpense(scheduled.Input{
					AccountID:        normalized.AccountID,
					Date:             normalized.Date,
					AmountMilliunits: milliunits,
					PayeeName:        normalized.Payee,
					CategoryID:       normalized.CategoryID,
					Memo:             normalized.Memo,
					Frequency:        normalized.Frequency,
				}),
			}
			if !commit {
				body, err := json.MarshalIndent(struct {
					DryRun  bool                                      `json:"dry_run"`
					Budget  string                                    `json:"budget"`
					Payload scheduled.PostScheduledTransactionRequest `json:"payload"`
				}{
					DryRun:  true,
					Budget:  normalized.Budget,
					Payload: payload,
				}, "", "  ")
				if err != nil {
					return err
				}
				return a.writeJSON(body)
			}

			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}
			body, err := client.CreateScheduledTransaction(cmd.Context(), normalized.Budget, payload)
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}

	cmd.Flags().StringVar(&input.Budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&input.AccountID, "account-id", "", "YNAB account ID")
	cmd.Flags().StringVar(&input.Amount, "amount", "", "Expense amount")
	cmd.Flags().StringVar(&input.Currency, "currency", "CLP", "Expense currency")
	cmd.Flags().StringVar(&input.Payee, "payee", "", "Payee name")
	cmd.Flags().StringVar(&input.Date, "date", "", "Scheduled transaction date in YYYY-MM-DD")
	cmd.Flags().StringVar(&input.CategoryID, "category-id", "", "YNAB category ID")
	cmd.Flags().StringVar(&input.Memo, "memo", "", "Transaction memo")
	cmd.Flags().StringVar(&input.Frequency, "frequency", "never", "Scheduled transaction frequency")
	cmd.Flags().StringVar(&filePath, "file", "", "Unsupported for scheduled transactions")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Preview scheduled transaction without sending it")
	cmd.Flags().BoolVar(&commit, "commit", false, "Create scheduled transaction in YNAB")
	return cmd
}

func validateScheduledAddInput(input scheduledAddInput, today time.Time) (scheduledAddInput, error) {
	input.Budget = strings.TrimSpace(input.Budget)
	input.AccountID = strings.TrimSpace(input.AccountID)
	input.Amount = strings.TrimSpace(input.Amount)
	input.Currency = strings.TrimSpace(input.Currency)
	input.Payee = strings.TrimSpace(input.Payee)
	input.Date = strings.TrimSpace(input.Date)
	input.CategoryID = strings.TrimSpace(input.CategoryID)
	input.Memo = strings.TrimSpace(input.Memo)
	input.Frequency = strings.TrimSpace(input.Frequency)
	if input.Frequency == "" {
		input.Frequency = "never"
	}

	if input.Budget == "" {
		return scheduledAddInput{}, fmt.Errorf("--budget is required")
	}
	if input.AccountID == "" {
		return scheduledAddInput{}, fmt.Errorf("--account-id is required")
	}
	if input.Amount == "" {
		return scheduledAddInput{}, fmt.Errorf("--amount is required")
	}
	if input.Payee == "" {
		return scheduledAddInput{}, fmt.Errorf("--payee is required")
	}
	if input.Date == "" {
		return scheduledAddInput{}, fmt.Errorf("--date is required")
	}
	if err := scheduled.ValidateScheduledDate(input.Date, today); err != nil {
		return scheduledAddInput{}, err
	}
	if err := scheduled.ValidateFrequency(input.Frequency); err != nil {
		return scheduledAddInput{}, err
	}
	return input, nil
}

func (a *App) newScheduledEditCommand() *cobra.Command {
	opts := scheduledEditOptions{budget: "default", currency: "CLP"}
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Edit an existing YNAB scheduled transaction",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.runScheduledEdit(cmd, opts)
		},
	}
	cmd.Flags().StringVar(&opts.budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&opts.id, "id", "", "YNAB scheduled transaction ID")
	cmd.Flags().StringVar(&opts.accountID, "account-id", "", "New YNAB account ID")
	cmd.Flags().StringVar(&opts.date, "date", "", "New scheduled transaction date in YYYY-MM-DD")
	cmd.Flags().StringVar(&opts.amount, "amount", "", "New expense amount")
	cmd.Flags().StringVar(&opts.currency, "currency", "CLP", "Amount currency")
	cmd.Flags().StringVar(&opts.payee, "payee", "", "New payee name")
	cmd.Flags().StringVar(&opts.categoryID, "category-id", "", "New YNAB category ID")
	cmd.Flags().StringVar(&opts.memo, "memo", "", "New transaction memo")
	cmd.Flags().StringVar(&opts.frequency, "frequency", "", "New scheduled transaction frequency")
	cmd.Flags().BoolVar(&opts.dryRun, "dry-run", false, "Preview edit without sending it")
	cmd.Flags().BoolVar(&opts.commit, "commit", false, "Commit edit to YNAB")
	return cmd
}

func (a *App) runScheduledEdit(cmd *cobra.Command, opts scheduledEditOptions) error {
	if err := validateScheduledEditCommon(cmd, &opts, time.Now()); err != nil {
		return err
	}

	resolvedBudget, err := a.resolveBudget(cmd, opts.budget)
	if err != nil {
		return err
	}
	change, err := buildScheduledEditChange(cmd, opts)
	if err != nil {
		return err
	}
	client, err := a.clientForCommand(cmd)
	if err != nil {
		return err
	}
	body, err := client.GetScheduledTransaction(cmd.Context(), resolvedBudget, opts.id)
	if err != nil {
		return err
	}
	detail, rawBefore, err := scheduled.ParseDetailResponse(body)
	if err != nil {
		return err
	}
	if detail.ID != opts.id {
		return fmt.Errorf("fetched scheduled transaction id %q does not match requested id %q", detail.ID, opts.id)
	}
	save, err := scheduled.BuildFromDetail(detail, change)
	if err != nil {
		return err
	}
	payload := scheduled.PutScheduledTransactionRequest{ScheduledTransaction: save}

	if !opts.commit {
		preview, err := json.MarshalIndent(scheduledEditDryRunOutput{
			DryRun:                 true,
			Budget:                 resolvedBudget,
			Operation:              "scheduled_edit",
			ScheduledTransactionID: opts.id,
			Before:                 rawBefore,
			Payload:                payload,
		}, "", "  ")
		if err != nil {
			return err
		}
		return a.writeJSON(preview)
	}

	response, err := client.UpdateScheduledTransaction(cmd.Context(), resolvedBudget, opts.id, payload)
	if err != nil {
		return err
	}
	return a.writeJSON(response)
}

func validateScheduledEditCommon(cmd *cobra.Command, opts *scheduledEditOptions, today time.Time) error {
	if opts.dryRun && opts.commit {
		return fmt.Errorf("--dry-run cannot be used with --commit")
	}
	opts.id = strings.TrimSpace(opts.id)
	if opts.id == "" {
		return fmt.Errorf("--id is required")
	}
	if len(scheduledEditDetailFlagsChanged(cmd)) == 0 {
		return fmt.Errorf("at least one edit field is required")
	}
	if cmd.Flags().Changed("currency") && !cmd.Flags().Changed("amount") {
		return fmt.Errorf("--currency requires --amount")
	}
	if cmd.Flags().Changed("date") {
		date := strings.TrimSpace(opts.date)
		if date == "" {
			return fmt.Errorf("--date is required")
		}
		if err := scheduled.ValidateScheduledDate(date, today); err != nil {
			return err
		}
	}
	if cmd.Flags().Changed("frequency") {
		if strings.TrimSpace(opts.frequency) == "" {
			return fmt.Errorf("--frequency is required")
		}
		if err := scheduled.ValidateFrequency(opts.frequency); err != nil {
			return err
		}
	}
	return nil
}

func buildScheduledEditChange(cmd *cobra.Command, opts scheduledEditOptions) (scheduled.ChangeInput, error) {
	var change scheduled.ChangeInput
	if cmd.Flags().Changed("account-id") {
		accountID := strings.TrimSpace(opts.accountID)
		if accountID == "" {
			return scheduled.ChangeInput{}, fmt.Errorf("--account-id is required")
		}
		change.AccountID = accountID
	}
	if cmd.Flags().Changed("date") {
		change.Date = strings.TrimSpace(opts.date)
	}
	if cmd.Flags().Changed("amount") {
		milliunits, err := money.ParseExpenseMilliunits(opts.amount, opts.currency)
		if err != nil {
			return scheduled.ChangeInput{}, err
		}
		change.Amount = &milliunits
	}
	if cmd.Flags().Changed("payee") {
		payee := strings.TrimSpace(opts.payee)
		if payee == "" {
			return scheduled.ChangeInput{}, fmt.Errorf("--payee is required")
		}
		change.PayeeName = payee
	}
	if cmd.Flags().Changed("category-id") {
		categoryID := strings.TrimSpace(opts.categoryID)
		if categoryID == "" {
			return scheduled.ChangeInput{}, fmt.Errorf("--category-id is required")
		}
		change.CategoryID = &categoryID
	}
	if cmd.Flags().Changed("memo") {
		memo := strings.TrimSpace(opts.memo)
		change.Memo = &memo
	}
	if cmd.Flags().Changed("frequency") {
		change.Frequency = strings.TrimSpace(opts.frequency)
	}
	return change, nil
}

func scheduledEditDetailFlagsChanged(cmd *cobra.Command) []string {
	names := []string{"account-id", "date", "amount", "payee", "category-id", "memo", "frequency"}
	changed := make([]string, 0, len(names))
	for _, name := range names {
		if cmd.Flags().Changed(name) {
			changed = append(changed, "--"+name)
		}
	}
	return changed
}
