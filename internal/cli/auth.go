package cli

import (
	"errors"
	"fmt"
	"io"
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
	var tokenStdin bool
	cmd := &cobra.Command{
		Use:   "set-token",
		Short: "Store a YNAB API token",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			var token string
			if tokenStdin {
				if a.deps.stdin == nil {
					return fmt.Errorf("stdin is not configured")
				}
				tokenBytes, err := io.ReadAll(a.deps.stdin)
				if err != nil {
					return fmt.Errorf("read token from stdin: %w", err)
				}
				token = string(tokenBytes)
			} else {
				if a.deps.promptToken == nil {
					return fmt.Errorf("terminal token prompt is not configured")
				}
				prompted, err := a.deps.promptToken()
				if err != nil {
					return fmt.Errorf("read token from terminal: %w", err)
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
	cmd.Flags().BoolVar(&tokenStdin, "token-stdin", false, "Read the YNAB API token from stdin")
	return cmd
}

func terminalPrompt(errOut io.Writer, stdinFD func() int) func() (string, error) {
	return func() (string, error) {
		fmt.Fprint(errOut, "YNAB API token: ")
		tokenBytes, err := term.ReadPassword(stdinFD())
		fmt.Fprintln(errOut)
		if err != nil {
			return "", err
		}
		return string(tokenBytes), nil
	}
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
