package cli

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestActualForwardsArgumentsAndStreams(t *testing.T) {
	var out, stderr bytes.Buffer
	var got []string
	cmd := newRootCommandWithDeps(&out, &stderr, cliDeps{actualRunner: func(_ context.Context, args []string, stdout, errout io.Writer) error {
		got = append([]string(nil), args...)
		_, _ = stdout.Write([]byte("preview"))
		_, _ = errout.Write([]byte("diagnostic"))
		return nil
	}})
	if err := executeCommand(cmd, "actual", "plan", "--file", "/tmp/name with spaces.json"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []string{"plan", "--file", "/tmp/name with spaces.json"}) {
		t.Fatalf("unexpected args %q", got)
	}
	if out.String() != "preview" || stderr.String() != "diagnostic" {
		t.Fatalf("unexpected streams %q %q", out.String(), stderr.String())
	}
}

func TestActualReturnsRunnerError(t *testing.T) {
	var out bytes.Buffer
	expected := errors.New("adapter failed")
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{actualRunner: func(context.Context, []string, io.Writer, io.Writer) error { return expected }})
	if err := executeCommand(cmd, "actual", "status"); !errors.Is(err, expected) {
		t.Fatalf("got %v", err)
	}
}

func TestActualAdapterDefaultsToNativeTypeScriptEntry(t *testing.T) {
	bin := t.TempDir()
	argsFile := filepath.Join(t.TempDir(), "args")
	stub := "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$ACTUAL_TEST_ARGS\"\n"
	if err := os.WriteFile(filepath.Join(bin, "node"), []byte(stub), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin)
	t.Setenv("ACTUAL_ADAPTER_PATH", "")
	t.Setenv("ACTUAL_TEST_ARGS", argsFile)

	if err := runActualAdapter(context.Background(), []string{"status"}, &bytes.Buffer{}, &bytes.Buffer{}); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(argsFile)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(strings.TrimSpace(string(got)), "\n")
	_, source, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot locate actual_test.go")
	}
	want := filepath.Join(filepath.Dir(source), "..", "..", "scripts", "actual-runtime", "actual-daily.ts")
	if len(parts) != 2 || parts[0] != want || parts[1] != "status" {
		t.Fatalf("node args = %q, want [%q status]", parts, want)
	}
}
