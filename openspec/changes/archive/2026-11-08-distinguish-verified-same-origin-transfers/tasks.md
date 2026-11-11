## 1. Verificación y política

- [x] 1.1 Añadir pruebas negativas y positiva para el par previo verificado, observar fallo inicial y verificar que las pruebas pasan tras el cambio.
- [x] 1.2 Validar snapshots, ledger, fuentes, fechas, destino y totalidad de conflictos sin afectar la modalidad histórica; probar persistencia y reintento idempotente.

## 2. Operación y cierre

- [x] 2.1 Documentar el nuevo modo en el runbook y ejecutar suite Node y Go.
- [x] 2.2 Validar la spec con `openspec validate --strict` y verificar que la vista previa del candidato real propone una transferencia sin alterar la previa.
