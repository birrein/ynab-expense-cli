package cli

import (
	"errors"
	"fmt"
	"strings"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

func (a *App) newAuthCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Manage YNAB authentication",
	}

	cmd.AddCommand(a.newAuthSetTokenCommand())
	cmd.AddCommand(a.newAuthStatusCommand())
	return cmd
}

func (a *App) newAuthSetTokenCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "set-token [token]",
		Short: "Store a YNAB API token",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token := ""
			if len(args) == 1 {
				token = args[0]
			} else {
				prompted, err := a.promptToken()
				if err != nil {
					return err
				}
				token = prompted
			}

			token = strings.TrimSpace(token)
			if token == "" {
				return fmt.Errorf("token is required")
			}
			if a.deps.tokenStore == nil {
				return fmt.Errorf("token store is not configured")
			}
			if err := a.deps.tokenStore.Set(cmd.Context(), token); err != nil {
				return err
			}

			fmt.Fprintln(a.out, "YNAB token saved.")
			return nil
		},
	}
}

func (a *App) promptToken() (string, error) {
	stdinFD := a.deps.stdinFD
	if stdinFD == nil {
		return "", fmt.Errorf("stdin is not configured")
	}

	fmt.Fprint(a.err, "YNAB API token: ")
	tokenBytes, err := term.ReadPassword(stdinFD())
	fmt.Fprintln(a.err)
	if err != nil {
		return "", err
	}
	return string(tokenBytes), nil
}

func (a *App) newAuthStatusCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show YNAB authentication status",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.deps.tokenResolver == nil {
				return fmt.Errorf("token resolver is not configured")
			}

			_, source, err := a.deps.tokenResolver.Token(cmd.Context())
			if err != nil {
				if errors.Is(err, auth.ErrTokenNotFound) {
					fmt.Fprintln(a.out, "YNAB token not configured.")
					return nil
				}
				return err
			}

			fmt.Fprintf(a.out, "YNAB token configured via %s.\n", source)
			return nil
		},
	}
}
