package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	localconfig "github.com/birrein/ynab-expense-cli/internal/config"
	"github.com/spf13/cobra"
)

func (a *App) newConfigCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage local CLI defaults",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return cmd.Help()
		},
	}

	cmd.AddCommand(a.newConfigShowCommand())
	cmd.AddCommand(a.newConfigSetDefaultsCommand())

	return cmd
}

func (a *App) newConfigShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show local CLI defaults",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := a.loadConfig()
			if err != nil {
				return err
			}
			if cfg == (localconfig.Config{}) {
				_, err = fmt.Fprintln(a.out, "{}")
				return err
			}

			data, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return fmt.Errorf("marshal config: %w", err)
			}
			_, err = fmt.Fprintln(a.out, string(data))
			return err
		},
	}
}

func (a *App) newConfigSetDefaultsCommand() *cobra.Command {
	var budgetID string
	var budgetName string
	var accountID string
	var accountName string

	cmd := &cobra.Command{
		Use:   "set-defaults",
		Short: "Set local CLI defaults",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			budgetID = strings.TrimSpace(budgetID)
			budgetName = strings.TrimSpace(budgetName)
			accountID = strings.TrimSpace(accountID)
			accountName = strings.TrimSpace(accountName)

			if a.deps.configStore == nil {
				return errors.New("config store is unavailable")
			}

			cfg, err := a.loadConfig()
			if err != nil {
				return err
			}

			if budgetID == "" && accountID == "" && budgetName == "" && accountName == "" {
				return errors.New("at least one default value is required")
			}
			if budgetName != "" && budgetID == "" && cfg.DefaultBudgetID == "" {
				return errors.New("--budget-name requires --budget-id or an existing default budget")
			}
			if accountName != "" && accountID == "" && cfg.DefaultAccountID == "" {
				return errors.New("--account-name requires --account-id or an existing default account")
			}

			_, err = a.deps.configStore.Update(localconfig.Config{
				DefaultBudgetID:    budgetID,
				DefaultBudgetName:  budgetName,
				DefaultAccountID:   accountID,
				DefaultAccountName: accountName,
			})
			if err != nil {
				return err
			}
			_, err = fmt.Fprintln(a.out, "Config saved.")
			return err
		},
	}

	cmd.Flags().StringVar(&budgetID, "budget-id", "", "default budget id")
	cmd.Flags().StringVar(&budgetName, "budget-name", "", "default budget name")
	cmd.Flags().StringVar(&accountID, "account-id", "", "default account id")
	cmd.Flags().StringVar(&accountName, "account-name", "", "default account name")

	return cmd
}

func (a *App) loadConfig() (localconfig.Config, error) {
	if a.deps.configStore == nil {
		return localconfig.Config{}, nil
	}
	return a.deps.configStore.Load()
}

type unavailableConfigStore struct {
	err error
}

func (s unavailableConfigStore) Load() (localconfig.Config, error) {
	if s.err != nil {
		return localconfig.Config{}, s.err
	}
	return localconfig.Config{}, errors.New("config store is unavailable")
}

func (s unavailableConfigStore) Update(localconfig.Config) (localconfig.Config, error) {
	if s.err != nil {
		return localconfig.Config{}, s.err
	}
	return localconfig.Config{}, errors.New("config store is unavailable")
}
