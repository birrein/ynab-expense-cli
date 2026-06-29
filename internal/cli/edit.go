package cli

import (
	"fmt"
	"strings"

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
	if opts.dryRun && opts.commit {
		return fmt.Errorf("--dry-run cannot be used with --commit")
	}
	opts.id = strings.TrimSpace(opts.id)
	if opts.id == "" {
		return fmt.Errorf("--id is required")
	}
	if !cmd.Flags().Changed("file") && !opts.replaceSplit && len(editDetailFlagsChanged(cmd)) == 0 {
		return fmt.Errorf("at least one edit field is required")
	}
	return fmt.Errorf("edit command is not implemented")
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
