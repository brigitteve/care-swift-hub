# Plan: PatientSOS v2 — Dashboard inteligente + Roles + Gamificación

Construcción incremental sobre el prototipo existente. Mantengo mobile-first, dark mode, botones ≥48px y safe-area iOS.

## 1. Base de datos (migración única)

Añadir a las tablas existentes sin romper datos:

- **`user_roles`** (tabla nueva + enum `app_role`: `nurse`, `supervisor`, `admin`) con función `has_role(uuid, app_role)` SECURITY DEFINER — evita recursión en RLS.
- **`patients`**: añadir `assigned_to uuid` (enfermera asignada, puede diferir de `user_id` que pasa a ser "creador/supervisor").
- **`shifts`**: añadir `assigned_nurse_id uuid` opcional, `total_checklist`, `done_checklist` (cacheable vía trigger).
- **`alerts`**: añadir `seen boolean default false`, `priority_score int`.
- **`supplies`**: añadir `stock int`, `min_stock int` para alerta de stock bajo.
- **`achievements`** (nueva): registro de logros del turno (`critical_resolved`, `checklist_100`, etc.) para confetti/KPIs.
- RLS actualizada: enfermera ve solo sus pacientes asignados; supervisora ve todo su turno; admin ve todo. Usando `has_role()`.

## 2. Dashboard interactivo (`/board`)

- **Header KPIs**: % checklist completado del turno, pacientes críticos activos, alertas sin ver — con barras de progreso animadas.
- **Tarjetas de paciente enriquecidas**:
  - Mini sparkline (SVG inline, sin librerías) de últimos 6 valores de SpO₂ o HR.
  - Badge de carga de trabajo de la enfermera asignada.
  - Swipe-actions (left = marcar visto, right = resolver) usando gestos táctiles nativos.
- **Filtros rápidos**: "Mis pacientes" / "Todos" (visible solo supervisora).

## 3. Alertas multicriterio + visuales

- Función `compute_alert_priority(vital, minutos_sin_atencion)` en cliente: combina severidad de signos + tiempo. Score 0–100.
- Hoja de alertas (`AlertsSheet`) ordenada por score, con código de color (crítico/urgente/info) y swipe.
- **Notificaciones push web** (Notification API) — pide permiso al entrar al turno, dispara en alertas con score ≥80. Sin service worker complejo (solo `new Notification()` mientras la pestaña esté abierta o instalada como PWA).
- Vibración háptica (`navigator.vibrate`) al recibir alerta crítica.

## 4. Gamificación

- **Barra de progreso del turno** en header con %.
- **Confetti** (componente CSS puro, sin libs) al completar 100% del checklist de un paciente crítico.
- `navigator.vibrate([50,30,50])` en check de tarea crítica.
- Vista "Mi turno": logros desbloqueados, pacientes atendidos, tiempo medio de respuesta.

## 5. Asignación de turnos y pacientes (rol supervisora)

- Nueva ruta `/_authenticated/supervisor` (gate con `has_role('supervisor')`).
- Lista de enfermeras activas + drag/tap para asignar paciente → enfermera.
- Al reasignar, recálculo automático de prioridad y notificación realtime a la enfermera receptora.

## 6. Insumos con stock bajo

- En `SuppliesTab`: badge rojo si `stock <= min_stock`.
- Alerta automática a supervisora cuando stock crítico.

## 7. Roles y seguridad

- Login sin cambios. Tras login, si no hay rol → asignar `nurse` por defecto.
- UI condicional: panel supervisora oculto a enfermeras.
- RLS reforzada con `has_role()`.

## Detalles técnicos

```
src/
  lib/
    alerts.ts           // compute_alert_priority, push notifications
    confetti.tsx        // componente CSS confetti
    haptics.ts          // wrapper navigator.vibrate
    roles.ts            // hook useRole()
  components/
    Sparkline.tsx       // SVG mini gráfica
    KpiHeader.tsx       // KPIs del turno
    SwipeablePatientCard.tsx
    AssignNurseDialog.tsx
  routes/_authenticated/
    supervisor.tsx      // panel supervisora
    my-shift.tsx        // KPIs personales / logros
  hooks/
    useRole.ts
    useShiftKpis.ts
    usePushNotifications.ts
```

Cambios en archivos existentes: `PatientCard.tsx`, `AlertsSheet.tsx`, `AppHeader.tsx`, `board.tsx`, `SuppliesTab.tsx`, `ChecklistTab.tsx`, `seed.ts` (añadir datos demo de roles, stock, achievements).

## Entregables

1. Migración SQL única (roles + columnas + triggers + RLS).
2. ~12 archivos nuevos / 8 modificados.
3. Demo data actualizado con 1 supervisora + 2 enfermeras + insumos bajos.

¿Apruebo y procedo con la migración + implementación, o quieres que recorte alguna sección (p.ej. saltar push notifications, o dejar gamificación para v3)?
