package config

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultPathUsesXDGConfigHome(t *testing.T) {
	configDir := filepath.Join(t.TempDir(), "xdg-config")
	t.Setenv("XDG_CONFIG_HOME", configDir)

	got, err := DefaultPath()
	if err != nil {
		t.Fatalf("DefaultPath returned error: %v", err)
	}

	want := filepath.Join(configDir, "ynab-expense", "config.json")
	if got != want {
		t.Fatalf("DefaultPath = %q, want %q", got, want)
	}
}

func TestDefaultPathDefaultsToDotConfigUnderHome(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("HOME-based fallback is only used on Unix-like platforms")
	}
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", "")
	t.Setenv("HOME", home)

	got, err := DefaultPath()
	if err != nil {
		t.Fatalf("DefaultPath returned error: %v", err)
	}

	want := filepath.Join(home, ".config", "ynab-expense", "config.json")
	if got != want {
		t.Fatalf("DefaultPath = %q, want %q", got, want)
	}
}

func TestStoreLoadMissingFileReturnsEmptyConfig(t *testing.T) {
	store := Store{Path: filepath.Join(t.TempDir(), "ynab-expense", "config.json")}

	got, err := store.Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if got != (Config{}) {
		t.Fatalf("Load config = %#v, want empty config", got)
	}
}

func TestStoreSaveCreatesParentDirectoryAndWritesIndentedJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "ynab-expense", "config.json")
	store := Store{Path: path}
	cfg := Config{
		DefaultBudgetID:    "budget-1",
		DefaultBudgetName:  "Household",
		DefaultAccountID:   "account-1",
		DefaultAccountName: "Checking",
	}

	if err := store.Save(cfg); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	parentInfo, err := os.Stat(filepath.Dir(path))
	if err != nil {
		t.Fatalf("Stat parent dir returned error: %v", err)
	}
	if got := parentInfo.Mode().Perm(); got != 0o700 {
		t.Fatalf("parent dir mode = %o, want 700", got)
	}

	fileInfo, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat config file returned error: %v", err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Fatalf("config file mode = %o, want 600", got)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile returned error: %v", err)
	}
	want := "{\n" +
		"  \"default_budget_id\": \"budget-1\",\n" +
		"  \"default_budget_name\": \"Household\",\n" +
		"  \"default_account_id\": \"account-1\",\n" +
		"  \"default_account_name\": \"Checking\"\n" +
		"}\n"
	if string(got) != want {
		t.Fatalf("config file = %q, want %q", string(got), want)
	}
}

func TestStoreSaveRestrictsExistingParentDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "ynab-expense")
	if err := os.MkdirAll(dir, 0o777); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}
	if err := os.Chmod(dir, 0o777); err != nil {
		t.Fatalf("Chmod returned error: %v", err)
	}
	store := Store{Path: filepath.Join(dir, "config.json")}

	if err := store.Save(Config{DefaultBudgetID: "budget-1"}); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	parentInfo, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("Stat parent dir returned error: %v", err)
	}
	if got := parentInfo.Mode().Perm(); got != 0o700 {
		t.Fatalf("parent dir mode = %o, want 700", got)
	}
}

func TestStoreLoadMalformedJSONIncludesPath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ynab-expense", "config.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	store := Store{Path: path}

	_, err := store.Load()
	if err == nil {
		t.Fatal("Load returned nil error for malformed JSON")
	}
	if !strings.Contains(err.Error(), path) {
		t.Fatalf("Load error = %q, want it to include path %q", err.Error(), path)
	}
}

func TestStoreUpdateMergesNonEmptyFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ynab-expense", "config.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}
	existing := "{\n" +
		"  \"default_budget_id\": \"budget-1\",\n" +
		"  \"default_budget_name\": \"Household\",\n" +
		"  \"default_account_id\": \"account-1\",\n" +
		"  \"default_account_name\": \"Checking\"\n" +
		"}\n"
	if err := os.WriteFile(path, []byte(existing), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	store := Store{Path: path}

	got, err := store.Update(Config{
		DefaultBudgetName: "Travel",
		DefaultAccountID:  "account-2",
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	want := Config{
		DefaultBudgetID:    "budget-1",
		DefaultBudgetName:  "Travel",
		DefaultAccountID:   "account-2",
		DefaultAccountName: "Checking",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Update config = %#v, want %#v", got, want)
	}

	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load after Update returned error: %v", err)
	}
	if !reflect.DeepEqual(loaded, want) {
		t.Fatalf("saved config = %#v, want %#v", loaded, want)
	}
}
