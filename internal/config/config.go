package config

import (
	"encoding/json"
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
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "ynab-expense", "config.json"), nil
}

func (s Store) Load() (Config, error) {
	data, err := os.ReadFile(s.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, nil
		}
		return Config{}, fmt.Errorf("read config %s: %w", s.Path, err)
	}
	if len(data) == 0 {
		return Config{}, nil
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config %s: %w", s.Path, err)
	}
	return cfg, nil
}

func (s Store) Save(cfg Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config %s: %w", s.Path, err)
	}
	data = append(data, '\n')

	dir := filepath.Dir(s.Path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create config directory %s: %w", dir, err)
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return fmt.Errorf("set config directory permissions %s: %w", dir, err)
	}
	if err := os.WriteFile(s.Path, data, 0o600); err != nil {
		return fmt.Errorf("write config %s: %w", s.Path, err)
	}
	if err := os.Chmod(s.Path, 0o600); err != nil {
		return fmt.Errorf("set config permissions %s: %w", s.Path, err)
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
