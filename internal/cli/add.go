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

type addInput struct {
	Budget     string
	AccountID  string
	Amount     string
	Currency   string
	Payee      string
	Date       string
	CategoryID string
	Memo       string
}

func (a *App) newAddCommand() *cobra.Command {
	var budget string
	var accountID string
	var amount string
	var currency string
	var payee string
	var date string
	var categoryID string
	var memo string
	var filePath string
	var dryRun bool
	var commit bool

	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add a YNAB expense transaction",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if dryRun && commit {
				return fmt.Errorf("--dry-run cannot be used with --commit")
			}

			if cmd.Flags().Changed("file") {
				if changed := addDetailFlagsChanged(cmd); len(changed) > 0 {
					return fmt.Errorf("--file cannot be combined with transaction detail flags: %s", strings.Join(changed, ", "))
				}

				fileInput, err := loadAddFileInput(filePath)
				if err != nil {
					return err
				}

				normalized, err := normalizeAddFileInput(fileInput)
				if err != nil {
					return err
				}

				resolvedBudget, err := a.resolveBudgetFromValue(cmd, normalized.Budget, normalized.ExplicitBudget)
				if err != nil {
					return err
				}
				normalized.Budget = resolvedBudget

				resolvedAccountID, err := a.resolveAccountIDFromValue(normalized.AccountID, normalized.ExplicitAccount)
				if err != nil {
					return err
				}
				normalized.AccountID = resolvedAccountID

				input, err := validateAddInput(normalized.addInput)
				if err != nil {
					return err
				}

				payload := transactions.PostTransactionRequest{
					Transaction: transactions.BuildExpense(transactions.Input{
						AccountID:        input.AccountID,
						Date:             input.Date,
						AmountMilliunits: normalized.AmountMilliunits,
						PayeeName:        input.Payee,
						CategoryID:       input.CategoryID,
						Memo:             input.Memo,
						Splits:           normalized.Splits,
					}),
				}

				return a.writeOrCommitAddPayload(cmd, commit, input.Budget, payload)
			}

			rawInput := addInput{
				Budget:     budget,
				AccountID:  accountID,
				Amount:     amount,
				Currency:   currency,
				Payee:      payee,
				Date:       date,
				CategoryID: categoryID,
				Memo:       memo,
			}

			resolvedBudget, err := a.resolveBudget(cmd, rawInput.Budget)
			if err != nil {
				return err
			}
			rawInput.Budget = resolvedBudget

			resolvedAccountID, err := a.resolveAccountID(cmd, rawInput.AccountID)
			if err != nil {
				return err
			}
			rawInput.AccountID = resolvedAccountID

			input, err := validateAddInput(rawInput)
			if err != nil {
				return err
			}

			milliunits, err := money.ParseExpenseMilliunits(input.Amount, input.Currency)
			if err != nil {
				return err
			}

			payload := transactions.PostTransactionRequest{
				Transaction: transactions.BuildExpense(transactions.Input{
					AccountID:        input.AccountID,
					Date:             input.Date,
					AmountMilliunits: milliunits,
					PayeeName:        input.Payee,
					CategoryID:       input.CategoryID,
					Memo:             input.Memo,
				}),
			}

			return a.writeOrCommitAddPayload(cmd, commit, input.Budget, payload)
		},
	}

	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&accountID, "account-id", "", "YNAB account ID")
	cmd.Flags().StringVar(&amount, "amount", "", "Expense amount")
	cmd.Flags().StringVar(&currency, "currency", "CLP", "Expense currency")
	cmd.Flags().StringVar(&payee, "payee", "", "Payee name")
	cmd.Flags().StringVar(&date, "date", "", "Transaction date in YYYY-MM-DD")
	cmd.Flags().StringVar(&categoryID, "category-id", "", "YNAB category ID")
	cmd.Flags().StringVar(&memo, "memo", "", "Transaction memo")
	cmd.Flags().StringVar(&filePath, "file", "", "Read expense input from a JSON file")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Preview transaction without sending it")
	cmd.Flags().BoolVar(&commit, "commit", false, "Create transaction in YNAB")

	return cmd
}

func (a *App) resolveAccountID(cmd *cobra.Command, accountID string) (string, error) {
	return a.resolveAccountIDFromValue(accountID, cmd.Flags().Changed("account-id"))
}

func (a *App) resolveAccountIDFromValue(accountID string, explicit bool) (string, error) {
	if explicit {
		return accountID, nil
	}

	cfg, err := a.loadConfig()
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(cfg.DefaultAccountID) != "" {
		return strings.TrimSpace(cfg.DefaultAccountID), nil
	}
	return accountID, nil
}

func addDetailFlagsChanged(cmd *cobra.Command) []string {
	names := []string{"budget", "account-id", "amount", "currency", "payee", "date", "category-id", "memo"}
	changed := make([]string, 0, len(names))
	for _, name := range names {
		if cmd.Flags().Changed(name) {
			changed = append(changed, "--"+name)
		}
	}
	return changed
}

func (a *App) writeOrCommitAddPayload(cmd *cobra.Command, commit bool, budget string, payload transactions.PostTransactionRequest) error {
	if !commit {
		body, err := json.MarshalIndent(struct {
			DryRun  bool                                `json:"dry_run"`
			Budget  string                              `json:"budget"`
			Payload transactions.PostTransactionRequest `json:"payload"`
		}{
			DryRun:  true,
			Budget:  budget,
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

	body, err := client.CreateTransaction(cmd.Context(), budget, payload)
	if err != nil {
		return err
	}
	return a.writeJSON(body)
}

func validateAddInput(input addInput) (addInput, error) {
	input.Budget = strings.TrimSpace(input.Budget)
	input.AccountID = strings.TrimSpace(input.AccountID)
	input.Amount = strings.TrimSpace(input.Amount)
	input.Payee = strings.TrimSpace(input.Payee)
	input.Date = strings.TrimSpace(input.Date)

	if input.Budget == "" {
		return addInput{}, fmt.Errorf("--budget is required")
	}
	if input.AccountID == "" {
		return addInput{}, fmt.Errorf("--account-id is required")
	}
	if input.Amount == "" {
		return addInput{}, fmt.Errorf("--amount is required")
	}
	if input.Payee == "" {
		return addInput{}, fmt.Errorf("--payee is required")
	}
	if input.Date == "" {
		return addInput{}, fmt.Errorf("--date is required")
	}

	parsedDate, err := time.Parse("2006-01-02", input.Date)
	if err != nil || parsedDate.Format("2006-01-02") != input.Date {
		return addInput{}, fmt.Errorf("--date must be YYYY-MM-DD")
	}

	return input, nil
}
