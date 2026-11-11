package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"

	"github.com/birrein/ynab-expense-cli/internal/cli"
)

func main() {
	root := cli.NewRootCommand(os.Stdout, os.Stderr)
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() > 0 {
			os.Exit(exitErr.ExitCode())
		}
		os.Exit(1)
	}
}
