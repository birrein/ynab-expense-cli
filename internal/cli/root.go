package cli

import (
	"context"
	"io"
	"net/http"
	"os"

	"github.com/birrein/ynab-expense-cli/internal/auth"
	"github.com/birrein/ynab-expense-cli/internal/transactions"
	"github.com/birrein/ynab-expense-cli/internal/ynab"
	"github.com/spf13/cobra"
)

type App struct {
	out  io.Writer
	err  io.Writer
	deps cliDeps
}

type tokenResolver interface {
	Token(context.Context) (string, string, error)
}

type tokenStore interface {
	Set(context.Context, string) error
}

type ynabClient interface {
	GetPlans(context.Context) ([]byte, error)
	GetAccounts(context.Context, string) ([]byte, error)
	GetCategories(context.Context, string) ([]byte, error)
	GetTransactions(context.Context, string, string, string) ([]byte, error)
	CreateTransaction(context.Context, string, transactions.PostTransactionRequest) ([]byte, error)
}

type cliDeps struct {
	tokenResolver     tokenResolver
	tokenStore        tokenStore
	ynabClientFactory func(token string) ynabClient
	promptToken       func() (string, error)
	stdin             io.Reader
	stdinFD           func() int
}

func NewRootCommand(out io.Writer, errOut io.Writer) *cobra.Command {
	store := auth.NewKeychainStore()
	return newRootCommandWithDeps(out, errOut, cliDeps{
		tokenResolver: auth.Resolver{Store: store},
		tokenStore:    store,
		ynabClientFactory: func(token string) ynabClient {
			return ynab.NewClient("", token, (*http.Client)(nil))
		},
		stdin: os.Stdin,
		stdinFD: func() int {
			return int(os.Stdin.Fd())
		},
	})
}

func newRootCommandWithDeps(out io.Writer, errOut io.Writer, deps cliDeps) *cobra.Command {
	if deps.stdin == nil {
		deps.stdin = os.Stdin
	}
	if deps.promptToken == nil && deps.stdinFD != nil {
		deps.promptToken = terminalPrompt(errOut, deps.stdinFD)
	}
	app := &App{out: out, err: errOut, deps: deps}

	cmd := &cobra.Command{
		Use:           "ynab-expense",
		Short:         "Local YNAB expense helper",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	cmd.SetOut(out)
	cmd.SetErr(errOut)
	cmd.AddCommand(app.newAuthCommand())
	cmd.AddCommand(app.newBudgetsCommand())
	cmd.AddCommand(app.newAccountsCommand())
	cmd.AddCommand(app.newCategoriesCommand())
	cmd.AddCommand(app.newTransactionsCommand())
	cmd.AddCommand(app.newAddCommand())

	return cmd
}
