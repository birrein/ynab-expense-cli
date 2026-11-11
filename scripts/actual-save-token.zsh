#!/bin/zsh
set -eu
set +x
source /Users/birrein/.nvm/nvm.sh
nvm use 22.20.0 >/dev/null
trap 'unset actual_bootstrap_password' EXIT
read -rs 'actual_bootstrap_password?Contraseña de Actual: '
printf '\n'
printf '%s' "$actual_bootstrap_password" | node --input-type=module -e '
import { execFileSync } from "node:child_process";
try {
  let password = "";
  for await (const chunk of process.stdin) password += chunk;
  const response = await fetch("http://127.0.0.1:5006/account/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await response.json();
  if (!response.ok || body.status !== "ok" || !body.data?.token) {
    throw new Error("login");
  }
  execFileSync("/usr/bin/security", [
    "add-generic-password", "-a", "actual-server",
    "-s", "actual-budget-session-token", "-w", body.data.token, "-U",
  ], { stdio: "ignore" });
  console.log("Token guardado en el Llavero de macOS.");
} catch {
  console.error("No se pudo obtener o guardar el token. Comprueba el servidor, la contraseña y el acceso al Llavero.");
  process.exitCode = 1;
}
'
