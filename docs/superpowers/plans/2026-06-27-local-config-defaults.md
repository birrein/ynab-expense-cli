# Local Config Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local config support so `ynab-expense` can use a default YNAB budget and account when flags are omitted.

**Architecture:** Add a focused `internal/config` package for JSON file load/save/update, then inject a small config-store interface into `internal/cli`. CLI commands resolve explicit flags first, then local config, then existing fallback behavior where applicable.

**Tech Stack:** Go standard library, Cobra, existing fake CLI dependencies, JSON config at `~/.config/ynab-expense/config.json`.

---

## File Structure

- Create `internal/config/config.go`: config struct, path resolution, JSON load/save, partial update behavior.
- Create `internal/config/config_test.go`: package tests using `t.TempDir()` and no real home directory writes.
- Modify `internal/cli/root.go`: add config store dependency and wire the default store in `NewRootCommand`.
- Create `internal/cli/config.go`: new `config`, `config show`, and `config set-defaults` commands.
- Modify `internal/cli/list.go`: resolve omitted `--budget` from config for `accounts`, `categories`, and `transactions`.
- Modify `internal/cli/add.go`: resolve omitted `--budget` and `--account-id` from config before validation.
- Modify `internal/cli/cli_test.go`: add fake config store and CLI behavior tests.
- Modify `README.md`: document local config, command examples, and flag precedence.

---

### Task 1: Local Config Package

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/config/config_test.go`

- [ ] **Step 1: Write failing tests for config package behavior**

Create `internal/config/config_test.go`:

```go
package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStoreLoadMissingFileReturnsEmptyConfig(t *testing.T) {
	store := Store{Path: filepath.Join(t.TempDir(), "ynab-expense", "config.json")}

	got, err := store.Load()

	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if got != (Config{}) {
		t.Fatalf("Load = %#v, want empty Config", got)
	}
}

func TestStoreSaveCreatesParentDirectoryAndWritesIndentedJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "ynab-expense", "config.json")
	store := Store{Path: path}
	cfg := Config{
		DefaultBudgetID:    "budget-123",
		DefaultBudgetName:  "Default budget",
		DefaultAccountID:   "account-123",
		DefaultAccountName: "BCH Credito CLP 7481",
	}

	if err := store.Save(cfg); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile returned error: %v", err)
	}
	text := string(body)
	for _, want := range []string{
		"{\n",
		`  "default_budget_id": "budget-123"`,
		`  "default_account_name": "BCH Credito CLP 7481"`,
		"\n}\n",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("saved config missing %q in:\n%s", want, text)
		}
	}
}

func TestStoreLoadMalformedJSONIncludesPath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"default_budget_id":`), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}
	store := Store{Path: path}

	_, err := store.Load()

	if err == nil {
		t.Fatal("Load returned nil error for malformed JSON")
	}
	if !strings.Contains(err.Error(), path) {
		t.Fatalf("Load error %q does not include path %q", err.Error(), path)
	}
}

func TestStoreUpdateMergesNonEmptyFields(t *testing.T) {
	store := Store{Path: filepath.Join(t.TempDir(), "config.json")}
	initial := Config{
		DefaultBudgetID:   "budget-123",
		DefaultBudgetName: "Default budget",
	}
	if err := store.Save(initial); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	got, err := store.Update(Config{
		DefaultAccountID:   "account-123",
		DefaultAccountName: "BCH Credito CLP 7481",
	})

	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	want := Config{
		DefaultBudgetID:    "budget-123",
		DefaultBudgetName:  "Default budget",
		DefaultAccountID:   "account-123",
		DefaultAccountName: "BCH Credito CLP 7481",
	}
	if got != want {
		t.Fatalf("Update = %#v, want %#v", got, want)
	}

	reloaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if reloaded != want {
		t.Fatalf("reloaded config = %#v, want %#v", reloaded, want)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
go test ./internal/config -count=1
```

Expected: FAIL because package `internal/config` does not exist yet.

- [ ] **Step 3: Implement the config package**

Create `internal/config/config.go`:

```go
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	DefaultBudgetID    string `json:"default_budget_id,omitempty"`
	DefaultBudgetName  string `json:"default_budget_name,omitempty"`
	DefaultAccountID   string `json:"default_account_id,omitempty"`
	DefaultAccountName string `json:"default_account_name,omitempty"`
}

type Store struct {
	Path string
}

func NewStore() (Store, error) {
	path, err := DefaultPath()
	if err != nil {
		return Store{}, err
	}
	return Store{Path: path}, nil
}

func DefaultPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config dir: %w", err)
	}
	return filepath.Join(configDir, "ynab-expense", "config.json"), nil
}

func (s Store) Load() (Config, error) {
	if s.Path == "" {
		return Config{}, fmt.Errorf("config path is required")
	}

	body, err := os.ReadFile(s.Path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Config{}, nil
		}
		return Config{}, fmt.Errorf("read config %s: %w", s.Path, err)
	}
	if len(body) == 0 {
		return Config{}, nil
	}

	var cfg Config
	if err := json.Unmarshal(body, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config %s: %w", s.Path, err)
	}
	return cfg, nil
}

func (s Store) Save(cfg Config) error {
	if s.Path == "" {
		return fmt.Errorf("config path is required")
	}
	if err := os.MkdirAll(filepath.Dir(s.Path), 0o700); err != nil {
		return fmt.Errorf("create config dir %s: %w", filepath.Dir(s.Path), err)
	}

	body, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	body = append(body, '\n')

	if err := os.WriteFile(s.Path, body, 0o600); err != nil {
		return fmt.Errorf("write config %s: %w", s.Path, err)
	}
	return nil
}

func (s Store) Update(update Config) (Config, error) {
	cfg, err := s.Load()
	if err != nil {
		return Config{}, err
	}

	if update.DefaultBudgetID != "" {
		cfg.DefaultBudgetID = update.DefaultBudgetID
	}
	if update.DefaultBudgetName != "" {
		cfg.DefaultBudgetName = update.DefaultBudgetName
	}
	if update.DefaultAccountID != "" {
		cfg.DefaultAccountID = update.DefaultAccountID
	}
	if update.DefaultAccountName != "" {
		cfg.DefaultAccountName = update.DefaultAccountName
	}

	if err := s.Save(cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}
```

- [ ] **Step 4: Run config package tests**

Run:

```bash
go test ./internal/config -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit config package**

Run:

```bash
git add internal/config/config.go internal/config/config_test.go
git commit -m "feat(config): add local config store"
```

---

### Task 2: Config Command Group

**Files:**
- Modify: `internal/cli/root.go`
- Create: `internal/cli/config.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing CLI tests for `config show` and `config set-defaults`**

In `internal/cli/cli_test.go`, add import:

```go
localconfig "github.com/birrein/ynab-expense-cli/internal/config"
```

Then add these tests before `func executeCommand`:

```go
func TestConfigShowPrintsEmptyObjectWhenNoConfig(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(cmd, "config", "show")

	if err != nil {
		t.Fatalf("config show returned error: %v", err)
	}
	if strings.TrimSpace(out.String()) != "{}" {
		t.Fatalf("config show output = %q, want {}", out.String())
	}
}

func TestConfigSetDefaultsWritesBudgetAndAccount(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(
		cmd,
		"config", "set-defaults",
		"--budget-id", " budget-123 ",
		"--budget-name", " Default budget ",
		"--account-id", " account-123 ",
		"--account-name", " BCH Credito CLP 7481 ",
	)

	if err != nil {
		t.Fatalf("config set-defaults returned error: %v", err)
	}
	want := localconfig.Config{
		DefaultBudgetID:    "budget-123",
		DefaultBudgetName:  "Default budget",
		DefaultAccountID:   "account-123",
		DefaultAccountName: "BCH Credito CLP 7481",
	}
	if store.cfg != want {
		t.Fatalf("stored config = %#v, want %#v", store.cfg, want)
	}
	if !strings.Contains(strings.ToLower(out.String()), "saved") {
		t.Fatalf("config set-defaults output should say saved, got %q", out.String())
	}
}

func TestConfigSetDefaultsCanSetOnlyAccount(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{
		cfg: localconfig.Config{
			DefaultBudgetID:   "budget-123",
			DefaultBudgetName: "Default budget",
		},
	}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(
		cmd,
		"config", "set-defaults",
		"--account-id", "account-123",
		"--account-name", "BCH Credito CLP 7481",
	)

	if err != nil {
		t.Fatalf("config set-defaults returned error: %v", err)
	}
	want := localconfig.Config{
		DefaultBudgetID:    "budget-123",
		DefaultBudgetName:  "Default budget",
		DefaultAccountID:   "account-123",
		DefaultAccountName: "BCH Credito CLP 7481",
	}
	if store.cfg != want {
		t.Fatalf("stored config = %#v, want %#v", store.cfg, want)
	}
}

func TestConfigSetDefaultsRejectsNoIDs(t *testing.T) {
	var out bytes.Buffer
	store := &fakeConfigStore{}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{configStore: store})

	err := executeCommand(cmd, "config", "set-defaults", "--budget-name", "Default budget")

	if err == nil {
		t.Fatal("config set-defaults accepted no IDs")
	}
	if !strings.Contains(err.Error(), "at least one default value is required") {
		t.Fatalf("expected no-defaults error, got %q", err.Error())
	}
}
```

Add this fake near the other fakes:

```go
type fakeConfigStore struct {
	cfg localconfig.Config
	err error
}

func (s *fakeConfigStore) Load() (localconfig.Config, error) {
	if s.err != nil {
		return localconfig.Config{}, s.err
	}
	return s.cfg, nil
}

func (s *fakeConfigStore) Save(cfg localconfig.Config) error {
	if s.err != nil {
		return s.err
	}
	s.cfg = cfg
	return nil
}

func (s *fakeConfigStore) Update(update localconfig.Config) (localconfig.Config, error) {
	if s.err != nil {
		return localconfig.Config{}, s.err
	}
	if update.DefaultBudgetID != "" {
		s.cfg.DefaultBudgetID = update.DefaultBudgetID
	}
	if update.DefaultBudgetName != "" {
		s.cfg.DefaultBudgetName = update.DefaultBudgetName
	}
	if update.DefaultAccountID != "" {
		s.cfg.DefaultAccountID = update.DefaultAccountID
	}
	if update.DefaultAccountName != "" {
		s.cfg.DefaultAccountName = update.DefaultAccountName
	}
	return s.cfg, nil
}
```

- [ ] **Step 2: Run CLI config tests to verify they fail**

Run:

```bash
go test ./internal/cli -run 'TestConfig' -count=1
```

Expected: FAIL because `cliDeps.configStore`, `internal/cli/config.go`, and the `config` command do not exist yet.

- [ ] **Step 3: Wire config store dependency in root command**

Modify `internal/cli/root.go`.

Add import:

```go
localconfig "github.com/birrein/ynab-expense-cli/internal/config"
```

Add interface and dependency field:

```go
type configStore interface {
	Load() (localconfig.Config, error)
	Save(localconfig.Config) error
	Update(localconfig.Config) (localconfig.Config, error)
}
```

Then update `cliDeps`:

```go
type cliDeps struct {
	tokenResolver     tokenResolver
	tokenStore        tokenStore
	configStore       configStore
	ynabClientFactory func(token string) ynabClient
	promptToken       func() (string, error)
	stdin             io.Reader
	stdinFD           func() int
}
```

Update `NewRootCommand`:

```go
func NewRootCommand(out io.Writer, errOut io.Writer) *cobra.Command {
	store := auth.NewKeychainStore()
	configStore, err := localconfig.NewStore()
	if err != nil {
		configStore = localconfig.Store{}
	}
	return newRootCommandWithDeps(out, errOut, cliDeps{
		tokenResolver: auth.Resolver{Store: store},
		tokenStore:    store,
		configStore:   configStore,
		ynabClientFactory: func(token string) ynabClient {
			return ynab.NewClient("", token, (*http.Client)(nil))
		},
		stdin: os.Stdin,
		stdinFD: func() int {
			return int(os.Stdin.Fd())
		},
	})
}
```

Register the command:

```go
cmd.AddCommand(app.newConfigCommand())
```

- [ ] **Step 4: Implement config command group**

Create `internal/cli/config.go`:

```go
package cli

import (
	"encoding/json"
	"fmt"
	"strings"

	localconfig "github.com/birrein/ynab-expense-cli/internal/config"
	"github.com/spf13/cobra"
)

func (a *App) newConfigCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage local ynab-expense configuration",
		Args:  cobra.NoArgs,
	}
	cmd.AddCommand(a.newConfigShowCommand())
	cmd.AddCommand(a.newConfigSetDefaultsCommand())
	return cmd
}

func (a *App) newConfigShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show local ynab-expense configuration",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := a.loadConfig()
			if err != nil {
				return err
			}
			if cfg == (localconfig.Config{}) {
				_, err := fmt.Fprintln(a.out, "{}")
				return err
			}
			body, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return err
			}
			return a.writeJSON(body)
		},
	}
}

func (a *App) newConfigSetDefaultsCommand() *cobra.Command {
	var budgetID string
	var budgetName string
	var accountID string
	var accountName string

	cmd := &cobra.Command{
		Use:   "set-defaults",
		Short: "Set default YNAB budget and account IDs",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			update := localconfig.Config{
				DefaultBudgetID:    strings.TrimSpace(budgetID),
				DefaultBudgetName:  strings.TrimSpace(budgetName),
				DefaultAccountID:   strings.TrimSpace(accountID),
				DefaultAccountName: strings.TrimSpace(accountName),
			}
			if update.DefaultBudgetID == "" && update.DefaultAccountID == "" {
				return fmt.Errorf("at least one default value is required")
			}
			if a.deps.configStore == nil {
				return fmt.Errorf("config store is not configured")
			}
			if _, err := a.deps.configStore.Update(update); err != nil {
				return err
			}
			fmt.Fprintln(a.out, "Config saved.")
			return nil
		},
	}

	cmd.Flags().StringVar(&budgetID, "budget-id", "", "Default YNAB budget ID")
	cmd.Flags().StringVar(&budgetName, "budget-name", "", "Human-readable budget name")
	cmd.Flags().StringVar(&accountID, "account-id", "", "Default YNAB account ID")
	cmd.Flags().StringVar(&accountName, "account-name", "", "Human-readable account name")
	return cmd
}

func (a *App) loadConfig() (localconfig.Config, error) {
	if a.deps.configStore == nil {
		return localconfig.Config{}, nil
	}
	return a.deps.configStore.Load()
}
```

- [ ] **Step 5: Run CLI config tests**

Run:

```bash
go test ./internal/cli -run 'TestConfig' -count=1
```

Expected: PASS.

- [ ] **Step 6: Run all tests**

Run:

```bash
go test ./... -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit config command group**

Run:

```bash
git add internal/cli/root.go internal/cli/config.go internal/cli/cli_test.go
git commit -m "feat(config): add local defaults commands"
```

---

### Task 3: Use Config Defaults in Existing Commands

**Files:**
- Modify: `internal/cli/list.go`
- Modify: `internal/cli/add.go`
- Modify: `internal/cli/cli_test.go`

- [ ] **Step 1: Add failing tests for list command budget defaults**

Add these tests in `internal/cli/cli_test.go`:

```go
func TestAccountsUsesConfiguredDefaultBudgetWhenFlagOmitted(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{accountsResponse: []byte(`{"data":{"accounts":[]}}`)}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{DefaultBudgetID: "budget-123"}),
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})

	err := executeCommand(cmd, "accounts")

	if err != nil {
		t.Fatalf("accounts returned error: %v", err)
	}
	if client.accountsBudget != "budget-123" {
		t.Fatalf("accounts budget = %q, want budget-123", client.accountsBudget)
	}
}

func TestAccountsExplicitBudgetOverridesConfiguredDefault(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{accountsResponse: []byte(`{"data":{"accounts":[]}}`)}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{DefaultBudgetID: "budget-123"}),
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})

	err := executeCommand(cmd, "accounts", "--budget", "explicit-budget")

	if err != nil {
		t.Fatalf("accounts returned error: %v", err)
	}
	if client.accountsBudget != "explicit-budget" {
		t.Fatalf("accounts budget = %q, want explicit-budget", client.accountsBudget)
	}
}

func TestTransactionsUsesConfiguredDefaultBudgetWhenFlagOmitted(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{transactionsResponse: []byte(`{"data":{"transactions":[]}}`)}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{DefaultBudgetID: "budget-123"}),
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})

	err := executeCommand(cmd, "transactions", "--since", "2026-06-01")

	if err != nil {
		t.Fatalf("transactions returned error: %v", err)
	}
	if client.transactionsBudget != "budget-123" {
		t.Fatalf("transactions budget = %q, want budget-123", client.transactionsBudget)
	}
}

func TestCategoriesUsesConfiguredDefaultBudgetWhenFlagOmitted(t *testing.T) {
	var out bytes.Buffer
	client := &fakeYNABClient{categoriesResponse: []byte(`{"data":{"categories":[]}}`)}
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{DefaultBudgetID: "budget-123"}),
		tokenResolver: fakeTokenResolver{token: "secret-token", source: auth.SourceEnv},
		ynabClientFactory: func(token string) ynabClient {
			return client
		},
	})

	err := executeCommand(cmd, "categories")

	if err != nil {
		t.Fatalf("categories returned error: %v", err)
	}
	if client.categoriesBudget != "budget-123" {
		t.Fatalf("categories budget = %q, want budget-123", client.categoriesBudget)
	}
}
```

Add helper near `fakeConfigStore`:

```go
func fakeConfigStoreValue(cfg localconfig.Config) *fakeConfigStore {
	return &fakeConfigStore{cfg: cfg}
}
```

- [ ] **Step 2: Add failing tests for `add` defaults**

Add these tests in `internal/cli/cli_test.go`:

```go
func TestAddDryRunUsesConfiguredBudgetAndAccount(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-123",
			DefaultAccountID: "account-123",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(
		cmd,
		"add",
		"--amount", "6300",
		"--payee", "Feria",
		"--date", "2026-06-20",
		"--category-id", "category-123",
		"--dry-run",
	)

	if err != nil {
		t.Fatalf("add dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{`"budget": "budget-123"`, `"account_id": "account-123"`, `"amount": -6300000`} {
		if !strings.Contains(output, want) {
			t.Fatalf("add dry-run output missing %s, got %q", want, output)
		}
	}
}

func TestAddExplicitBudgetAndAccountOverrideConfiguredDefaults(t *testing.T) {
	var out bytes.Buffer
	cmd := newRootCommandWithDeps(&out, &out, cliDeps{
		configStore: fakeConfigStoreValue(localconfig.Config{
			DefaultBudgetID:  "budget-123",
			DefaultAccountID: "account-123",
		}),
		tokenResolver: failingTokenResolver{t: t},
	})

	err := executeCommand(
		cmd,
		"add",
		"--budget", "explicit-budget",
		"--account-id", "explicit-account",
		"--amount", "6300",
		"--payee", "Feria",
		"--date", "2026-06-20",
		"--dry-run",
	)

	if err != nil {
		t.Fatalf("add dry-run returned error: %v", err)
	}
	output := out.String()
	for _, want := range []string{`"budget": "explicit-budget"`, `"account_id": "explicit-account"`} {
		if !strings.Contains(output, want) {
			t.Fatalf("add dry-run output missing %s, got %q", want, output)
		}
	}
}
```

- [ ] **Step 3: Run default-resolution tests to verify they fail**

Run:

```bash
go test ./internal/cli -run 'TestAccountsUsesConfiguredDefaultBudgetWhenFlagOmitted|TestAccountsExplicitBudgetOverridesConfiguredDefault|TestTransactionsUsesConfiguredDefaultBudgetWhenFlagOmitted|TestCategoriesUsesConfiguredDefaultBudgetWhenFlagOmitted|TestAddDryRunUsesConfiguredBudgetAndAccount|TestAddExplicitBudgetAndAccountOverrideConfiguredDefaults' -count=1
```

Expected: FAIL because existing commands do not resolve config defaults yet.

- [ ] **Step 4: Implement budget resolver in list commands**

Modify `internal/cli/list.go`.

Add import:

```go
	"strings"
```

In `newAccountsCommand`, replace direct use of `budget` with:

```go
resolvedBudget, err := a.resolveBudget(cmd, budget)
if err != nil {
	return err
}
body, err := client.GetAccounts(cmd.Context(), resolvedBudget)
```

In `newCategoriesCommand`, replace direct use of `budget` with:

```go
resolvedBudget, err := a.resolveBudget(cmd, budget)
if err != nil {
	return err
}
body, err := client.GetCategories(cmd.Context(), resolvedBudget)
```

In `newTransactionsCommand`, replace direct use of `budget` with:

```go
resolvedBudget, err := a.resolveBudget(cmd, budget)
if err != nil {
	return err
}
body, err := client.GetTransactions(cmd.Context(), resolvedBudget, since, until)
```

Add helper at the end of `internal/cli/list.go` before `clientForCommand`:

```go
func (a *App) resolveBudget(cmd *cobra.Command, budget string) (string, error) {
	if cmd.Flags().Changed("budget") {
		budget = strings.TrimSpace(budget)
		if budget == "" {
			return "", fmt.Errorf("--budget is required")
		}
		return budget, nil
	}

	cfg, err := a.loadConfig()
	if err != nil {
		return "", err
	}
	if cfg.DefaultBudgetID != "" {
		return strings.TrimSpace(cfg.DefaultBudgetID), nil
	}

	budget = strings.TrimSpace(budget)
	if budget == "" {
		return "", fmt.Errorf("--budget is required")
	}
	return budget, nil
}
```

- [ ] **Step 5: Implement add command default resolution**

Modify `internal/cli/add.go`.

In `RunE`, before `validateAddInput`, build raw input then resolve defaults:

```go
rawInput := addInput{
	Budget:     budget,
	AccountID:  accountID,
	Amount:     amount,
	Currency:   currency,
	Payee:      payee,
	Date:       date,
	CategoryID: categoryID,
	Memo:       memo,
}

resolvedInput, err := a.resolveAddInputDefaults(cmd, rawInput)
if err != nil {
	return err
}

input, err := validateAddInput(resolvedInput)
if err != nil {
	return err
}
```

Add helper before `validateAddInput`:

```go
func (a *App) resolveAddInputDefaults(cmd *cobra.Command, input addInput) (addInput, error) {
	resolvedBudget, err := a.resolveBudget(cmd, input.Budget)
	if err != nil {
		return addInput{}, err
	}
	input.Budget = resolvedBudget

	if !cmd.Flags().Changed("account-id") {
		cfg, err := a.loadConfig()
		if err != nil {
			return addInput{}, err
		}
		if strings.TrimSpace(cfg.DefaultAccountID) != "" {
			input.AccountID = cfg.DefaultAccountID
		}
	}

	return input, nil
}
```

In `newAddCommand`, remove `account-id` from the required-flag loop so config can supply it:

```go
for _, name := range []string{"amount", "payee", "date"} {
	if err := cmd.MarkFlagRequired(name); err != nil {
		panic(err)
	}
}
```

- [ ] **Step 6: Run default-resolution tests**

Run:

```bash
go test ./internal/cli -run 'TestAccountsUsesConfiguredDefaultBudgetWhenFlagOmitted|TestAccountsExplicitBudgetOverridesConfiguredDefault|TestTransactionsUsesConfiguredDefaultBudgetWhenFlagOmitted|TestCategoriesUsesConfiguredDefaultBudgetWhenFlagOmitted|TestAddDryRunUsesConfiguredBudgetAndAccount|TestAddExplicitBudgetAndAccountOverrideConfiguredDefaults' -count=1
```

Expected: PASS.

- [ ] **Step 7: Run full CLI package tests**

Run:

```bash
go test ./internal/cli -count=1
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

Run:

```bash
go test ./... -count=1
```

Expected: PASS.

- [ ] **Step 9: Commit default resolution**

Run:

```bash
git add internal/cli/list.go internal/cli/add.go internal/cli/cli_test.go
git commit -m "feat(config): use local defaults in commands"
```

---

### Task 4: README and Smoke Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with local config usage**

Add this section after `Authentication` and before `Listing Data`:

````markdown
## Local Defaults

You can store local default IDs outside the repository:

```sh
ynab-expense config set-defaults \
  --budget-id e8038248-d795-488d-93a1-2aadc4edb98d \
  --budget-name "Default budget" \
  --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf \
  --account-name "BCH Crédito CLP 7481"
```

The config file lives at:

```text
~/.config/ynab-expense/config.json
```

Show the current config:

```sh
ynab-expense config show
```

Explicit command flags always override local defaults.
````

Update listing examples:

````markdown
List accounts in the configured default budget:

```sh
ynab-expense accounts
```

List categories in the configured default budget:

```sh
ynab-expense categories
```

List transactions since a date:

```sh
ynab-expense transactions --since 2026-06-01
```
````

Update add examples to mention defaults:

````markdown
When local defaults are configured, `add` can omit `--budget` and `--account-id`:

```sh
ynab-expense add \
  --amount 12.990 \
  --currency CLP \
  --payee "Comercio" \
  --date 2026-06-05 \
  --dry-run
```
````

- [ ] **Step 2: Run documentation-adjacent smoke checks without touching real config**

Use a temporary config directory:

```bash
tmp_config_dir="$(mktemp -d)"
XDG_CONFIG_HOME="$tmp_config_dir" go build -o ynab-expense ./cmd/ynab-expense
XDG_CONFIG_HOME="$tmp_config_dir" ./ynab-expense config show
XDG_CONFIG_HOME="$tmp_config_dir" ./ynab-expense config set-defaults --budget-id e8038248-d795-488d-93a1-2aadc4edb98d --budget-name "Default budget"
XDG_CONFIG_HOME="$tmp_config_dir" ./ynab-expense config set-defaults --account-id 93e8e6dc-b70a-46ad-8c0a-63de83f50acf --account-name "BCH Crédito CLP 7481"
XDG_CONFIG_HOME="$tmp_config_dir" ./ynab-expense add --amount 6300 --payee "Feria" --date 2026-06-20 --category-id aaaf94f8-8817-4306-afcd-0f4a1248b322 --dry-run
rm -rf "$tmp_config_dir"
```

Expected:

- `config show` initially prints `{}`.
- Both `config set-defaults` commands print `Config saved.`
- `add --dry-run` prints `"budget": "e8038248-d795-488d-93a1-2aadc4edb98d"`.
- `add --dry-run` prints `"account_id": "93e8e6dc-b70a-46ad-8c0a-63de83f50acf"`.
- No live YNAB write occurs because `--commit` is omitted.

- [ ] **Step 3: Run full verification**

Run:

```bash
go test ./... -count=1
go build -o ynab-expense ./cmd/ynab-expense
```

Expected: both commands pass.

- [ ] **Step 4: Commit docs and final verification updates**

Run:

```bash
git add README.md
git commit -m "docs(config): document local defaults"
```

---

## Final Review Checklist

- [ ] `go test ./... -count=1` passes.
- [ ] `go build -o ynab-expense ./cmd/ynab-expense` passes.
- [ ] Temporary-config smoke test proves `config show`, `config set-defaults`, and `add --dry-run` work.
- [ ] `add --dry-run` still does not resolve tokens or call live YNAB.
- [ ] Explicit `--budget` and `--account-id` still override local config.
- [ ] README documents the config path and precedence.
- [ ] No real token or personal config file is committed.
