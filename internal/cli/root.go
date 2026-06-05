package cli

import (
	"io"

	"github.com/spf13/cobra"
)

type App struct {
	out io.Writer
	err io.Writer
}

func NewRootCommand(out io.Writer, errOut io.Writer) *cobra.Command {
	app := &App{out: out, err: errOut}

	cmd := &cobra.Command{
		Use:           "ynab-expense",
		Short:         "Local YNAB expense helper",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	cmd.SetOut(out)
	cmd.SetErr(errOut)
	_ = app

	return cmd
}
