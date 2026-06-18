# búsqueda por input — norte

Prototipo mobile (HTML/CSS/JS vanilla, sin framework) para explorar direcciones norte-estrella
de la caja de búsqueda de Despegar a partir del flujo "buscar por input".

## Cómo verlo

Abrí `index.html` en el navegador, o entrá a la versión publicada en **GitHub Pages**.

El teléfono aparece centrado con un **panel de control abajo a la derecha** (engranaje) para
alternar:

- **Tipo de usuario** (nuevo / recurrente) — cambia la rama "Voos".
- **Resultado al elegir "Paris"** — Opción 1 (1A search · 1B landing actual · 1B landing nueva),
  Opción 2 (caja de búsqueda) u Opción 3 (landing multiproducto).

### Flujo

`Home` → tocar el **input** → escribir → sugerencias filtradas → elegir **Paris** → resultado
(según el panel). También: `Home` → **Voos** → caja de vuelos (nuevo / recurrente). La burbuja
**SOFIA** del nav abre un chat de ejemplo.

### Deep-links útiles (para demos)

`?go=home|voos|search|result|sofia`, `&q=<texto>`, `&panel=0`, y offsets de scroll
`&hs=` / `&ss=` / `&rs=`.

## Estructura

`index.html` · `styles.css` · `app.js` · `images/` (recortes extraídos del diseño).
