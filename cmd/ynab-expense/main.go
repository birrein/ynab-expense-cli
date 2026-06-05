package main

import (
	"fmt"
	"os"

	"github.com/birrein/ynab-expense-cli/internal/cli"
)

func main() {
	root := cli.NewRootCommand(os.Stdout, os.Stderr)
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
