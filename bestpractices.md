# Buenas Prácticas — React Native Mobile Project

> Documento de referencia para el agente de refactorización.
> Leer completamente antes de tocar cualquier archivo.

---

## Instrucciones para el agente

Eres un agente de **refactorización y modularización**. Tu única responsabilidad es mejorar la estructura, organización y calidad del código existente **sin romper funcionalidad**.

### Reglas de oro del agente

1. **No cambiar comportamiento** — si algo funciona, debe seguir funcionando exactamente igual después del refactor.
2. **Un cambio a la vez** — no refactorices múltiples archivos en un solo paso sin verificar que el anterior no rompió nada.
3. **Antes de mover código**, verificar todas las importaciones que lo referencian y actualizarlas en el mismo paso.
4. **Si hay ambigüedad** sobre si un cambio puede romper algo — no lo hagas y consulta primero.
5. **Tests primero** — si el proyecto tiene tests, correrlos antes y después de cada cambio. Si no hay tests, ser doblemente cauteloso.
6. **Commits atómicos** — cada refactor debe ser un commit separado con mensaje descriptivo siguiendo Conventional Commits.
7. **Verificar en ambas plataformas** — un cambio que funciona en iOS puede romper Android. Si el proyecto tiene emuladores disponibles, verificar en ambos.

### Qué SÍ hacer

- Extraer lógica de componentes a custom hooks
- Mover types/interfaces a archivos `.types.ts`
- Separar llamadas HTTP a archivos `.api.ts` o `.service.ts`
- Dividir archivos que superen 400 líneas
- Reemplazar rutas relativas profundas (`../../`) por imports con `@/`
- Extraer `StyleSheet.create` repetidos a archivos `[component].styles.ts`
- Reemplazar valores mágicos (colores, tamaños) por tokens del design system

### Qué NO hacer

- No cambiar lógica de negocio
- No cambiar contratos de funciones (parámetros, valores de retorno)
- No renombrar props de componentes sin actualizar todos los consumidores
- No eliminar código sin verificar que no se usa en ningún otro lugar
- No fusionar archivos — solo dividir
- No reemplazar componentes nativos (`View`, `Text`, `TouchableOpacity`) por equivalentes web — React Native no es web
- No usar `px`, `em`, `rem` ni unidades CSS — React Native usa números sin unidad

---

## 1. Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | React Native + Expo (SDK 51+) | Managed workflow |
| Lenguaje | TypeScript (strict mode) | — |
| Package manager | Bun | No usar npm ni yarn |
| Navegación | Expo Router v3 | File-based routing, equivalente al App Router de Next.js |
| Estilos | StyleSheet.create + design tokens | Sin CSS — números sin unidad |
| Estado global | React Context + useReducer | Solo estado verdaderamente global |
| Server state | TanStack Query v5 | Para todas las llamadas HTTP |
| Formularios | React Hook Form + Zod | Formik no está optimizado para mobile |
| Backend | API Routes propias (Next.js / Express) | El cliente nunca llama directo a Supabase |
| Auth | Supabase Auth vía API propia | Abstraído detrás del backend |
| Almacenamiento local | AsyncStorage / MMKV | MMKV para datos frecuentes (más rápido) |
| Linting | ESLint + Prettier | — |
| Commits | Conventional Commits | — |

---

## 2. Arquitectura — Regla Fundamental

> El cliente móvil **nunca** se comunica directamente con Supabase ni con APIs externas de IA.
> Todo pasa por el **backend propio** (Next.js API Routes o Express).

```
App React Native
  │
  │  fetch / TanStack Query
  ▼
Backend propio (API Routes)          ← única puerta de entrada
  │
  ├──▶  Supabase (Auth + PostgreSQL)
  └──▶  OpenRouter / Claude API
```

### Patrón de capas en el cliente mobile

```
screen/               → solo composición visual, sin lógica
hooks/                → lógica de estado, efectos, queries
api/                  → llamadas HTTP al backend
lib/                  → configuraciones (query client, axios, storage)
types/                → tipos e interfaces
```

---

## 3. Estructura de Carpetas

Arquitectura **feature-first**. Cada funcionalidad vive en su propia carpeta.

```
src/
├── app/                          # Expo Router — solo rutas y layouts
│   ├── (student)/                # Grupo de rutas del estudiante
│   │   ├── _layout.tsx           # Tab navigator o stack
│   │   ├── dashboard.tsx         # max 80 líneas — solo composición
│   │   ├── practice.tsx
│   │   └── simulation.tsx
│   ├── (admin)/                  # Portal admin (si aplica en mobile)
│   │   └── _layout.tsx
│   ├── _layout.tsx               # Root layout — providers globales
│   └── index.tsx                 # Pantalla de entrada / splash
│
├── features/                     # Lógica de negocio por funcionalidad
│   ├── [feature]/
│   │   ├── components/           # JSX puro — sin lógica
│   │   ├── hooks/                # useState, useEffect, TanStack Query
│   │   ├── api/                  # Llamadas HTTP al backend
│   │   ├── types/                # Tipos e interfaces (.types.ts)
│   │   └── utils/                # Funciones puras
│
├── components/                   # UI reutilizable sin lógica de negocio
│   ├── ui/                       # Button, Input, Card, Badge, Modal
│   └── layout/                   # Header, TabBar, SafeAreaWrapper
│
├── lib/                          # Configuraciones e instancias
│   ├── axios.ts                  # Instancia HTTP base
│   ├── query-client.ts           # TanStack Query config
│   ├── storage.ts                # AsyncStorage / MMKV helpers
│   └── zod-schemas/              # Schemas de validación globales
│
├── context/                      # Contextos globales
│   └── AuthContext/
│       ├── AuthContext.tsx
│       ├── authReducer.ts
│       └── auth.types.ts
│
├── hooks/                        # Custom hooks globales
│   ├── useAsyncStorage.ts
│   └── useDebounce.ts
│
├── types/                        # Tipos globales
│   ├── api.types.ts
│   ├── exam.types.ts
│   └── user.types.ts
│
├── constants/                    # Valores constantes
│   ├── exams.ts
│   └── theme.ts                  # Design tokens — colores, espaciados, tipografía
│
└── utils/                        # Utilidades puras
    ├── formatters.ts
    └── validators.ts
```

---

## 4. Reglas de Código

### 4.1 Límite de líneas

- **Máximo 400 líneas** por archivo. Si se supera → dividir.
- Archivos de pantalla en `app/` máximo **80 líneas** — solo composición, nunca lógica.

### 4.2 Separación de responsabilidades

```
components/  → solo JSX + props (View, Text, TouchableOpacity)
hooks/       → toda la lógica de estado y efectos
api/         → llamadas HTTP al backend
types/       → todos los tipos e interfaces
```

**✅ Correcto:**
```tsx
// ExerciseCard.tsx — solo JSX
import { View, Text, TouchableOpacity } from 'react-native'
import { styles } from './ExerciseCard.styles'

export const ExerciseCard = ({ exercise, onAnswer }: ExerciseCardProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.question}>{exercise.question}</Text>
      <TouchableOpacity style={styles.button} onPress={() => onAnswer(exercise.id)}>
        <Text style={styles.buttonText}>Responder</Text>
      </TouchableOpacity>
    </View>
  )
}
```

```ts
// useExerciseSession.ts — lógica
export const useExerciseSession = (sessionId: string) => {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const handleAnswer = (id: string, value: string) =>
    setAnswers(prev => ({ ...prev, [id]: value }))
  return { answers, handleAnswer }
}
```

**❌ Incorrecto:**
```tsx
// ExerciseCard.tsx — NO hacer esto
export const ExerciseCard = () => {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('https://api.example.com/exercise').then(...) }, [])
  return <View style={{ backgroundColor: 'red', padding: 16 }}>...</View>
}
```

### 4.3 Types e interfaces

- **Nunca** declarar `type` o `interface` dentro de componentes o hooks.
- Siempre en archivos `.types.ts` en la carpeta `types/` de su feature.

```ts
// ✅ features/practice/types/practice.types.ts
export interface Exercise {
  id: string
  level: string
  content: CTestContent | MCQContent
}

export type ExerciseStatus = 'pending_review' | 'approved' | 'discarded'
```

### 4.4 Estilos — React Native

React Native **no usa CSS**. Los estilos son objetos JavaScript con propiedades camelCase y números sin unidad.

**Reglas:**
- Siempre usar `StyleSheet.create` — nunca objetos inline en el JSX.
- Extraer los estilos a un archivo separado `[Component].styles.ts`.
- Los valores de color, espaciado y tipografía vienen de `constants/theme.ts`.
- No usar `px`, `em`, `rem` ni ninguna unidad CSS.

```ts
// ✅ constants/theme.ts — design tokens
export const colors = {
  primary: '#7C3AED',
  primaryLight: '#EDE9FE',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  background: '#FFFFFF',
  error: '#EF4444',
  success: '#10B981',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const fontSize = {
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  h2: 24,
  h1: 30,
} as const
```

```ts
// ✅ ExerciseCard.styles.ts — estilos separados
import { StyleSheet } from 'react-native'
import { colors, spacing, fontSize } from '@/constants/theme'

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,                    // Android shadow
  },
  question: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
})
```

```tsx
// ✅ ExerciseCard.tsx — usa los estilos importados
import { styles } from './ExerciseCard.styles'

export const ExerciseCard = ({ exercise, onAnswer }: ExerciseCardProps) => (
  <View style={styles.container}>
    <Text style={styles.question}>{exercise.question}</Text>
    <TouchableOpacity style={styles.button} onPress={() => onAnswer(exercise.id)}>
      <Text style={styles.buttonText}>Responder</Text>
    </TouchableOpacity>
  </View>
)
```

**❌ Incorrecto:**
```tsx
// Inline styles — NO hacer esto
<View style={{ padding: 16, backgroundColor: '#7C3AED', borderRadius: 12 }}>
```

### 4.5 Componentes

- Un componente por archivo.
- Nombre en PascalCase: `ExerciseCard.tsx`.
- Props siempre tipadas en su archivo `.types.ts`.
- Preferir componentes pequeños y composables.
- Usar siempre componentes nativos de React Native (`View`, `Text`, `ScrollView`, `FlatList`) — nunca `div`, `span`, `p`.

### 4.6 Custom Hooks

- Extraer cualquier lógica con `useState` + `useEffect` a un hook.
- Nombre: `use` + descripción clara: `useExerciseSession`, `useBatchJob`.
- Un hook por archivo.

### 4.7 Navegación (Expo Router)

- Las pantallas en `app/` solo componen layouts — no contienen lógica.
- Los parámetros de navegación siempre tipados.

```ts
// ✅ Tipado de parámetros de ruta
import { useLocalSearchParams } from 'expo-router'

export default function PracticeScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>()
  return <PracticeSession examId={examId} />
}
```

---

## 5. Llamadas a la API (TanStack Query)

- Llamadas HTTP → `features/[feature]/api/[feature].api.ts`
- Hooks de TanStack Query → `features/[feature]/hooks/`
- Nunca `fetch` directo dentro de un componente.

```ts
// features/practice/api/practice.api.ts
export const fetchExerciseSession = async (examId: string): Promise<ExerciseSession> => {
  const { data } = await axios.get(`/sessions/${examId}`)
  return data
}

// features/practice/hooks/useExerciseSession.ts
export const useExerciseSession = (examId: string) => {
  return useQuery({
    queryKey: ['exercise-session', examId],
    queryFn: () => fetchExerciseSession(examId),
    staleTime: 1000 * 60 * 5,
  })
}
```

---

## 6. Estado Global (React Context + useReducer)

- Context solo para estado verdaderamente global: sesión de usuario, tema, examen activo.
- **No** usar Context para estado de una sola pantalla — usar estado local o TanStack Query.

```
context/AuthContext/
├── AuthContext.tsx    # createContext + Provider
├── authReducer.ts     # Reducer puro — sin side effects
└── auth.types.ts      # AuthState, AuthAction
```

---

## 7. Almacenamiento Local

- **AsyncStorage** para datos simples y poco frecuentes (preferencias, onboarding completado).
- **MMKV** para datos que se leen frecuentemente (tokens, configuración de sesión) — es ~30x más rápido.
- Nunca guardar directamente — siempre a través de helpers en `lib/storage.ts`.

```ts
// lib/storage.ts
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV()

export const setItem = (key: string, value: string) => storage.set(key, value)
export const getItem = (key: string) => storage.getString(key) ?? null
export const removeItem = (key: string) => storage.delete(key)
```

---

## 8. Formularios (React Hook Form + Zod)

- Schema Zod siempre en `types/` de la feature.
- Usar `Controller` de React Hook Form para integrar con componentes nativos de React Native.

```ts
// features/auth/types/auth.schemas.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>
```

---

## 9. Imports

- Siempre con alias `@/` — nunca rutas relativas de más de 1 nivel.

```ts
// ✅
import { ExerciseCard } from '@/features/practice/components/ExerciseCard'

// ❌
import { ExerciseCard } from '../../../features/practice/components/ExerciseCard'
```

Configuración en `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## 10. Variables de Entorno

En Expo, las variables de entorno se manejan con `expo-constants` y `app.config.ts`:

```ts
// app.config.ts
export default {
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  }
}
```

```bash
# .env.example
EXPO_PUBLIC_API_URL=http://localhost:3000/api   # Expuesta al cliente — solo URLs públicas
```

- Las variables con prefijo `EXPO_PUBLIC_` llegan al bundle — nunca poner secrets ahí.
- Los secrets (API keys de IA, Supabase service role) viven solo en el backend — nunca en el app.

---

## 11. Conventional Commits

Formato: `tipo(scope): descripción en minúsculas`

| Tipo | Cuándo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Refactor sin cambio de comportamiento |
| `chore` | Dependencias, configuración |
| `style` | Estilos — sin lógica |
| `docs` | Documentación |
| `test` | Tests |

```bash
# ✅
refactor(practice): extract answer logic into useExerciseSession hook
refactor(ui): move ExerciseCard styles to ExerciseCard.styles.ts
style(theme): replace magic color values with theme tokens in PracticeScreen
chore(deps): upgrade tanstack-query to v5.20.0

# ❌
git commit -m "fix stuff"
git commit -m "WIP"
```

---

## 12. ESLint + Prettier

```json
// .eslintrc
{
  "extends": ["expo", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "import/order": ["error", { "groups": ["builtin", "external", "internal"] }]
  }
}
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 13. Checklist de Refactorización

Antes de marcar un refactor como completo, verificar:

**Estructura:**
- [ ] El archivo refactorizado no supera 400 líneas
- [ ] Las pantallas en `app/` tienen menos de 80 líneas
- [ ] Cada archivo tiene una sola responsabilidad

**Tipos:**
- [ ] No hay `type` ni `interface` dentro de componentes o hooks
- [ ] No hay uso de `any` en TypeScript
- [ ] Los parámetros de navegación están tipados

**Estilos:**
- [ ] No hay objetos de estilo inline en el JSX
- [ ] Los estilos están en archivos `.styles.ts` separados con `StyleSheet.create`
- [ ] Los colores, espaciados y tipografía usan tokens de `constants/theme.ts`
- [ ] No hay unidades CSS (`px`, `em`, `rem`) — solo números

**Lógica:**
- [ ] La lógica está en hooks, no en componentes
- [ ] Las llamadas HTTP están en archivos `.api.ts`
- [ ] El componente no llama directamente a Supabase ni a APIs externas

**Seguridad:**
- [ ] No hay secrets ni API keys en el código del app
- [ ] Las variables de entorno sensibles no tienen prefijo `EXPO_PUBLIC_`

**Git:**
- [ ] El commit sigue Conventional Commits con tipo `refactor`
- [ ] No hay `console.log` sin justificación
- [ ] El código compila sin errores de TypeScript
- [ ] Verificado en iOS y Android (si hay emuladores disponibles)