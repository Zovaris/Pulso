# Soffy

## Visión

Soffy será una aplicación local de menubar para administrar comandos de proyectos. Permitirá agregar una carpeta, detectar automáticamente los comandos disponibles, ejecutarlos con un clic y consultar su estado, logs y puertos expuestos.

La primera versión estará enfocada en macOS, pero el núcleo se diseñará con adaptadores de plataforma para permitir una futura migración a Windows y Linux.

## Principios del producto

- Local y personal: sin cuentas, equipos ni sincronización en el MVP.
- Rápido de consultar: las acciones habituales deben caber en el popover del menubar.
- Seguro y predecible: Soffy solo administra procesos iniciados por Soffy.
- Extensible: cada ecosistema de comandos se implementa como un detector independiente.
- Transparente: siempre debe quedar claro qué comando corre, en qué carpeta, con qué estado y en qué puerto.

## Stack recomendado

- Tauri 2 para la aplicación desktop, system tray, ventanas y empaquetado.
- Rust para detección, ejecución y supervisión de procesos, logs, sockets y persistencia.
- Preact con TypeScript para la interfaz.
- Vite para el entorno de desarrollo del frontend.
- SQLite para proyectos, comandos personalizados, configuración e historial reciente.
- SQLx para acceder a SQLite desde Rust con migraciones explícitas.
- Zustand o señales de Preact para estado efímero de la interfaz; no añadir un framework de estado mayor hasta necesitarlo.
- Vitest para lógica TypeScript y pruebas de componentes.
- Pruebas unitarias e integración de Rust para detectores y procesos.

La ejecución de comandos dinámicos debe vivir en el backend Rust. El frontend solicita acciones mediante comandos Tauri tipados, pero nunca recibe una API de shell irrestricta.

## Alcance del MVP

El primer entregable debe permitir:

1. Ejecutar Soffy únicamente desde el menubar de macOS.
2. Agregar una carpeta de proyecto mediante un selector nativo.
3. Detectar los scripts de `package.json`.
4. Agregar, editar y eliminar comandos personalizados.
5. Iniciar, reiniciar y detener un comando.
6. Mostrar `stdout` y `stderr` en tiempo real.
7. Detectar uno o varios puertos abiertos por el proceso o sus hijos.
8. Abrir una URL detectada en el navegador.
9. Mantener los procesos activos cuando se oculta el popover.
10. Detener todos los procesos administrados al seleccionar **Quit Soffy**.
11. Conservar proyectos, favoritos y configuración entre sesiones.

## Fuera del MVP

- Cuentas, equipos o sincronización en la nube.
- Ejecución remota, SSH o contenedores remotos.
- Terminal interactiva completa.
- Marketplace de detectores o plugins de terceros.
- Automatizaciones por horario.
- Soporte oficial para Windows y Linux.
- Historial ilimitado de logs.

## Experiencia principal

### Popover del menubar

- Encabezado con el número de procesos activos.
- Buscador cuando exista suficiente contenido para justificarlo.
- Proyectos en una lista compacta y plegable.
- Comandos favoritos visibles directamente bajo cada proyecto.
- Acción Play, Stop o Restart según el estado.
- Indicador de estado y tiempo de ejecución.
- Puerto confirmado o inferido, con acción para abrirlo.
- Acceso a todos los comandos y a los logs.
- Pie con **Add Project**, **Settings** y **Quit Soffy**.

### Vista de ejecución

- Proyecto, comando real y directorio de trabajo.
- Estado: `stopped`, `starting`, `running`, `stopping`, `exited` o `failed`.
- Duración y código de salida.
- Puertos detectados y nivel de certeza.
- Logs combinados, diferenciando `stdout` y `stderr` sin perjudicar la lectura.
- Autoscroll que se pausa si el usuario se desplaza hacia arriba.
- Búsqueda, limpiar vista y copiar logs.
- Acciones para abrir URL, reiniciar y detener.

Los logs extensos se mostrarán en una ventana secundaria. El popover ofrecerá un resumen y las acciones rápidas.

## Detección de comandos

Cada detector implementará un contrato común:

```rust
trait CommandDetector {
    fn id(&self) -> &'static str;
    fn detect(&self, project: &ProjectPath) -> Result<Vec<DetectedCommand>>;
}
```

Un comando detectado debe contener, como mínimo:

- Identificador estable derivado del detector y su origen.
- Nombre visible.
- Programa y argumentos, separados cuando sea posible.
- Directorio de trabajo.
- Archivo de origen.
- Categoría opcional: dev, build, test, lint, database, infrastructure u other.
- Indicación de si probablemente será un proceso persistente.

Orden sugerido de detectores:

1. `package.json`.
2. `Makefile`.
3. `justfile`.
4. `Taskfile.yml`.
5. `Cargo.toml`.
6. `compose.yml` y `docker-compose.yml`.
7. `pyproject.toml`.

Los resultados automáticos no se almacenarán como copias definitivas. Se vuelven a derivar del proyecto y se combinan con preferencias locales como alias, favorito, oculto o variables de entorno.

## Ejecución y ciclo de vida

El backend mantendrá un `ProcessSupervisor` como única autoridad sobre los procesos iniciados por Soffy.

Por cada ejecución registrará:

- ID interno de ejecución.
- PID principal.
- Grupo de procesos.
- Proyecto y comando.
- Hora de inicio.
- Estado actual.
- Buffer circular de logs.
- Puertos detectados.

Secuencia normal de detención:

1. Enviar `SIGINT` al grupo de procesos.
2. Esperar un intervalo configurable corto.
3. Enviar `SIGTERM` si continúa activo.
4. Esperar nuevamente.
5. Usar `SIGKILL` como último recurso.

Ocultar o cerrar el popover no detiene procesos. **Quit Soffy** ejecuta la secuencia de apagado para todos los grupos antes de finalizar la aplicación.

Un cierre forzado con `SIGKILL` no permite ejecutar limpieza dentro de la app. El MVP guardará PID, hora de inicio y metadatos suficientes para detectar posibles sobrevivientes al siguiente arranque sin matar procesos ajenos. Una fase posterior podrá incorporar un helper supervisor que observe la conexión con la app principal y limpie inmediatamente los procesos si esta desaparece.

## Entorno de shell

Las aplicaciones gráficas de macOS no siempre reciben el mismo `PATH` que una terminal. Soffy deberá resolver explícitamente el entorno de ejecución:

- Detectar el shell configurado por el usuario.
- Cargar de forma controlada su entorno de login.
- Mostrar el entorno efectivo en diagnóstico sin revelar secretos por defecto.
- Permitir variables globales, por proyecto y por comando.
- Guardar secretos mediante Keychain en una fase posterior, no como texto plano en SQLite.

El modelo de datos debe mantener programa y argumentos separados. Los comandos que realmente dependan de sintaxis de shell se marcarán explícitamente como tales.

## Logs

- Leer `stdout` y `stderr` de manera asíncrona.
- Emitir eventos incrementales al frontend.
- Conservar secuencia, stream de origen y timestamp monotónico.
- Interpretar ANSI para visualización, conservando también texto limpio para búsqueda.
- Utilizar buffers circulares con límites por líneas y bytes.
- No persistir logs completos en el MVP; solo metadatos y un resumen de la última ejecución si resulta útil.
- Aplicar backpressure o agrupación de eventos para evitar bloquear la UI con procesos muy verbosos.

## Detección de puertos

La detección combinará:

1. Patrones en logs para URLs, hosts y mensajes de escucha.
2. Inspección de sockets TCP en escucha pertenecientes al proceso y sus descendientes.

Cada resultado tendrá una fuente y confianza:

- `confirmed`: socket observado en el sistema.
- `inferred`: encontrado únicamente en logs.

Antes de mostrar un puerto como confirmado se comprobará que pertenezca al árbol de procesos de la ejecución. La interfaz debe soportar múltiples puertos y no asumir que todos usan HTTP.

La implementación macOS puede apoyarse inicialmente en información del sistema disponible mediante `lsof`, detrás de un trait `PortInspector`. Otros sistemas operativos tendrán implementaciones separadas.

## Persistencia

Entidades iniciales:

- `projects`: ruta canónica, nombre, fecha de alta y orden.
- `custom_commands`: programa, argumentos, shell opcional y directorio.
- `command_preferences`: alias, favorito, oculto y orden para comandos detectados.
- `environment_variables`: alcance y referencia segura del valor cuando corresponda.
- `run_history`: inicio, fin, resultado y puertos, con retención limitada.
- `settings`: preferencias de aplicación.

No se debe asumir que una ruta identifica permanentemente el mismo proyecto. Se guardará la ruta canónica y se manejarán carpetas movidas, enlaces simbólicos y proyectos eliminados.

## Arquitectura de carpetas propuesta

```text
Soffy/
├── plan.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.ts
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   └── shared/
│   ├── features/
│   │   ├── projects/
│   │   ├── commands/
│   │   ├── processes/
│   │   ├── logs/
│   │   ├── ports/
│   │   └── settings/
│   ├── lib/
│   │   ├── tauri.ts
│   │   ├── events.ts
│   │   └── types.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   └── globals.css
│   └── main.tsx
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── icons/
│   ├── migrations/
│   └── src/
│       ├── lib.rs
│       ├── main.rs
│       ├── app/
│       │   ├── lifecycle.rs
│       │   ├── tray.rs
│       │   └── windows.rs
│       ├── commands/
│       │   ├── projects.rs
│       │   ├── executions.rs
│       │   └── settings.rs
│       ├── domain/
│       │   ├── project.rs
│       │   ├── command.rs
│       │   ├── execution.rs
│       │   └── port.rs
│       ├── detectors/
│       │   ├── mod.rs
│       │   ├── package_json.rs
│       │   ├── makefile.rs
│       │   ├── justfile.rs
│       │   ├── taskfile.rs
│       │   ├── cargo.rs
│       │   └── compose.rs
│       ├── process/
│       │   ├── supervisor.rs
│       │   ├── runner.rs
│       │   ├── signals.rs
│       │   └── log_buffer.rs
│       ├── platform/
│       │   ├── mod.rs
│       │   └── macos/
│       │       ├── environment.rs
│       │       ├── process_tree.rs
│       │       └── ports.rs
│       ├── persistence/
│       │   ├── database.rs
│       │   └── repositories/
│       └── support/
│           ├── error.rs
│           └── paths.rs
├── tests/
│   ├── fixtures/
│   │   ├── node-project/
│   │   ├── make-project/
│   │   └── multi-tool-project/
│   └── e2e/
└── docs/
    ├── architecture.md
    └── decisions/
```

Esta estructura es el destino previsto, no contenido que deba crearse desde el primer commit. Se añadirán directorios conforme cada fase los necesite.

## Límites entre capas

- `domain`: modelos y reglas sin dependencias de Tauri, SQL ni UI.
- `detectors`: lectura de manifiestos y conversión a modelos del dominio.
- `process`: ejecución, señales, logs y supervisión.
- `platform`: detalles específicos de cada sistema operativo.
- `persistence`: SQLite y repositorios.
- `commands`: frontera fina entre frontend y backend; valida entradas y delega.
- `features`: UI organizada por capacidad, no por tipo genérico de archivo.

La UI nunca debe administrar PIDs directamente. La persistencia tampoco inicia procesos. Los detectores no deben conocer componentes visuales ni la base de datos.

## Contrato frontend-backend inicial

Comandos Tauri previstos:

- `add_project(path)`
- `list_projects()`
- `remove_project(project_id)`
- `rescan_project(project_id)`
- `list_commands(project_id)`
- `start_command(command_id, overrides)`
- `stop_execution(execution_id)`
- `restart_execution(execution_id)`
- `list_executions()`
- `get_log_snapshot(execution_id)`
- `open_detected_url(execution_id, port_id)`
- `quit_soffy()`

Eventos emitidos por Rust:

- `execution://state-changed`
- `execution://log-appended`
- `execution://ports-changed`
- `project://commands-changed`

Los payloads se definirán en Rust y se reflejarán como tipos TypeScript. Deben incluir versión o ser compatibles de manera aditiva para evitar romper el frontend accidentalmente.

## Fases de implementación

### Fase 0: decisiones y esqueleto

- Crear el proyecto Tauri 2 con Preact y TypeScript.
- Configurar menubar, popover y ventana secundaria.
- Establecer formato, lint, pruebas y CI.
- Añadir modelos de dominio y estrategia de errores.
- Escribir decisiones técnicas breves para procesos y persistencia.

### Fase 1: proyectos y detección Node

- Agregar y eliminar carpetas.
- Canonicalizar y validar rutas.
- Implementar detector de `package.json` con fixtures.
- Mostrar proyectos y comandos detectados.
- Añadir comandos personalizados básicos.

### Fase 2: ejecución y logs

- Implementar `ProcessSupervisor`.
- Crear grupos de procesos en macOS.
- Capturar logs en streaming.
- Implementar Play, Stop y Restart.
- Añadir apagado ordenado mediante **Quit Soffy**.

### Fase 3: puertos y experiencia diaria

- Detectar URLs desde logs.
- Confirmar sockets del árbol de procesos.
- Abrir URLs en el navegador.
- Añadir favoritos, orden y ventana de logs.
- Manejar estados vacíos, errores y proyectos no disponibles.

### Fase 4: detectores adicionales

- Makefile.
- Just.
- Taskfile.
- Cargo.
- Docker Compose.
- Reescaneo al cambiar manifiestos.

### Fase 5: robustez y distribución

- Detectar sobrevivientes después de cierres abruptos.
- Rotación y límites de logs.
- Notificaciones de fallos.
- Inicio con macOS opcional.
- Firma, notarización, actualizaciones y paquetes de distribución.

### Fase 6: preparación multiplataforma

- Implementar adaptadores Windows y Linux para procesos, señales y puertos.
- Adaptar tray y ventanas a convenciones de cada plataforma.
- Crear pruebas por plataforma.
- Revisar la carga del entorno de shell en cada sistema.

## Riesgos que deben resolverse temprano

- Las apps GUI de macOS reciben un entorno distinto al terminal del usuario.
- Detener solo el PID principal puede dejar servidores o workers huérfanos.
- Algunos scripts lanzan procesos que se desacoplan deliberadamente.
- Los logs extremadamente rápidos pueden saturar el canal hacia la UI.
- Un puerto encontrado en texto no garantiza que siga disponible.
- Los targets de Make pueden ser generados, privados o tener efectos destructivos.
- Ejecutar comandos arbitrarios exige una frontera estricta entre datos mostrados y acciones autorizadas.
- Matar la app con `SIGKILL` impide su limpieza normal.

## Criterios de aceptación del MVP

- Al agregar un proyecto Node, sus scripts aparecen sin configuración manual.
- Un comando puede iniciarse con un clic y sus logs aparecen progresivamente.
- Ocultar el popover no interrumpe el comando.
- Soffy distingue procesos activos, terminados y fallidos.
- Un servidor local muestra al menos un puerto confirmado o una URL inferida.
- Stop termina el árbol de procesos sin dejar hijos conocidos.
- Quit Soffy intenta detener todas las ejecuciones antes de salir.
- Al reiniciar Soffy, los proyectos y preferencias siguen disponibles.
- Un manifiesto inválido o un comando fallido produce un error útil sin cerrar la app.
- El popover continúa siendo ágil con varios proyectos y logs activos.

## Primera meta de desarrollo

Construir un corte vertical completo:

> Agregar un proyecto Node, detectar sus scripts, ejecutar uno, ver sus logs y puerto, detenerlo y salir de Soffy sin dejar procesos administrados activos.

No comenzar los detectores adicionales hasta que este flujo esté probado de extremo a extremo.
