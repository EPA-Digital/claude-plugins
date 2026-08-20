# Repositorio de BigQuery en Go — slice de referencia

La plantilla de Eddy (`epa-standards-backend`) trae ejemplos de Postgres y
Firestore, pero ninguno de BigQuery — eso lo define este documento. Es el
código a copiar y adaptar al forkear (ver `fork-checklist.md`), no código
compilado en este repo.

**Convención elegida:** sigue la forma de `firestore/` (cliente separado
del repositorio), no la de `postgres/` (que junta ambos en `client.go`) —
un cliente de solo-lectura basado en ADC se parece más a Firestore que a un
pool de conexión SQL.

**Verificar en el primer `go build` real** (marcado también inline donde
aplica):
1. La forma exacta de `job.LastStatus().Statistics` al usar `DryRun`.
2. Si el dataset de BigQuery necesita `client.Location` fijado a mano (p.
   ej. `"US"`) o si el default basta.
3. Que `bigquery.QueryParameter` acepta un `int64` para `LIMIT` tal cual
   (algunas versiones de la librería prefieren `int`).
4. Si un repositorio nuevo lee `{cliente}_etl` (`pitagoras-etl`, ver
   `epa-bq/references/etl-tables.md`) en vez de `{cliente}_reporting`, el
   destino de scan para columnas de dinero **no es `float64`** — esas
   tablas usan `NUMERIC(35,6)`, y el driver de Go necesita un tipo que
   preserve esa escala exacta (`bigquery.NullFloat64` pierde precisión;
   verificar si el driver expone `*big.Rat` o equivalente). Y toda query
   contra `_etl` necesita filtro de fecha en el `WHERE` — esas tablas se
   crean con `require_partition_filter = TRUE`, así que sin filtro la
   query **falla**, no escanea de más.

Ejemplo con el recurso `CampaignMetrics`, sobre las vistas del transfer de
Google Ads (`ads_CampaignBasicStats_{mcc}` + `ads_Campaign_{mcc}` — ver
`epa-bq`). **Read-only**: `Query` + `GetDataFreshness`, sin CRUD.

---

## 1. `internal/pkg/entity/campaign_metrics.go`

```go
package entity

// CampaignMetrics is one row of aggregated ad performance for a single
// campaign on a single day. Read-only: this repository never writes to
// {cliente}_reporting — that's owned by the centralized ETL.
type CampaignMetrics struct {
	Date         string  `json:"date"` // YYYY-MM-DD, from segments_date
	CampaignID   string  `json:"campaignId"`
	CampaignName string  `json:"campaignName"`
	Platform     string  `json:"platform"` // one of epa-frontend regla 4's channel keys
	Impressions  int64   `json:"impressions"`
	Clicks       int64   `json:"clicks"`
	CostMicros   int64   `json:"costMicros"` // raw; the frontend divides by 1e6 to display
	Conversions  float64 `json:"conversions"`
}

// CampaignMetricsFilter is the validated, normalized shape the service
// layer builds after checking a request's raw query params (see
// service/campaignmetrics/service.go). The repository never sees raw
// request input directly — only what already passed validation.
type CampaignMetricsFilter struct {
	StartDate string // YYYY-MM-DD, required
	EndDate   string // YYYY-MM-DD, required
	Platform  string // optional; "" means "all platforms"
	Limit     int64
}

// CampaignMetricsResponse wraps the list with the mandatory freshness
// marker (epa-bq regla 4, epa-backend regla 8) — the frontend renders
// "Datos al {fecha}" with this value, never with today's date.
type CampaignMetricsResponse struct {
	Items         []*CampaignMetrics `json:"items"`
	DataFreshness string             `json:"dataFreshness"` // YYYY-MM-DD
}
```

---

## 2. `internal/pkg/ports/campaign_metrics.go`

```go
package ports

import (
	"context"

	"github.com/epa-datos/epa-standards-backend/internal/pkg/entity"
)

// CampaignMetricsRepository is the read-only BigQuery contract for
// campaign-level ad performance. Unlike ExampleRepository (CRUD against a
// database this service owns), {cliente}_reporting is owned by the
// centralized ETL — this repository only ever queries it.
type CampaignMetricsRepository interface {
	Query(ctx context.Context, filter entity.CampaignMetricsFilter) ([]*entity.CampaignMetrics, error)
	GetDataFreshness(ctx context.Context) (string, error)
}

// CampaignMetricsService is the business-logic contract consumed by the
// HTTP layer (internal/infrastructure/api/campaignmetrics).
type CampaignMetricsService interface {
	List(ctx context.Context, filter entity.CampaignMetricsFilter) (*entity.CampaignMetricsResponse, error)
}
```

---

## 3. `internal/pkg/service/campaignmetrics/service.go`

```go
// Package campaignmetrics contains the business logic for campaign
// performance data. It validates and normalizes filters BEFORE ever
// touching BigQuery — the repository trusts its input completely, so all
// validation has to happen here, once.
package campaignmetrics

import (
	"context"
	"errors"
	"time"

	"github.com/epa-datos/epa-standards-backend/internal/pkg/entity"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/ports"
)

// Sentinel errors. internal/infrastructure/api/campaignmetrics/handlers.go
// translates these into HTTP status codes.
var (
	ErrInvalidDate    = errors.New("startDate/endDate must be YYYY-MM-DD")
	ErrInvalidRange   = errors.New("endDate must not be before startDate")
	ErrRangeTooLarge  = errors.New("date range exceeds the maximum allowed window")
	ErrInvalidPlatform = errors.New("platform is not a recognized channel key")
)

// maxRangeDays caps how much a single query can scan. Widen deliberately,
// not by accident — see epa-bq/references/cost-and-access.md.
const maxRangeDays = 400

// validPlatforms mirrors the channel keys documented in epa-frontend
// regla 4. Keep the two lists in sync by hand — there's no shared source
// yet (that's part of what @epa/tokens would give us, see stack.md).
var validPlatforms = map[string]bool{
	"google-ads": true, "meta": true, "tiktok": true, "dv360": true,
	"bing": true, "organic": true, "direct": true, "email": true,
}

const defaultLimit, maxLimit int64 = 500, 5000

type service struct {
	repo ports.CampaignMetricsRepository
}

// NewService builds a ports.CampaignMetricsService backed by the given
// repository. Swap the BigQuery implementation here, in routes.go,
// without touching this file.
func NewService(repo ports.CampaignMetricsRepository) ports.CampaignMetricsService {
	return &service{repo: repo}
}

func (s *service) List(ctx context.Context, filter entity.CampaignMetricsFilter) (*entity.CampaignMetricsResponse, error) {
	if err := validate(&filter); err != nil {
		return nil, err
	}

	items, err := s.repo.Query(ctx, filter)
	if err != nil {
		return nil, err
	}

	freshness, err := s.repo.GetDataFreshness(ctx)
	if err != nil {
		return nil, err
	}

	return &entity.CampaignMetricsResponse{Items: items, DataFreshness: freshness}, nil
}

// validate mutates filter in place to fill defaults (Limit) and returns a
// sentinel error for anything that should be a 400. This is the ONLY place
// that decides what reaches the SQL in the repository — a date range
// without a filter would fail against the transfer views anyway
// (require_partition_filter); better a clear 400 here than a raw BigQuery
// error reaching the client.
func validate(filter *entity.CampaignMetricsFilter) error {
	start, err := time.Parse("2006-01-02", filter.StartDate)
	if err != nil {
		return ErrInvalidDate
	}
	end, err := time.Parse("2006-01-02", filter.EndDate)
	if err != nil {
		return ErrInvalidDate
	}
	if end.Before(start) {
		return ErrInvalidRange
	}
	if end.Sub(start).Hours()/24 > maxRangeDays {
		return ErrRangeTooLarge
	}
	if filter.Platform != "" && !validPlatforms[filter.Platform] {
		return ErrInvalidPlatform
	}

	if filter.Limit <= 0 {
		filter.Limit = defaultLimit
	} else if filter.Limit > maxLimit {
		filter.Limit = maxLimit
	}
	return nil
}
```

---

## 4. `internal/infrastructure/repositories/bigquery/client.go`

```go
// Package bigquery is the read-only reference implementation of
// ports.CampaignMetricsRepository, backed by BigQuery.
package bigquery

import (
	"context"
	"fmt"
	"regexp"
	"sync"

	"cloud.google.com/go/bigquery"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/config"
	"github.com/sirupsen/logrus"
)

// identifierRe is deliberately strict: only what BigQuery accepts as a
// dataset/table-suffix identifier. Nothing outside this shape reaches the
// SQL string in campaign_metrics_repository.go.
var identifierRe = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

var (
	client     *bigquery.Client
	clientOnce sync.Once
)

// NewClient returns a singleton *bigquery.Client billed to
// config.Cfg.BQBillingProject. It reads from config.Cfg.BQDataProject
// (bdd-epa-digital), which is deliberately a DIFFERENT project from the
// one being billed.
//
// validateIdentifiers runs here, at startup, and calls logrus.Fatalf on
// failure — the process must never serve a single request with an
// unvalidated dataset/MCC, because those values get interpolated (not
// parameterized — BigQuery doesn't support parameterizing identifiers)
// into SQL later. See epa-backend regla 5.
func NewClient(ctx context.Context) *bigquery.Client {
	clientOnce.Do(func() {
		validateIdentifiers()

		cli, err := bigquery.NewClient(ctx, config.Cfg.BQBillingProject)
		if err != nil {
			logrus.Fatalf("bigquery: failed to create client: %v", err)
		}
		// Verificar en el primer `go build`/deploy real: si el dataset
		// necesita cli.Location fijado explícito (p. ej. "US") o si el
		// default de la librería ya resuelve bien contra
		// bdd-epa-digital.{cliente}_reporting.
		client = cli
	})
	return client
}

func validateIdentifiers() {
	cfg := config.Cfg
	if !identifierRe.MatchString(cfg.BQDataset) {
		logrus.Fatalf("bigquery: BQ_DATASET %q is not a valid identifier", cfg.BQDataset)
	}
	if !identifierRe.MatchString(cfg.BQAdsMCC) {
		logrus.Fatalf("bigquery: BQ_ADS_MCC %q is not a valid identifier", cfg.BQAdsMCC)
	}
	if cfg.BQDataProject == "" || cfg.BQBillingProject == "" {
		logrus.Fatal("bigquery: BQ_DATA_PROJECT and BQ_BILLING_PROJECT are required")
	}
}

// qualifiedTable returns a fully-qualified `project.dataset.table`. Safe
// to build with fmt.Sprintf ONLY because every part was already validated
// in validateIdentifiers above, at process startup — never from request
// input. See epa-backend regla 5 and security-reviewer §4's carve-out.
func qualifiedTable(dataProject, dataset, table string) string {
	return fmt.Sprintf("`%s.%s.%s`", dataProject, dataset, table)
}
```

---

## 5. `internal/infrastructure/repositories/bigquery/campaign_metrics_repository.go`

```go
package bigquery

import (
	"context"
	"fmt"

	"cloud.google.com/go/bigquery"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/config"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/entity"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/ports"
	"google.golang.org/api/iterator"
)

type CampaignMetricsRepository struct {
	client *bigquery.Client
}

// NewCampaignMetricsRepository builds a BigQuery-backed
// ports.CampaignMetricsRepository.
func NewCampaignMetricsRepository(client *bigquery.Client) ports.CampaignMetricsRepository {
	return &CampaignMetricsRepository{client: client}
}

// newQuery centralizes MaxBytesBilled so no query in this file can ship
// without a cost cap — see epa-safe-vibe A5 / epa-bq regla 5.
func (r *CampaignMetricsRepository) newQuery(sql string) *bigquery.Query {
	q := r.client.Query(sql)
	q.MaxBytesBilled = config.Cfg.BQMaxBytesBilled
	return q
}

func (r *CampaignMetricsRepository) Query(ctx context.Context, filter entity.CampaignMetricsFilter) ([]*entity.CampaignMetrics, error) {
	cfg := config.Cfg
	basicStats := qualifiedTable(cfg.BQDataProject, cfg.BQDataset, "ads_CampaignBasicStats_"+cfg.BQAdsMCC)
	campaign := qualifiedTable(cfg.BQDataProject, cfg.BQDataset, "ads_Campaign_"+cfg.BQAdsMCC)

	// %s below is fed ONLY qualified table names built from validated
	// startup config (see client.go). Every value that actually comes
	// from the request — dates, platform, limit — is a @parameter, never
	// interpolated.
	sql := fmt.Sprintf(`
		SELECT
		  s.segments_date        AS date,
		  s.campaign_id          AS campaign_id,
		  c.campaign_name        AS campaign_name,
		  s.metrics_impressions  AS impressions,
		  s.metrics_clicks       AS clicks,
		  s.metrics_cost_micros  AS cost_micros,
		  s.metrics_conversions  AS conversions
		FROM %s AS s
		JOIN %s AS c
		  ON s.campaign_id = c.campaign_id AND c._DATA_DATE = c._LATEST_DATE
		WHERE s.segments_date BETWEEN @startDate AND @endDate
		ORDER BY s.segments_date DESC
		LIMIT @limit
	`, basicStats, campaign)
	// Nota de extensión a Meta/TikTok: sus tablas de _DATA_DATE=_LATEST_DATE
	// no existen — el patrón ahí es CTE por plataforma + UNION ALL con
	// `platform` como literal en cada CTE, casteando costos STRING→NUMERIC
	// y extrayendo conversions del JSON `actions`. Ver
	// epa-bq/references/schema-social.md cuando exista. La interfaz de
	// ports/ no cambia — solo el SQL de este método (o un método por
	// plataforma si el filtro por @platform no basta con un UNION).

	q := r.newQuery(sql)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "startDate", Value: filter.StartDate},
		{Name: "endDate", Value: filter.EndDate},
		{Name: "limit", Value: filter.Limit},
	}

	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}

	var items []*entity.CampaignMetrics
	for {
		var row struct {
			Date         string  `bigquery:"date"`
			CampaignID   string  `bigquery:"campaign_id"`
			CampaignName string  `bigquery:"campaign_name"`
			Impressions  int64   `bigquery:"impressions"`
			Clicks       int64   `bigquery:"clicks"`
			CostMicros   int64   `bigquery:"cost_micros"`
			Conversions  float64 `bigquery:"conversions"`
		}
		err := it.Next(&row)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		items = append(items, &entity.CampaignMetrics{
			Date: row.Date, CampaignID: row.CampaignID, CampaignName: row.CampaignName,
			Platform: "google-ads", Impressions: row.Impressions, Clicks: row.Clicks,
			CostMicros: row.CostMicros, Conversions: row.Conversions,
		})
	}
	return items, nil
}

// GetDataFreshness returns the latest partition date materialized in the
// entity-side view — the mandatory dataFreshness marker (epa-bq regla 4,
// epa-backend regla 8).
func (r *CampaignMetricsRepository) GetDataFreshness(ctx context.Context) (string, error) {
	cfg := config.Cfg
	campaign := qualifiedTable(cfg.BQDataProject, cfg.BQDataset, "ads_Campaign_"+cfg.BQAdsMCC)

	sql := fmt.Sprintf(`SELECT MAX(_LATEST_DATE) AS freshness FROM %s`, campaign)
	q := r.newQuery(sql)

	it, err := q.Read(ctx)
	if err != nil {
		return "", err
	}
	var row struct {
		Freshness string `bigquery:"freshness"`
	}
	if err := it.Next(&row); err != nil && err != iterator.Done {
		return "", err
	}
	return row.Freshness, nil
}

// DryRunEstimate returns the bytes a query would scan without running it
// — útil para un endpoint de "estimar costo" antes de correr una query
// exploratoria pesada. Verificar en el primer go build real: la forma
// exacta de job.LastStatus().Statistics para un dry run (puede requerir
// un cast a *bigquery.QueryStatistics).
func (r *CampaignMetricsRepository) DryRunEstimate(ctx context.Context, sql string) (int64, error) {
	q := r.client.Query(sql)
	q.DryRun = true
	job, err := q.Run(ctx)
	if err != nil {
		return 0, err
	}
	stats := job.LastStatus().Statistics
	if qs, ok := stats.Details.(*bigquery.QueryStatistics); ok {
		return qs.TotalBytesProcessed, nil
	}
	return 0, fmt.Errorf("bigquery: unexpected statistics shape for dry run")
}
```

---

## 6. `internal/infrastructure/api/campaignmetrics/{handlers,routes}.go`

`handlers.go`:

```go
// Package campaignmetrics is the HTTP layer for campaign performance data
// — same shape as Eddy's example/{handlers,routes}.go, but a single
// read-only GET instead of full CRUD.
package campaignmetrics

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/epa-datos/epa-standards-backend/internal/pkg/entity"
	"github.com/epa-datos/epa-standards-backend/internal/pkg/ports"
	svc "github.com/epa-datos/epa-standards-backend/internal/pkg/service/campaignmetrics"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Handler groups the HTTP handlers for the CampaignMetrics resource. It
// only depends on ports.CampaignMetricsService (an interface), so tests
// can inject a mockery-generated mock instead of a real service.
type Handler struct {
	svc ports.CampaignMetricsService
}

func NewHandler(svc ports.CampaignMetricsService) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/campaign-metrics?startDate=&endDate=&platform=&limit=
func (h *Handler) List(c *gin.Context) {
	filter := entity.CampaignMetricsFilter{
		StartDate: c.Query("startDate"),
		EndDate:   c.Query("endDate"),
		Platform:  c.Query("platform"),
	}
	if raw := c.Query("limit"); raw != "" {
		if v, err := strconv.ParseInt(raw, 10, 64); err == nil {
			filter.Limit = v
		}
	}

	resp, err := h.svc.List(c.Request.Context(), filter)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// handleServiceError maps known sentinel errors to 400s. The default
// branch NEVER forwards the raw error to the client — a raw BigQuery
// error can leak dataset/table names — it logs server-side (with the SA's
// own identity, safe to log) and returns a generic message.
func (h *Handler) handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, svc.ErrInvalidDate), errors.Is(err, svc.ErrInvalidRange),
		errors.Is(err, svc.ErrRangeTooLarge), errors.Is(err, svc.ErrInvalidPlatform):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		logrus.WithError(err).Error("campaignmetrics: unexpected error")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	}
}
```

`routes.go`:

```go
package campaignmetrics

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the CampaignMetrics resource under the given
// router group, e.g. RegisterRoutes(v1.Group("/campaign-metrics"), h).
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.GET("", h.List)
}
```

---

## Reemplazo en `internal/infrastructure/api/routes.go`

Sin el grupo `middlewares.Auth()` de Eddy — con sidecar no hay caller
externo del que defenderse en este salto (ver `references/sidecar.md`); el
middleware de bearer estático se borra al forkear (ver
`fork-checklist.md`).

```go
func registerRoutes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")

	// --- CampaignMetrics resource -----------------------------------------
	bqClient := bigquery.NewClient(context.Background())
	campaignMetricsRepo := bigquery.NewCampaignMetricsRepository(bqClient)
	campaignMetricsService := campaignmetrics.NewService(campaignMetricsRepo)
	campaignMetricsHandler := campaignmetricsAPI.NewHandler(campaignMetricsService)
	campaignmetricsAPI.RegisterRoutes(v1.Group("/campaign-metrics"), campaignMetricsHandler)
}
```

---

## Campos nuevos en `internal/pkg/config/config.go`

Agregar al struct `Config` (mismo patrón de tags `mapstructure` que ya usa
el archivo):

```go
	// BigQuery (see internal/infrastructure/repositories/bigquery)
	BQBillingProject string `mapstructure:"BQ_BILLING_PROJECT"` // epa-turing
	BQDataProject    string `mapstructure:"BQ_DATA_PROJECT"`    // bdd-epa-digital
	BQDataset        string `mapstructure:"BQ_DATASET"`         // {cliente}_reporting
	BQAdsMCC         string `mapstructure:"BQ_ADS_MCC"`
	BQMaxBytesBilled int64  `mapstructure:"BQ_MAX_BYTES_BILLED"`
```

Y en `Load()`, junto al default ya existente de `ServerPort`:

```go
	if Cfg.BQMaxBytesBilled == 0 {
		Cfg.BQMaxBytesBilled = 100 * 1024 * 1024 // 100 MB, ver epa-bq
	}
```

`APIAuthToken` (el placeholder de bearer estático de Eddy) se borra al
forkear — ver `fork-checklist.md`.
