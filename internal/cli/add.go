package cli

import (
	"encoding/json"
	"fmt"

	"github.com/birrein/ynab-expense-cli/internal/money"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
	"github.com/spf13/cobra"
)

func (a *App) newAddCommand() *cobra.Command {
	var budget string
	var accountID string
	var amount string
	var currency string
	var payee string
	var date string
	var categoryID string
	var memo string
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

			milliunits, err := money.ParseExpenseMilliunits(amount, currency)
			if err != nil {
				return err
			}

			payload := transactions.PostTransactionRequest{
				Transaction: transactions.BuildExpense(transactions.Input{
					AccountID:        accountID,
					Date:             date,
					AmountMilliunits: milliunits,
					PayeeName:        payee,
					CategoryID:       categoryID,
					Memo:             memo,
				}),
			}

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
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Preview transaction without sending it")
	cmd.Flags().BoolVar(&commit, "commit", false, "Create transaction in YNAB")

	for _, name := range []string{"account-id", "amount", "payee", "date"} {
		if err := cmd.MarkFlagRequired(name); err != nil {
			panic(err)
		}
	}

	return cmd
}
