# TypeScript, ESLint y config de paquete — bloques copiables

Copiar tal cual al arrancar un dashboard nuevo. Detalle del racional en
`stack.md` (secciones 1 y 3).

---

## `tsconfig.json` (fragmento relevante)

```jsonc
{
  "compilerOptions": {
    "strict": true,                       // implica noImplicitAny, strictNullChecks...
    "noUncheckedIndexedAccess": true,     // arr[i] es T | undefined — mata el crash #1 de código LLM
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,         // imports de tipos explícitos
    "allowJs": false                      // sin escotillas .js
  }
}
```

---

## `eslint.config.mjs` — flat config sobre `typescript-eslint` strict-type-checked

```js
// eslint.config.mjs — sobre typescript-eslint "strict-type-checked"
rules: {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/ban-ts-comment": ["error", {
    "ts-ignore": true,                          // prohibido
    "ts-expect-error": "allow-with-description" // permitido solo con justificación escrita
  }],
  "@typescript-eslint/consistent-type-imports": "error"
}
```

El compilador permite `any` explícito; el linter no. `any` es error de lint,
no warning. `@ts-ignore` está prohibido; `@ts-expect-error` solo con
descripción escrita.

---

## `package.json` — fragmento

```jsonc
{
  "packageManager": "pnpm@10.14.0",       // corepack lo fuerza — versión exacta, no rango
  "engines": { "node": ">=22.0.0", "pnpm": ">=10" },
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

> `packageManager` debe ser una versión **exacta** (`pnpm@10.14.0`), no un
> rango (`pnpm@10.x`) — corepack no acepta rangos ahí y el proyecto no
> arranca.

---

## `.npmrc`

```
engine-strict=true
```

Con `engine-strict=true` + el `engines` de arriba, correr `npm install` en el
repo falla en vez de silenciarse — un solo gestor de paquetes por diseño.

---

## `.nvmrc`

```
22
```

Node 22 LTS fijado. Mismo valor en la imagen de CI (`epa-deploy`).

---

## Gate de CI

```
pnpm typecheck && pnpm lint && pnpm build
```

Los tres verdes o no hay deploy — sin excepciones ni flags de skip (ver
`epa-deploy`).
