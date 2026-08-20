# Checklist de fork — de `epa-standards-backend` a `apps/api/`

Procedimiento operativo para forkear la plantilla de Eddy dentro del
monorepo de un dashboard nuevo. Antes de correr esto, `/migrate-to-epa` (o
el arranque de un dashboard nuevo) ya debería haber confirmado con el
usuario el inventario de datos que va a exponer este backend — no forkear
especulativamente.

```
[ ] 1. Copiar el contenido de epa-standards-backend a apps/api/ dentro del
       repo del dashboard (no como submódulo, no como repo aparte — ver
       Decisión 3 del plan de integración: monorepo, un solo CI).

[ ] 2. Renombrar el módulo Go: en go.mod y en TODOS los imports internos,
       cambiar `github.com/epa-datos/epa-standards-backend` por el path
       real (p. ej. `github.com/epa-digital/{cliente}-dashboard/apps/api`).

[ ] 3. Borrar lo que no se usa:
       - internal/infrastructure/repositories/postgres/
       - internal/infrastructure/repositories/firestore/
       - El recurso Example completo: internal/pkg/entity/example.go,
         internal/pkg/ports/example.go (o su contenido, si el archivo se
         reusa para el primer recurso real),
         internal/pkg/service/example/, internal/infrastructure/api/example/,
         mocks/ExampleRepository.go, mocks/ExampleService.go.
       - internal/infrastructure/api/middlewares/auth.go y el campo
         APIAuthToken de config.go — con sidecar no hay caller externo del
         que defenderse en el salto web→api (ver sidecar.md); dejarlo vivo
         es peor que borrarlo, porque alguien puede creer que protege algo.

[ ] 4. Agregar el recurso real de BigQuery siguiendo
       bigquery-repository.md — un slice (entity/ports/service/repository/
       handlers/routes) por recurso del inventario confirmado con el
       usuario.

[ ] 5. Actualizar .mockery.yaml para generar mocks de las interfaces
       nuevas en ports/ (quitar las de Example, agregar las nuevas).

[ ] 6. Descartar los 3 workflows de referencia de Eddy
       (.github/workflows/cloudrun_deploy.yml, golangci-lint.yml,
       run_tests.yml) — el monorepo tiene UN workflow que construye los dos
       contenedores y hace un solo deploy (ver
       epa-deploy/SKILL.md). El más importante a no copiar tal cual:
       `cloudrun_deploy.yml` de referencia despliega con
       `--allow-unauthenticated` — es exactamente el bug que anula el
       aislamiento de red del sidecar si se copia sin corregir.

[ ] 7. Confirmar la rama base real: la plantilla de Eddy usa `staging` para
       sus repos standalone (espejo de admin-tool-api) — el monorepo del
       dashboard usa `main`, igual que el frontend hoy. No homologar a
       `staging` solo porque la plantilla lo trae así.

[ ] 8. Para todo lo que NO sea BigQuery, sidecar o deploy — estructura de
       carpetas, testing (mockery + testify), logging con logrus, CORS,
       manejo de errores en el gin.Recovery() — los 5 docs originales de
       Eddy siguen siendo la fuente. Este skill no los duplica:
       CLAUDE.md, docs/ESTRUCTURA.md, docs/TESTING.md, docs/MOCKS.md,
       docs/VARIABLES-ENTORNO.md.

[ ] 9. `go build ./... && go test ./... && golangci-lint run` localmente
       antes del primer PR — y verificar los 3 puntos marcados en
       bigquery-repository.md ("verificar en el primer go build real").
```
