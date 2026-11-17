# Control de acceso en `apps/api` — verificar IAP + `AccessUsers`

La API es **la única** que decide quién ve datos. Hace dos cosas en cada
request a `/api/v1/*`:

1. **Autentica:** verifica el JWT que IAP agrega (`X-Goog-IAP-JWT-Assertion`):
   firma ES256 contra las llaves de Google, `aud` de **este** servicio, `iss`
   de IAP y el dominio (`hd`). `apps/web` solo lo reenvía (ver
   `epa-frontend/references/auth.md`). **Ningún header plano se toma como
   identidad.**
2. **Autoriza:** busca el correo en la colección `AccessUsers` de la base de
   Firestore **propia del dashboard**. Solo `status: "active"` pasa.

Modelo: `EPA-Digital/kcm-informe-interno` (verifica en la API) y
`EPA-Digital/chedraui-dashboard` (en producción, la parte de `AccessUsers`).
Las diferencias con ellos son a propósito:

| Decisión | Por qué |
|---|---|
| Verificar en la API, no en web (Chedraui verifica en web) | La API no depende de que cada route handler use `fetchApi` ni de no quedar expuesta |
| Revisar el claim `hd` (ni KCM ni Chedraui lo hacen) | Si alguien amplía IAP por error (`allAuthenticatedUsers`), una cuenta de Gmail igual no pasa |
| Sin auto-registro, `/me` no escribe (KCM registra `pending` en un GET) | Sin registros basura; el alta la hace un admin |
| Solo `active` / `disabled` | No hay `pending` sin auto-registro; la baja es lógica y queda `updatedBy` |

`{module}` = el module path de `go.mod` del dashboard. Dependencias:
`google.golang.org/api/idtoken`, `cloud.google.com/go/firestore`, gin, logrus
(ya vienen en el fork de `epa-standards-backend`). Este código compila y sus
tests pasan tal cual (Go 1.24+).

---

## Variables de entorno (contenedor `api`)

| Variable | Valor | Notas |
|---|---|---|
| `AUTH_MODE` | `iap` | `local` solo en desarrollo; **se niega a arrancar** si existe `K_SERVICE` (Cloud Run) |
| `IAP_AUDIENCE` | `/projects/689827400521/locations/us-central1/services/{servicio}` | Lo imprime `setup-acceso.sh`. Sin él, el servidor no arranca |
| `AUTH_ALLOWED_DOMAINS` | `epa.digital` (default si falta) | Externos: `epa.digital,cliente.com`. `*` = no revisar dominio (solo con Datos e IA) |
| `FIRESTORE_PROJECT_ID` | `epa-turing` | |
| `FIRESTORE_DATABASE_ID` | `{servicio}` | Base dedicada, nunca `(default)` |
| `FIRESTORE_ACCESS_COLLECTION` | `AccessUsers` (default) | |
| `ACCESS_CACHE_TTL` | `60s` (default) | Una baja tarda hasta esto en verse en otras instancias. El admin se relee siempre sin caché |

## Endpoints

| Ruta | Guardias | Para qué |
|---|---|---|
| `GET /api/v1/me` | `Identity` | Estado de quien pregunta: 200 con su registro, 401 sin JWT válido, 403 sin alta |
| `/api/v1/*` (datos) | `Identity` + `RequireAccess` | Solo `active` |
| `GET/POST /api/v1/admin/access-users`, `PATCH …/:email` | + `RequireAdmin` (sin caché) | Pantalla de accesos |

`/health` va fuera de `/api/v1` y sin guardias (el startup probe no trae JWT).

---

## Código

### Dominio

`internal/pkg/entity/access_user.go`

```go
package entity

import (
	"strings"
	"time"
)

// Roles y estados de un AccessUser. Solo `active` ve datos.
const (
	RoleAdmin   = "admin"
	RoleUsuario = "usuario"

	StatusActive   = "active"
	StatusDisabled = "disabled" // baja lógica: el registro se conserva
)

// AccessUser es una persona dada de alta en ESTE dashboard. El ID del
// documento en Firestore es NormalizeEmail(email).
type AccessUser struct {
	Email     string     `json:"email" firestore:"-"`
	Name      string     `json:"name,omitempty" firestore:"name,omitempty"`
	Role      string     `json:"role" firestore:"role"`
	Status    string     `json:"status" firestore:"status"`
	CreatedAt time.Time  `json:"createdAt" firestore:"createdAt,serverTimestamp"`
	CreatedBy string     `json:"createdBy,omitempty" firestore:"createdBy,omitempty"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty" firestore:"updatedAt,omitempty"`
	UpdatedBy string     `json:"updatedBy,omitempty" firestore:"updatedBy,omitempty"`
}

// AccessUserPatch: cambio parcial; solo se aplica lo que no es nil.
type AccessUserPatch struct {
	Role   *string `json:"role"`
	Status *string `json:"status"`
	Name   *string `json:"name"`
}

// Identity es lo que salió de un JWT de IAP verificado. Nunca del request.
type Identity struct {
	Email string
}

// NormalizeEmail es la ÚNICA forma de derivar la llave de un AccessUser.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func ValidRole(r string) bool   { return r == RoleAdmin || r == RoleUsuario }
func ValidStatus(s string) bool { return s == StatusActive || s == StatusDisabled }
```

`internal/pkg/ports/access.go`

```go
package ports

import (
	"context"
	"errors"
	"net/http"

	"{module}/internal/pkg/entity"
)

var (
	ErrNoIdentity        = errors.New("request sin identidad verificada")            // → 401
	ErrForbidden         = errors.New("sin acceso a este dashboard")                 // → 403
	ErrAccessUserExists  = errors.New("la persona ya está dada de alta")             // → 409
	ErrAccessUserMissing = errors.New("la persona no existe")                        // → 404
	ErrSelfChange        = errors.New("un admin no puede quitarse su propio acceso") // → 409
	ErrInvalidInput      = errors.New("datos inválidos")                             // → 400
)

// Verifier saca la identidad del request (JWT de IAP en producción).
type Verifier interface {
	Verify(ctx context.Context, r *http.Request) (*entity.Identity, error)
}

// AccessUserRepository: Get devuelve (nil, nil) si el correo no está.
// "No registrado" no es error de infraestructura (sería 500 en vez de 403).
type AccessUserRepository interface {
	Get(ctx context.Context, email string) (*entity.AccessUser, error)
	List(ctx context.Context) ([]*entity.AccessUser, error)
	// Create falla con ErrAccessUserExists si ya existe: nunca pisa a nadie.
	Create(ctx context.Context, user entity.AccessUser) (*entity.AccessUser, error)
	// Update toca solo los campos del patch; ErrAccessUserMissing si no existe.
	Update(ctx context.Context, email string, patch entity.AccessUserPatch, by string) (*entity.AccessUser, error)
}
```

### Verificador del JWT de IAP

`internal/infrastructure/api/auth/verifier.go`

```go
// Package auth saca la identidad de cada request en el servidor. Nunca se
// confía en un correo que mande el cliente: sale de un JWT firmado por IAP.
package auth

import (
	"context"
	"net/http"
	"strings"

	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
	"google.golang.org/api/idtoken"
)

const (
	IAPJWTHeader = "X-Goog-IAP-JWT-Assertion"
	iapIssuer    = "https://cloud.google.com/iap"
)

// ValidateFunc valida firma, expiración y audience (inyectable en tests).
type ValidateFunc func(ctx context.Context, token, audience string) (*idtoken.Payload, error)

// IAPVerifier valida el JWT que IAP agrega a cada request.
type IAPVerifier struct {
	audience string
	domains  map[string]bool // vacío = no se revisa el dominio
	validate ValidateFunc
}

// NewIAPVerifier usa idtoken.Validate (llaves públicas de IAP, ES256) por default.
func NewIAPVerifier(audience string, allowedDomains []string, validate ValidateFunc) *IAPVerifier {
	if validate == nil {
		validate = idtoken.Validate
	}
	domains := map[string]bool{}
	for _, d := range allowedDomains {
		if d = strings.ToLower(strings.TrimSpace(d)); d != "" {
			domains[d] = true
		}
	}
	return &IAPVerifier{audience: audience, domains: domains, validate: validate}
}

func (v *IAPVerifier) Verify(ctx context.Context, r *http.Request) (*entity.Identity, error) {
	token := r.Header.Get(IAPJWTHeader)
	if token == "" {
		return nil, ports.ErrNoIdentity
	}
	p, err := v.validate(ctx, token, v.audience)
	if err != nil || p == nil || p.Issuer != iapIssuer {
		return nil, ports.ErrNoIdentity // firma, audience o emisor inválidos
	}
	email, _ := p.Claims["email"].(string)
	// Con identidades de Google el correo llega pelado; se quita un prefijo
	// "accounts.google.com:" por si acaso.
	email = entity.NormalizeEmail(email[strings.LastIndex(email, ":")+1:])
	if email == "" {
		return nil, ports.ErrNoIdentity
	}
	if len(v.domains) > 0 {
		// `hd` = dominio de Google Workspace. Una cuenta personal no lo trae.
		hd, _ := p.Claims["hd"].(string)
		if !v.domains[strings.ToLower(hd)] {
			return nil, ports.ErrNoIdentity
		}
	}
	return &entity.Identity{Email: email}, nil
}

// LocalVerifier: SOLO desarrollo. Confía en X-Dev-User-Email. La config se
// niega a arrancarlo en Cloud Run (ver config.ValidateAuth).
type LocalVerifier struct{}

func (LocalVerifier) Verify(_ context.Context, r *http.Request) (*entity.Identity, error) {
	email := entity.NormalizeEmail(r.Header.Get("X-Dev-User-Email"))
	if email == "" {
		return nil, ports.ErrNoIdentity
	}
	return &entity.Identity{Email: email}, nil
}
```

> **External identities** (dashboards con gente del cliente vía Identity
> Platform): el correo viene en el claim `gcip`, no en `email`, y no hay `hd`.
> KCM tiene un parser (`identityFromClaims`) que **nunca se validó contra
> tokens reales**. Ese caso se escala a `datos@epa.digital`; no adaptar este
> verificador a ciegas.

`internal/infrastructure/api/auth/verifier_test.go`

```go
package auth

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"google.golang.org/api/idtoken"
)

func fakeValidate(p *idtoken.Payload, err error) ValidateFunc {
	return func(context.Context, string, string) (*idtoken.Payload, error) { return p, err }
}

func TestIAPVerifier(t *testing.T) {
	ok := &idtoken.Payload{Issuer: iapIssuer, Claims: map[string]any{"email": "Ana@EPA.digital", "hd": "epa.digital"}}
	cases := []struct {
		name    string
		token   string
		p       *idtoken.Payload
		err     error
		wantErr bool
		want    string
	}{
		{"válido", "t", ok, nil, false, "ana@epa.digital"},
		{"sin token", "", ok, nil, true, ""},
		{"firma inválida", "t", nil, errors.New("bad"), true, ""},
		{"otro emisor", "t", &idtoken.Payload{Issuer: "x", Claims: ok.Claims}, nil, true, ""},
		{"gmail sin hd", "t", &idtoken.Payload{Issuer: iapIssuer, Claims: map[string]any{"email": "x@gmail.com"}}, nil, true, ""},
		{"otro dominio", "t", &idtoken.Payload{Issuer: iapIssuer, Claims: map[string]any{"email": "x@coppel.com", "hd": "coppel.com"}}, nil, true, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := NewIAPVerifier("/projects/1/locations/r/services/s", []string{"epa.digital"}, fakeValidate(c.p, c.err))
			r := httptest.NewRequest("GET", "/", nil)
			if c.token != "" {
				r.Header.Set(IAPJWTHeader, c.token)
			}
			id, err := v.Verify(context.Background(), r)
			if (err != nil) != c.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, c.wantErr)
			}
			if !c.wantErr && id.Email != c.want {
				t.Fatalf("email = %q, want %q", id.Email, c.want)
			}
		})
	}
}
```

### Service

`internal/pkg/service/access/service.go`

```go
// Package access decide quién ve el dashboard. IAP autentica y el verifier
// ya sacó el correo del JWT; aquí solo se contesta "¿está dado de alta y
// activo?", y se administran las altas y bajas.
package access

import (
	"context"
	"sync"
	"time"

	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
)

type cached struct {
	user    *entity.AccessUser // nil = no registrado (también se cachea)
	expires time.Time
}

type Service struct {
	repo ports.AccessUserRepository
	ttl  time.Duration
	now  func() time.Time

	mu    sync.Mutex
	cache map[string]cached
}

// NewService: ttl acota las lecturas a Firestore. Una baja tarda hasta ttl
// en verse en las demás instancias (60 s por default, ver config).
func NewService(repo ports.AccessUserRepository, ttl time.Duration) *Service {
	return &Service{repo: repo, ttl: ttl, now: time.Now, cache: map[string]cached{}}
}

// Authorize es el guardia de las rutas de datos: solo `active` pasa.
func (s *Service) Authorize(ctx context.Context, id entity.Identity) (*entity.AccessUser, error) {
	user, err := s.Me(ctx, id)
	if err != nil {
		return nil, err
	}
	if user.Status != entity.StatusActive {
		return nil, ports.ErrForbidden
	}
	return user, nil
}

// Me devuelve el registro en cualquier estado. NO escribe: sin alta = 403.
func (s *Service) Me(ctx context.Context, id entity.Identity) (*entity.AccessUser, error) {
	key := entity.NormalizeEmail(id.Email)
	if key == "" {
		return nil, ports.ErrNoIdentity
	}
	user, err := s.lookup(ctx, key)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ports.ErrForbidden
	}
	return user, nil
}

// AdminFresh relee SIN caché: quitarle el rol a un admin tiene efecto en la
// siguiente petición, no al expirar la caché de cada instancia.
func (s *Service) AdminFresh(ctx context.Context, id entity.Identity) (*entity.AccessUser, error) {
	key := entity.NormalizeEmail(id.Email)
	if key == "" {
		return nil, ports.ErrNoIdentity
	}
	user, err := s.repo.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	if user == nil || user.Status != entity.StatusActive || user.Role != entity.RoleAdmin {
		return nil, ports.ErrForbidden
	}
	return user, nil
}

// --- Administración (solo detrás de RequireAdmin) ---------------------------

func (s *Service) List(ctx context.Context) ([]*entity.AccessUser, error) {
	return s.repo.List(ctx)
}

// Create da de alta a una persona, siempre `active`. `by` sale del token.
func (s *Service) Create(ctx context.Context, email, name, role, by string) (*entity.AccessUser, error) {
	key := entity.NormalizeEmail(email)
	if key == "" || !entity.ValidRole(role) {
		return nil, ports.ErrInvalidInput
	}
	user, err := s.repo.Create(ctx, entity.AccessUser{
		Email: key, Name: name, Role: role, Status: entity.StatusActive, CreatedBy: by,
	})
	if err != nil {
		return nil, err
	}
	s.forget(key)
	return user, nil
}

// Update cambia rol, estado o nombre. Un admin no puede quitarse a sí mismo
// el rol ni darse de baja: así nunca queda el dashboard sin quien lo administre
// por un clic accidental.
func (s *Service) Update(ctx context.Context, email string, patch entity.AccessUserPatch, by string) (*entity.AccessUser, error) {
	key := entity.NormalizeEmail(email)
	if key == "" ||
		(patch.Role != nil && !entity.ValidRole(*patch.Role)) ||
		(patch.Status != nil && !entity.ValidStatus(*patch.Status)) {
		return nil, ports.ErrInvalidInput
	}
	if key == entity.NormalizeEmail(by) &&
		((patch.Role != nil && *patch.Role != entity.RoleAdmin) ||
			(patch.Status != nil && *patch.Status != entity.StatusActive)) {
		return nil, ports.ErrSelfChange
	}
	user, err := s.repo.Update(ctx, key, patch, by)
	if err != nil {
		return nil, err
	}
	s.forget(key)
	return user, nil
}

func (s *Service) lookup(ctx context.Context, key string) (*entity.AccessUser, error) {
	s.mu.Lock()
	hit, ok := s.cache[key]
	s.mu.Unlock()
	if ok && s.now().Before(hit.expires) {
		return hit.user, nil
	}
	user, err := s.repo.Get(ctx, key)
	if err != nil {
		return nil, err // un error de Firestore no se cachea
	}
	s.mu.Lock()
	s.cache[key] = cached{user: user, expires: s.now().Add(s.ttl)}
	s.mu.Unlock()
	return user, nil
}

func (s *Service) forget(key string) {
	s.mu.Lock()
	delete(s.cache, key)
	s.mu.Unlock()
}
```

`internal/pkg/service/access/service_test.go`

```go
package access

import (
	"context"
	"errors"
	"testing"
	"time"

	"{module}/internal/infrastructure/repositories/mockdata"
	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
)

func ptr(s string) *string { return &s }

func TestService(t *testing.T) {
	ctx := context.Background()
	s := NewService(mockdata.NewAccessUserRepository(), time.Minute)

	if _, err := s.Create(ctx, "Ana@epa.digital", "Ana", entity.RoleUsuario, "jefa@epa.digital"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(ctx, "ana@epa.digital", "", entity.RoleUsuario, "x"); !errors.Is(err, ports.ErrAccessUserExists) {
		t.Fatalf("alta duplicada: %v", err)
	}
	if _, err := s.Authorize(ctx, entity.Identity{Email: "ana@epa.digital"}); err != nil {
		t.Fatalf("activa debería pasar: %v", err)
	}
	if _, err := s.Update(ctx, "ana@epa.digital", entity.AccessUserPatch{Status: ptr("disabled")}, "jefa@epa.digital"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Authorize(ctx, entity.Identity{Email: "ana@epa.digital"}); !errors.Is(err, ports.ErrForbidden) {
		t.Fatalf("baja debería ser 403 al momento (forget): %v", err)
	}
	if _, err := s.Update(ctx, "jefa@epa.digital", entity.AccessUserPatch{Role: ptr("usuario")}, "Jefa@epa.digital"); !errors.Is(err, ports.ErrSelfChange) {
		t.Fatalf("auto-degradarse: %v", err)
	}
	if _, err := s.Me(ctx, entity.Identity{}); !errors.Is(err, ports.ErrNoIdentity) {
		t.Fatalf("sin correo: %v", err)
	}
}
```

### HTTP: middlewares y handlers

`internal/infrastructure/api/access/access.go`

```go
// Package access es el lado HTTP de la autorización: middlewares que toda
// ruta /api/v1 atraviesa, GET /api/v1/me y la administración de accesos.
package access

import (
	"errors"
	"net/http"

	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
	svc "{module}/internal/pkg/service/access"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const (
	identityKey = "accessIdentity"
	userKey     = "accessUser"
)

// NoStore: ninguna respuesta con datos o identidad se cachea en el navegador
// ni en un proxy intermedio.
func NoStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}

// Identity verifica el JWT de IAP y pone la identidad en el contexto.
func Identity(v ports.Verifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := v.Verify(c.Request.Context(), c.Request)
		if err != nil {
			abort(c, err)
			return
		}
		c.Set(identityKey, *id)
		c.Next()
	}
}

// RequireAccess: solo un registro `active` pasa. Va después de Identity.
func RequireAccess(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := s.Authorize(c.Request.Context(), identityOf(c))
		if err != nil {
			abort(c, err)
			return
		}
		c.Set(userKey, user)
		c.Next()
	}
}

// RequireAdmin relee el registro SIN caché en cada petición.
func RequireAdmin(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := s.AdminFresh(c.Request.Context(), identityOf(c))
		if err != nil {
			abort(c, err)
			return
		}
		c.Set(userKey, user)
		c.Next()
	}
}

// Actor: el correo verificado de quien llama. Es lo ÚNICO que se usa como
// autor de un cambio (createdBy/updatedBy), nunca un campo del body.
func Actor(c *gin.Context) string { return identityOf(c).Email }

func identityOf(c *gin.Context) entity.Identity {
	if v, ok := c.Get(identityKey); ok {
		if id, ok := v.(entity.Identity); ok {
			return id
		}
	}
	return entity.Identity{}
}

// Me: el registro de quien pregunta. Fuera de RequireAccess para que un
// `disabled` reciba su estado (la UI muestra "Sin acceso").
func Me(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := s.Me(c.Request.Context(), identityOf(c))
		if err != nil {
			abort(c, err)
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

// --- Administración (grupo con RequireAdmin) --------------------------------

func List(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		users, err := s.List(c.Request.Context())
		if err != nil {
			abort(c, err)
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

type createBody struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name"`
	Role  string `json:"role" binding:"required,oneof=admin usuario"`
}

func Create(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body createBody
		if err := c.ShouldBindJSON(&body); err != nil {
			abort(c, ports.ErrInvalidInput)
			return
		}
		user, err := s.Create(c.Request.Context(), body.Email, body.Name, body.Role, Actor(c))
		if err != nil {
			abort(c, err)
			return
		}
		c.JSON(http.StatusCreated, user)
	}
}

func Update(s *svc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var patch entity.AccessUserPatch
		if err := c.ShouldBindJSON(&patch); err != nil {
			abort(c, ports.ErrInvalidInput)
			return
		}
		user, err := s.Update(c.Request.Context(), c.Param("email"), patch, Actor(c))
		if err != nil {
			abort(c, err)
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func abort(c *gin.Context, err error) {
	status, code := http.StatusInternalServerError, "internal error"
	switch {
	case errors.Is(err, ports.ErrNoIdentity):
		status, code = http.StatusUnauthorized, "unauthenticated"
	case errors.Is(err, ports.ErrForbidden):
		status, code = http.StatusForbidden, "forbidden"
	case errors.Is(err, ports.ErrInvalidInput):
		status, code = http.StatusBadRequest, "invalid input"
	case errors.Is(err, ports.ErrAccessUserExists), errors.Is(err, ports.ErrSelfChange):
		status, code = http.StatusConflict, err.Error()
	case errors.Is(err, ports.ErrAccessUserMissing):
		status, code = http.StatusNotFound, "not found"
	default:
		// Fallar cerrado: si Firestore no contesta, nadie entra.
		logrus.WithError(err).Error("access: no se pudo consultar la lista de acceso")
	}
	c.AbortWithStatusJSON(status, gin.H{"error": code})
}
```

### Repositorios

`internal/infrastructure/repositories/firestore/access_user_repository.go`

```go
package firestore

import (
	"context"
	"time"

	"cloud.google.com/go/firestore"
	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// opTimeout: si Firestore no contesta, el request falla (500) en vez de
// quedarse colgado. Fallar cerrado, no abierto.
const opTimeout = 5 * time.Second

// AccessUserRepository sobre la base DEDICADA del dashboard
// (FIRESTORE_DATABASE_ID = nombre del servicio), colección AccessUsers.
// Nunca la base (default) ni la colección `users` de bdd-epa-digital.
type AccessUserRepository struct {
	client     *firestore.Client
	collection string
}

func NewAccessUserRepository(client *firestore.Client, collection string) *AccessUserRepository {
	return &AccessUserRepository{client: client, collection: collection}
}

func (r *AccessUserRepository) doc(email string) *firestore.DocumentRef {
	return r.client.Collection(r.collection).Doc(email)
}

func (r *AccessUserRepository) Get(ctx context.Context, email string) (*entity.AccessUser, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	snap, err := r.doc(email).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return decode(snap)
}

func (r *AccessUserRepository) List(ctx context.Context) ([]*entity.AccessUser, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	snaps, err := r.client.Collection(r.collection).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}
	users := make([]*entity.AccessUser, 0, len(snaps))
	for _, snap := range snaps {
		u, err := decode(snap)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// Create usa Create y NO Set: si el documento existe falla con AlreadyExists,
// así un alta nunca pisa a otra persona (activa o dada de baja).
func (r *AccessUserRepository) Create(ctx context.Context, user entity.AccessUser) (*entity.AccessUser, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	_, err := r.doc(user.Email).Create(ctx, user)
	if status.Code(err) == codes.AlreadyExists {
		return nil, ports.ErrAccessUserExists
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, user.Email) // relee createdAt (serverTimestamp)
}

// Update toca solo los campos del patch + updatedAt/updatedBy. Nunca
// reemplaza el documento, y si no existe falla en vez de crearlo.
func (r *AccessUserRepository) Update(ctx context.Context, email string, patch entity.AccessUserPatch, by string) (*entity.AccessUser, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	updates := []firestore.Update{
		{Path: "updatedAt", Value: firestore.ServerTimestamp},
		{Path: "updatedBy", Value: by},
	}
	if patch.Role != nil {
		updates = append(updates, firestore.Update{Path: "role", Value: *patch.Role})
	}
	if patch.Status != nil {
		updates = append(updates, firestore.Update{Path: "status", Value: *patch.Status})
	}
	if patch.Name != nil {
		updates = append(updates, firestore.Update{Path: "name", Value: *patch.Name})
	}
	_, err := r.doc(email).Update(ctx, updates)
	if status.Code(err) == codes.NotFound {
		return nil, ports.ErrAccessUserMissing
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, email)
}

func decode(snap *firestore.DocumentSnapshot) (*entity.AccessUser, error) {
	var u entity.AccessUser
	if err := snap.DataTo(&u); err != nil {
		return nil, err
	}
	u.Email = snap.Ref.ID
	return &u, nil
}
```

`internal/infrastructure/repositories/mockdata/access_user_repository.go`

```go
package mockdata

import (
	"context"
	"sync"
	"time"

	"{module}/internal/pkg/entity"
	"{module}/internal/pkg/ports"
)

// AccessUserRepository para DATA_SOURCE=mock: cualquier correo es `admin`
// activo, para desarrollar sin Firestore. Las altas viven en memoria.
type AccessUserRepository struct {
	mu    sync.Mutex
	users map[string]*entity.AccessUser
}

func NewAccessUserRepository() *AccessUserRepository {
	return &AccessUserRepository{users: map[string]*entity.AccessUser{}}
}

func (r *AccessUserRepository) Get(_ context.Context, email string) (*entity.AccessUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if u, ok := r.users[email]; ok {
		cp := *u
		return &cp, nil
	}
	return &entity.AccessUser{Email: email, Role: entity.RoleAdmin, Status: entity.StatusActive}, nil
}

func (r *AccessUserRepository) List(_ context.Context) ([]*entity.AccessUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]*entity.AccessUser, 0, len(r.users))
	for _, u := range r.users {
		cp := *u
		out = append(out, &cp)
	}
	return out, nil
}

func (r *AccessUserRepository) Create(_ context.Context, user entity.AccessUser) (*entity.AccessUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.users[user.Email]; ok {
		return nil, ports.ErrAccessUserExists
	}
	user.CreatedAt = time.Now()
	r.users[user.Email] = &user
	cp := user
	return &cp, nil
}

func (r *AccessUserRepository) Update(_ context.Context, email string, p entity.AccessUserPatch, by string) (*entity.AccessUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[email]
	if !ok {
		return nil, ports.ErrAccessUserMissing
	}
	if p.Role != nil {
		u.Role = *p.Role
	}
	if p.Status != nil {
		u.Status = *p.Status
	}
	if p.Name != nil {
		u.Name = *p.Name
	}
	now := time.Now()
	u.UpdatedAt, u.UpdatedBy = &now, by
	cp := *u
	return &cp, nil
}
```

### Configuración y wiring

`internal/pkg/config/auth.go`

```go
package config

import (
	"errors"
	"os"
	"strings"
	"time"
)

// Auth: las variables de acceso del contenedor api.
type Auth struct {
	Mode           string        // AUTH_MODE: "iap" (default) | "local"
	IAPAudience    string        // IAP_AUDIENCE: /projects/NÚM/locations/REGIÓN/services/SERVICIO
	AllowedDomains []string      // AUTH_ALLOWED_DOMAINS: "epa.digital" (default)
	Collection     string        // FIRESTORE_ACCESS_COLLECTION: "AccessUsers" (default)
	CacheTTL       time.Duration // ACCESS_CACHE_TTL: 60s (default)
}

func LoadAuth() (Auth, error) {
	a := Auth{
		Mode:        or(os.Getenv("AUTH_MODE"), "iap"),
		IAPAudience: strings.TrimSpace(os.Getenv("IAP_AUDIENCE")),
		Collection:  or(os.Getenv("FIRESTORE_ACCESS_COLLECTION"), "AccessUsers"),
		CacheTTL:    time.Minute,
	}
	// Variable ausente = epa.digital. Para desactivar el chequeo de dominio
	// (dashboards externos, decisión de Datos e IA) se pone explícitamente "*".
	domains, set := os.LookupEnv("AUTH_ALLOWED_DOMAINS")
	if !set {
		domains = "epa.digital"
	}
	if strings.TrimSpace(domains) != "*" {
		for _, d := range strings.Split(domains, ",") {
			if d = strings.TrimSpace(d); d != "" {
				a.AllowedDomains = append(a.AllowedDomains, d)
			}
		}
		if len(a.AllowedDomains) == 0 {
			return a, errors.New("config: AUTH_ALLOWED_DOMAINS vacío (usa \"*\" para no revisar dominio)")
		}
	}
	if v := os.Getenv("ACCESS_CACHE_TTL"); v != "" {
		ttl, err := time.ParseDuration(v)
		if err != nil || ttl < 0 {
			return a, errors.New("config: ACCESS_CACHE_TTL inválido (p. ej. 60s)")
		}
		a.CacheTTL = ttl
	}
	return a, a.validate()
}

// validate falla cerrado: una config de acceso inválida impide ARRANCAR el
// servidor, en vez de dejar pasar a alguien.
func (a Auth) validate() error {
	switch a.Mode {
	case "iap":
		if a.IAPAudience == "" {
			return errors.New("config: AUTH_MODE=iap requiere IAP_AUDIENCE")
		}
	case "local":
		// Cloud Run siempre define K_SERVICE: el modo local nunca arranca desplegado.
		if os.Getenv("K_SERVICE") != "" {
			return errors.New("config: AUTH_MODE=local no se permite en Cloud Run")
		}
	default:
		return errors.New("config: AUTH_MODE debe ser 'iap' o 'local'")
	}
	return nil
}

func or(v, d string) string {
	if v = strings.TrimSpace(v); v != "" {
		return v
	}
	return d
}
```

En `internal/infrastructure/api/routes.go`, el **único** punto de wiring. El
repositorio sale de `DATA_SOURCE` como cualquier otro recurso (`mockdata` o
`firestore`, con el cliente de Firestore creado perezosamente). Llamar a
`config.LoadAuth()` en `main` y **terminar el proceso si devuelve error**:

`internal/infrastructure/api/routes.go (fragmento)`

```go
package wiring

import (
	accessAPI "{module}/internal/infrastructure/api/access"
	"{module}/internal/infrastructure/api/auth"
	"{module}/internal/pkg/config"
	"{module}/internal/pkg/ports"
	accessSvc "{module}/internal/pkg/service/access"
	"github.com/gin-gonic/gin"
)

// registerAccess: el ORDEN importa. En gin, un middleware de grupo solo
// aplica a las rutas registradas DESPUÉS de su Use.
func registerAccess(r *gin.Engine, cfg config.Auth, repo ports.AccessUserRepository, responseCache gin.HandlerFunc) *gin.RouterGroup {
	var verifier ports.Verifier = auth.LocalVerifier{}
	if cfg.Mode == "iap" {
		verifier = auth.NewIAPVerifier(cfg.IAPAudience, cfg.AllowedDomains, nil)
	}
	svc := accessSvc.NewService(repo, cfg.CacheTTL)

	v1 := r.Group("/api/v1")
	v1.Use(accessAPI.NoStore(), accessAPI.Identity(verifier))

	// /me: identidad verificada, pero sin RequireAccess (un `disabled` tiene
	// que poder preguntar su estado).
	v1.GET("/me", accessAPI.Me(svc))

	v1.Use(accessAPI.RequireAccess(svc))

	// Admin ANTES de la caché de respuestas: la caché devuelve un cuerpo
	// guardado sin pasar por los middlewares, y le entregaría la lista de
	// personas a cualquiera con acceso.
	admin := v1.Group("/admin/access-users", accessAPI.RequireAdmin(svc))
	admin.GET("", accessAPI.List(svc))
	admin.POST("", accessAPI.Create(svc))
	admin.PATCH("/:email", accessAPI.Update(svc))

	if responseCache != nil {
		v1.Use(responseCache)
	}
	return v1 // aquí se registran las rutas de datos
}
```

---

## Primer admin y altas

- **Primer admin:** lo crea `epa-deploy/scripts/setup-acceso.sh --admin
  correo@epa.digital` (documento `AccessUsers/{correo}` con `role: admin`,
  `status: active`). Solo si no existe: nunca pisa un registro.
- **Altas siguientes:** desde la pantalla `/admin/accesos` (ver
  `epa-frontend/references/auth.md`). Sin pantalla todavía: consola de
  Firestore → base `{servicio}` → `AccessUsers` → documento con ID = correo en
  minúsculas y los campos `role`, `status`.
- **Recuperar acceso si no queda ningún admin activo:** editar el documento a
  mano en la consola. El service impide que un admin se quite a sí mismo, pero
  dos admins pueden quitarse entre ellos.

## Fuera de esto

- **Filtros por fila** (qué cuentas o clientes ve cada quien): cuando hagan
  falta, se aplican en el service del recurso usando el `AccessUser` que
  `RequireAccess` deja en el contexto, antes de armar la query. Nunca en web.
- **Endpoints de máquina** (un job que llama a la API): no existen en el
  patrón sidecar. Si alguno llegara a hacer falta, OIDC de service account y
  fallar cerrado; nunca un `if secret != "" && ...` que deje pasar cuando
  falta la variable (caso Coppel).
