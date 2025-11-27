# App Tincadia

Aplicación móvil de Tincadia construida con React Native y Expo. Plataforma de tecnología inclusiva que conecta a personas sordas, oyentes y organizaciones mediante soluciones accesibles, inteligencia artificial y herramientas de comunicación.

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (versión 18 o superior)
- [Bun](https://bun.sh/) (gestor de paquetes recomendado)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (opcional, se instala automáticamente)

## Instalación

1. Clona el repositorio:
```bash
git clone <url-del-repositorio>
cd app-tincadia
```

2. Instala las dependencias:
```bash
bun install
```

## Ejecutar el Proyecto

### Modo Desarrollo

Para ejecutar el servidor de desarrollo:

```bash
bun start
```

Luego puedes:
- Presionar `a` para abrir en Android
- Presionar `i` para abrir en iOS (requiere macOS)
- Presionar `w` para abrir en web
- Escanear el código QR con la app Expo Go en tu dispositivo móvil

### Ejecutar en Plataformas Específicas

```bash
# Android
bun run android

# iOS (requiere macOS)
bun run ios

# Web
bun run web
```

### Linting

Para ejecutar el linter y verificar el código:

```bash
bun run lint
```

### Type Checking

Para verificar los tipos de TypeScript:

```bash
bun run type-check
```

## Scripts Disponibles

- `bun start` - Inicia el servidor de desarrollo de Expo
- `bun run android` - Inicia la app en Android
- `bun run ios` - Inicia la app en iOS (requiere macOS)
- `bun run web` - Inicia la app en el navegador web
- `bun run lint` - Ejecuta el linter para verificar el código
- `bun run type-check` - Verifica los tipos de TypeScript

## Estructura del Proyecto

```
app-tincadia/
├── src/
│   ├── app/           # Componente principal de la aplicación
│   ├── components/    # Componentes reutilizables
│   ├── contexts/      # Contextos de React (i18n, etc.)
│   ├── features/     # Funcionalidades específicas
│   ├── hooks/         # Hooks personalizados
│   ├── lib/           # Utilidades y helpers
│   ├── locales/       # Archivos de traducción (i18n)
│   └── types/         # Tipos de TypeScript
├── assets/            # Imágenes, fuentes, etc.
├── app.json           # Configuración de Expo
├── babel.config.js    # Configuración de Babel
├── tsconfig.json      # Configuración de TypeScript
└── package.json       # Dependencias y scripts
```

## Tecnologías Utilizadas

- **Expo** - Framework para desarrollo de aplicaciones React Native
- **React Native** - Framework para construir aplicaciones móviles nativas
- **TypeScript** - Superset tipado de JavaScript
- **Bun** - Gestor de paquetes rápido
- **ESLint** - Linter para mantener calidad de código
- **AsyncStorage** - Almacenamiento local para React Native

## Características

### Internacionalización (i18n)

El proyecto incluye soporte para múltiples idiomas (español, inglés, portugués) mediante el contexto `I18nProvider`. El idioma seleccionado se guarda automáticamente en AsyncStorage.

**Uso:**
```typescript
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t, locale, setLocale } = useTranslation();
  
  return (
    <Text>{t('common.loading')}</Text>
  );
}
```

### Path Aliases

El proyecto usa path aliases para importaciones más limpias:

```typescript
// En lugar de:
import { useTranslation } from '../../../hooks/useTranslation';

// Puedes usar:
import { useTranslation } from '@/hooks/useTranslation';
```

### Utilidades

El proyecto incluye utilidades comunes en `src/lib/utils.ts`:
- `combineStyles()` - Combina estilos de React Native
- `formatCurrency()` - Formatea números como moneda colombiana
- `isValidEmail()` - Valida formato de email
- `isValidPhone()` - Valida formato de teléfono colombiano
- `truncateText()` - Trunca texto a una longitud máxima

## Buenas Prácticas

Este proyecto sigue las mismas buenas prácticas implementadas en `tincadia-frontend`:

- ✅ TypeScript con configuración estricta
- ✅ ESLint configurado
- ✅ Estructura de carpetas organizada
- ✅ Path aliases para imports
- ✅ Internacionalización (i18n)
- ✅ Hooks personalizados
- ✅ Tipos TypeScript bien definidos

## Desarrollo

### Agregar Nuevas Traducciones

1. Edita los archivos en `src/locales/` (es.json, en.json, pt.json)
2. Usa la notación de punto para estructuras anidadas:
```json
{
  "miSeccion": {
    "miClave": "Mi traducción"
  }
}
```

3. Usa las traducciones en tu código:
```typescript
const { t } = useTranslation();
const text = t('miSeccion.miClave');
```

### Crear Nuevos Componentes

Los componentes deben ir en `src/components/` y seguir la convención de nombres en PascalCase.

### Crear Nuevos Hooks

Los hooks personalizados deben ir en `src/hooks/` y seguir la convención de nombres en camelCase con prefijo `use`.

## Learn More

Para aprender más sobre las tecnologías utilizadas:

- [Expo Documentation](https://docs.expo.dev/) - Documentación oficial de Expo
- [React Native Documentation](https://reactnative.dev/) - Documentación oficial de React Native
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) - Documentación oficial de TypeScript

## Licencia

Este proyecto es privado y propiedad de Tincadia.

