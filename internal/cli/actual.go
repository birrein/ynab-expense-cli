package cli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/spf13/cobra"
)

func (a *App) newActualCommand() *cobra.Command {
	return &cobra.Command{Use: "actual <operation> [arguments...]", Short: "Run Actual Budget operations using the official Node adapter", DisableFlagParsing: true, Args: cobra.MinimumNArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		run := a.deps.actualRunner
		if run == nil {
			run = runActualAdapter
		}
		return run(cmd.Context(), args, a.out, a.err)
	}}
}

func runActualAdapter(ctx context.Context, args []string, out, errout io.Writer) error {
	path := os.Getenv("ACTUAL_ADAPTER_PATH")
	if path == "" {
		_, file, _, ok := runtime.Caller(0)
		if !ok {
			return fmt.Errorf("cannot locate Actual adapter; set ACTUAL_ADAPTER_PATH")
		}
		path = filepath.Join(filepath.Dir(file), "..", "..", "scripts", "actual-runtime", "actual-daily.ts")
	}
	argv := append([]string{path}, args...)
	proc := exec.CommandContext(ctx, "node", argv...)
	proc.Stdout, proc.Stderr = out, errout
	return proc.Run()
}
