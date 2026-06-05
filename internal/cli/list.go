package cli

import (
	"errors"
	"fmt"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	"github.com/spf13/cobra"
)

const missingTokenMessage = "No YNAB token found. Run `ynab-expense auth set-token` or export YNAB_API_TOKEN."

func (a *App) newBudgetsCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "budgets",
		Short: "List YNAB budgets",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}

			body, err := client.GetPlans(cmd.Context())
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}
}

func (a *App) newAccountsCommand() *cobra.Command {
	var budget string
	cmd := &cobra.Command{
		Use:   "accounts",
		Short: "List YNAB accounts",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}

			body, err := client.GetAccounts(cmd.Context(), budget)
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget ID")
	return cmd
}

func (a *App) newCategoriesCommand() *cobra.Command {
	var budget string
	cmd := &cobra.Command{
		Use:   "categories",
		Short: "List YNAB categories",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}

			body, err := client.GetCategories(cmd.Context(), budget)
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget ID")
	return cmd
}

func (a *App) newTransactionsCommand() *cobra.Command {
	var budget string
	var since string
	var until string
	cmd := &cobra.Command{
		Use:   "transactions",
		Short: "List YNAB transactions",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := a.clientForCommand(cmd)
			if err != nil {
				return err
			}

			body, err := client.GetTransactions(cmd.Context(), budget, since, until)
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}
	cmd.Flags().StringVar(&budget, "budget", "default", "YNAB budget ID")
	cmd.Flags().StringVar(&since, "since", "", "Start date in YYYY-MM-DD")
	cmd.Flags().StringVar(&until, "until", "", "End date in YYYY-MM-DD")
	return cmd
}

func (a *App) clientForCommand(cmd *cobra.Command) (ynabClient, error) {
	if a.deps.tokenResolver == nil {
		return nil, fmt.Errorf("token resolver is not configured")
	}

	token, _, err := a.deps.tokenResolver.Token(cmd.Context())
	if err != nil {
		if errors.Is(err, auth.ErrTokenNotFound) {
			return nil, fmt.Errorf(missingTokenMessage)
		}
		return nil, err
	}
	if a.deps.ynabClientFactory == nil {
		return nil, fmt.Errorf("YNAB client factory is not configured")
	}
	return a.deps.ynabClientFactory(token), nil
}

func (a *App) writeJSON(body []byte) error {
	if _, err := a.out.Write(body); err != nil {
		return err
	}
	_, err := fmt.Fprintln(a.out)
	return err
}
