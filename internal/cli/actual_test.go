package cli

import (
	"bytes"
	"context"
	"errors"
	"io"
	"reflect"
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
