# Report Spec — Growth Analytics FinDemo

## Report identity
- Report name: Growth Analytics FinDemo
- Semantic model: FinDemoGrowth (nuevo, local, importa los CSV de `data/marts/`)
- Audience: reclutadores y líderes de marketing/growth de una fintech (lectura ejecutiva) y analistas (exploración por canal y cohorte)
- Primary purpose: mostrar en un tablero cómo se distribuye la inversión, qué canales generan clientes rentables, dónde se pierde el embudo y qué decisiones tomar
- Delivery target: PBIP local en `powerbi/`, versionado en git. Sin publicación en Fabric.

## Semantic model binding
- Entry mode: Local Model (se crea antes del reporte; hoy no existe ningún modelo)
- Model name: FinDemoGrowth
- connectionString: byPath `../FinDemoGrowth.SemanticModel`

## User decisions and constraints
- Scope: 6 páginas sobre los 13 marts existentes
- Page count: 6
- Interactivity: pestañas nativas de Power BI para la navegación (sin navegador custom); slicers por página; interacciones cruzadas por defecto (filtrar)
- Design direction: fintech sobria, fondo claro, un acento por medida, títulos que afirman el hallazgo
- Publishing: no
- Tooling: Power BI Desktop instalado en `C:\Program Files\Microsoft Power BI Desktop`; modelo en TMDL escrito a mano/MCP local; reporte PBIR
- Model edit permissions: total (modelo nuevo)
- Accessibility: contraste WCAG AA, alt text en cada visual, nada codificado solo por rojo/verde
- Data caveats: datos sintéticos; Power Query lee los CSV desde un parámetro `RutaMarts` (ruta absoluta que cada persona ajusta al clonar)

## Narrative
- Core story: el presupuesto se reparte con último clic, que subvalora a los canales que abren journeys; Paid Search concentra la inversión y no se paga en 12 meses; Referidos es el mejor canal; la mayor fuga del embudo es el KYC.
- Audience promise: en 6 páginas se ve el qué (KPIs), el dónde (embudo), el por qué (atribución, retención) y el qué hacer (audiencias, experimentos).
- Key questions answered:
  1. ¿Cuánto invertimos, cuántos clientes activamos y a qué CAC?
  2. ¿En qué etapa del embudo se pierden más personas y en qué canal?
  3. ¿Cómo cambia el valor de cada canal según el modelo de atribución?
  4. ¿Qué canales traen clientes que se quedan?
  5. ¿A quién le hablamos ahora en pauta y CRM?
  6. ¿Qué experimentos implementar y qué tan confiables son los datos?

## Design identity
- Tone: Fintech sobria (custom): fondo gris muy claro, tarjetas blancas, texto azul marino, un color fijo por medida
- Signature: títulos de página escritos como hallazgo + franja de KPIs con contexto (variación o referencia) en cada página analítica

## Page plan
1. Resumen ejecutivo
   - Archetype: Executive Summary, variante A
   - Purpose: KPIs globales, tendencia mensual y eficiencia por canal
   - Visuals: 5 tarjetas KPI, línea mensual de activados vs inversión, barras LTV12m/CAC por canal, tabla de auditoría de canales
   - Slicers: año, tipo de canal
2. Embudo
   - Archetype: Analytical Canvas, variante B
   - Purpose: ver dónde se pierde la gente y en qué canal
   - Visuals: 4 tarjetas de tasa de paso, gráfico de embudo, barras de conversión total por canal, línea mensual de tasa de KYC y tasa de depósito
   - Slicers: año, dispositivo
3. Atribución
   - Archetype: Comparative Benchmark, variante A
   - Purpose: comparar 7 modelos y sus consecuencias en CAC
   - Visuals: barras agrupadas canal × (último clic, primer clic, Markov, Shapley), barras de % cambio Markov vs último clic, matriz canal × 7 modelos, barras CAC último clic vs CAC Markov
   - Slicers: año
4. Retención
   - Archetype: Analytical Canvas, variante A
   - Purpose: qué canales traen clientes que se quedan
   - Visuals: 5 tarjetas (retención M1, M3, M6, churn, LTV12m), matriz de cohortes con mapa de calor, curva de retención por tipo de canal, barras de churn por canal
   - Slicers: canal de primer toque
5. Segmentos y audiencias
   - Archetype: Operational Monitor, variante A
   - Purpose: convertir la segmentación en listas accionables
   - Visuals: barras de clientes por segmento RFM, barras de monto promedio 180d por segmento, tabla de audiencias con destino, objetivo y tamaño
   - Slicers: canal de primer toque
6. Experimentos y calidad de datos
   - Archetype: Operational Monitor, variante B
   - Purpose: decisión de cada A/B test y estado de los controles de calidad
   - Visuals: barras tasa A vs B por test, tabla de resultados (lift, IC, p-valor, MDE, SRM, decisión), tabla de controles de calidad con estado coloreado
   - Slicers: ninguno

## Design system summary
- Theme: base.json adaptado; fondo de página `#F4F6F9`, tarjetas `#FFFFFF`, texto `#1B2A41`, gris secundario `#5B6B82`
- Color semantics: Inversión `#3B5BA5` (azul), Activados `#0F7B6C` (verde azulado), CAC `#B85C00` (ámbar oscuro), Churn `#B42318` (rojo), Retención `#0F7B6C`, LTV/CAC `#6941C6` (violeta). Estados de calidad: OK gris azulado, Alerta ámbar, Falla rojo + texto
- Typography: Segoe UI Semibold para títulos (20 pt), Segoe UI para cuerpo (10–11 pt), números tabulares en tarjetas
- Layout: lienzo 1920 × 1080, grilla 12 × 12, margen 32, gutter 24, banda de título en la fila 1
- Accessibility: AA en todos los pares texto/fondo, alt text con titular + estructura, estados con texto además de color

## Model requirements
- Tablas (import CSV): dim_fecha, dim_canal, dim_cliente, fact_sesiones_diarias, fact_embudo_diario, fact_inversion_diaria, fact_atribucion, fact_cliente_mes, fact_retencion_cohortes, fact_audiencias, ab_resultados, calidad_datos
- Relaciones (1:* , filtro simple):
  - dim_fecha[fecha] → fact_sesiones_diarias[fecha], fact_embudo_diario[fecha], fact_inversion_diaria[fecha], fact_cliente_mes[mes], fact_atribucion[fecha_trimestre]
  - dim_canal[canal] → fact_sesiones_diarias, fact_embudo_diario, fact_inversion_diaria, fact_atribucion, fact_retencion_cohortes [canal]; dim_cliente[canal_primer_toque]
  - dim_cliente[user_id] → fact_cliente_mes[user_id], fact_audiencias[user_id]
- Cambio en el pipeline: agregar `fecha_trimestre` (primer día del trimestre) a `fact_atribucion` para relacionarla con dim_fecha
- Columnas de orden: dim_fecha[nombre_mes] por [mes]; dim_canal[canal] por [orden]; dim_cliente[segmento_rfm] por orden de segmento
- Nuevas medidas (tabla `_Medidas`):
  - Embudo: Visitantes, Registros, KYC completo, Aprobados, Activados, Tasa registro, Tasa KYC, Tasa aprobación, Tasa depósito, Conversión total
  - Inversión y eficiencia: Inversión, CAC, Sesiones
  - Atribución: Activaciones atribuidas, Act. último clic, Act. primer clic, Act. Markov, Act. Shapley, Cambio Markov vs último clic %, CAC último clic, CAC Markov
  - Valor y retención: Clientes activos, Ingreso total, Retención (cohortes), Retención M1, Retención M3, Retención M6, Churn %, LTV12m promedio, LTV12m / CAC
  - Segmentos: Clientes, Monto 180d promedio, Tamaño audiencia
  - Calidad/experimentos: Controles con falla

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-cli
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: "Fintech sobria: fondo #F4F6F9, tarjetas blancas sin borde, texto #1B2A41, densidad media"
    signature: "Título de página escrito como hallazgo + franja de KPIs con contexto en cada página analítica"
  archetype: Executive Summary
  navigation_model: none
  color_map:
    - measure: _Medidas[Inversión]
      color: "#3B5BA5"
      tint: "#E3E9F6"
    - measure: _Medidas[Activados]
      color: "#0F7B6C"
      tint: "#DDF2EE"
    - measure: _Medidas[CAC]
      color: "#B85C00"
      tint: "#FBEBDB"
    - measure: _Medidas[CAC último clic]
      color: "#8A94A6"
      tint: "#EEF0F4"
    - measure: _Medidas[CAC Markov]
      color: "#B85C00"
      tint: "#FBEBDB"
    - measure: _Medidas[Churn %]
      color: "#B42318"
      tint: "#FDE7E5"
    - measure: _Medidas[Retención (cohortes)]
      color: "#0F7B6C"
      tint: "#DDF2EE"
    - measure: _Medidas[LTV12m / CAC]
      color: "#6941C6"
      tint: "#EEE8FB"
    - measure: _Medidas[Conversión total]
      color: "#0F7B6C"
      tint: "#DDF2EE"
    - measure: _Medidas[Act. último clic]
      color: "#8A94A6"
      tint: "#EEF0F4"
    - measure: _Medidas[Act. primer clic]
      color: "#3B5BA5"
      tint: "#E3E9F6"
    - measure: _Medidas[Act. Markov]
      color: "#B85C00"
      tint: "#FBEBDB"
    - measure: _Medidas[Act. Shapley]
      color: "#6941C6"
      tint: "#EEE8FB"
  pages:
    - name: Resumen ejecutivo
      role: landing
      archetype: Executive
      layout_variant: A
      variant_rationale: "Pocas métricas globales con una tendencia y un ranking por canal: el patrón KPI + dos paneles + detalle."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "Franja de 5 KPIs, tendencia mensual a la izquierda, LTV/CAC por canal a la derecha y tabla de auditoría abajo."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1, 1, 9, 2]
            filters: [9, 1, 13, 2]
            kpis:    [1, 2, 13, 4]
            trend:   [1, 4, 8, 8]
            ranking: [8, 4, 13, 8]
            detail:  [1, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Paid Search se lleva el 37 % de la inversión y es el único canal pagado que no se paga en 12 meses"
            purpose: "Afirmar el hallazgo principal antes de cualquier gráfico."
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: dim_fecha[anio]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: channel_type_slicer
            region: filters
            kind: slicer
            field_bindings: dim_canal[tipo_canal]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: kpi_inversion
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto invertimos?"
            field_bindings: _Medidas[Inversión]
            color_strategy: measure_match
            insight_basis: "Etiqueta de referencia con CAC promedio."
            slot: 1
            of: 5
          - id: kpi_activados
            region: kpis
            kind: cardVisual
            purpose: "¿Cuántos clientes activamos?"
            field_bindings: _Medidas[Activados]
            color_strategy: measure_match
            insight_basis: "Etiqueta de referencia con conversión total."
            slot: 2
            of: 5
          - id: kpi_cac
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto cuesta un cliente activado?"
            field_bindings: _Medidas[CAC]
            color_strategy: measure_match
            slot: 3
            of: 5
          - id: kpi_ltv_cac
            region: kpis
            kind: cardVisual
            purpose: "¿Recuperamos la inversión en 12 meses?"
            field_bindings: _Medidas[LTV12m / CAC]
            color_strategy: measure_match
            insight_basis: "Referencia: umbral de 1,0x."
            slot: 4
            of: 5
          - id: kpi_churn
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de los clientes perdimos?"
            field_bindings: _Medidas[Churn %]
            color_strategy: measure_match
            slot: 5
            of: 5
          - id: monthly_trend
            region: trend
            kind: lineClusteredColumnComboChart
            purpose: "¿Cómo evolucionan la inversión y los clientes activados mes a mes?"
            field_bindings: { Category: dim_fecha[anio_mes], ColumnY: _Medidas[Inversión], LineY: _Medidas[Activados] }
            sort_policy: category_asc
            color_strategy: measure_match
          - id: ltv_cac_by_channel
            region: ranking
            kind: barChart
            purpose: "¿Qué canales se pagan en 12 meses?"
            field_bindings: { Category: dim_canal[canal], Y: _Medidas[LTV12m / CAC] }
            sort_policy: value_desc
            color_strategy: measure_match
            comparison_basis: "Línea de referencia constante en 1,0x."
          - id: channel_audit
            region: detail
            kind: tableEx
            purpose: "¿Cuál es la eficiencia completa de cada canal?"
            field_bindings: [dim_canal[canal], _Medidas[Inversión], _Medidas[Activados], _Medidas[CAC último clic], _Medidas[CAC Markov], _Medidas[Retención M3], _Medidas[Churn %], _Medidas[LTV12m promedio], _Medidas[LTV12m / CAC]]
            sort_policy: value_desc
            color_strategy: semantic
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: detail, pct_of_content: 45 }
          balance_rationale: "La tabla de auditoría tiene 9 columnas y 8 canales, así que necesita el ancho completo; la tendencia y el ranking quedan en paneles de 4 filas, legibles."
    - name: Embudo
      role: detail
      archetype: Analytical
      layout_variant: B
      variant_rationale: "Un embudo de 5 etapas necesita altura; el desglose por canal y la tendencia ocupan la columna derecha."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "Tasas de paso arriba, embudo alto a la izquierda, conversión por canal y tendencia de tasas a la derecha."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:     [1, 1, 9, 2]
            filters:    [9, 1, 13, 2]
            kpis:       [1, 2, 13, 4]
            funnel:     [1, 4, 6, 13]
            by_channel: [6, 4, 13, 8]
            trend:      [6, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "4 de cada 10 registros nunca completan el KYC: es la mayor fuga del embudo"
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: dim_fecha[anio]
            slicer_type: dropdown
            slot: 1
            of: 2
          - id: device_slicer
            region: filters
            kind: slicer
            field_bindings: fact_embudo_diario[dispositivo]
            slicer_type: dropdown
            slot: 2
            of: 2
          - id: kpi_tasa_registro
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de los visitantes se registra?"
            field_bindings: _Medidas[Tasa registro]
            color_strategy: none
            slot: 1
            of: 4
          - id: kpi_tasa_kyc
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de los registros completa KYC?"
            field_bindings: _Medidas[Tasa KYC]
            color_strategy: none
            slot: 2
            of: 4
          - id: kpi_tasa_deposito
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de las cuentas aprobadas hace el primer depósito?"
            field_bindings: _Medidas[Tasa depósito]
            color_strategy: none
            slot: 3
            of: 4
          - id: kpi_conversion
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de los visitantes termina activado?"
            field_bindings: _Medidas[Conversión total]
            color_strategy: measure_match
            slot: 4
            of: 4
          - id: funnel_chart
            region: funnel
            kind: funnel
            purpose: "¿Cuántas personas llegan a cada etapa?"
            field_bindings: { Values: [_Medidas[Visitantes], _Medidas[Registros], _Medidas[KYC completo], _Medidas[Aprobados], _Medidas[Activados]] }
            sort_policy: natural_order
            color_strategy: measure_match
          - id: conversion_by_channel
            region: by_channel
            kind: barChart
            purpose: "¿Qué canal convierte mejor visitas en clientes?"
            field_bindings: { Category: dim_canal[canal], Y: _Medidas[Conversión total] }
            sort_policy: value_desc
            color_strategy: measure_match
          - id: stage_rate_trend
            region: trend
            kind: lineChart
            purpose: "¿Mejoraron las tasas de KYC y de depósito con el tiempo?"
            field_bindings: { Category: dim_fecha[anio_mes], Y: [_Medidas[Tasa KYC], _Medidas[Tasa depósito]] }
            sort_policy: category_asc
            color_strategy: unique
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: funnel, pct_of_content: 34 }
          balance_rationale: "El embudo es la evidencia central y necesita alto para 5 etapas; los dos paneles de la derecha suman más espacio que él."
    - name: Atribución
      role: detail
      archetype: Comparative
      layout_variant: A
      variant_rationale: "La pregunta es comparar modelos por canal, así que dos comparaciones arriba y la matriz completa más el impacto en CAC abajo."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "Barras agrupadas por modelo y % de cambio arriba; matriz de 7 modelos y CAC por modelo abajo."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1, 1, 11, 2]
            filters: [11, 1, 13, 2]
            compare: [1, 2, 8, 8]
            shift:   [8, 2, 13, 8]
            matrix:  [1, 8, 8, 13]
            cac:     [8, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Markov le da a TikTok Ads 57 % más activaciones que el último clic: los canales que abren journeys están subvalorados"
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: dim_fecha[anio]
            slicer_type: dropdown
          - id: models_by_channel
            region: compare
            kind: clusteredBarChart
            purpose: "¿Cuántas activaciones recibe cada canal según el modelo?"
            field_bindings: { Category: dim_canal[canal], Y: [_Medidas[Act. último clic], _Medidas[Act. primer clic], _Medidas[Act. Markov], _Medidas[Act. Shapley]] }
            sort_policy: category_asc
            color_strategy: measure_match
          - id: markov_shift
            region: shift
            kind: barChart
            purpose: "¿Qué canales están subvalorados por el último clic?"
            field_bindings: { Category: dim_canal[canal], Y: _Medidas[Cambio Markov vs último clic %] }
            sort_policy: value_desc
            color_strategy: semantic
            comparison_basis: "Último clic como base (0 %)."
          - id: model_matrix
            region: matrix
            kind: pivotTable
            purpose: "¿Cuál es el crédito exacto de cada canal en los 7 modelos?"
            field_bindings: { Rows: dim_canal[canal], Columns: fact_atribucion[modelo], Values: _Medidas[Activaciones atribuidas] }
            sort_policy: category_asc
            color_strategy: gradient
          - id: cac_by_model
            region: cac
            kind: clusteredBarChart
            purpose: "¿Cómo cambia el CAC de cada canal entre último clic y Markov?"
            field_bindings: { Category: dim_canal[canal], Y: [_Medidas[CAC último clic], _Medidas[CAC Markov]] }
            sort_policy: value_desc
            color_strategy: measure_match
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: compare, pct_of_content: 32 }
          balance_rationale: "Cuatro paneles comparativos de tamaño parecido; el de barras agrupadas es algo mayor porque lleva 4 series por canal."
    - name: Retención
      role: detail
      archetype: Analytical
      layout_variant: A
      variant_rationale: "La matriz de cohortes es la evidencia principal y necesita filas y columnas legibles."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "KPIs de retención arriba, matriz de cohortes como protagonista, curva de retención y churn por canal a la derecha."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1, 1, 10, 2]
            filters: [10, 1, 13, 2]
            kpis:    [1, 2, 13, 4]
            cohorts: [1, 4, 8, 13]
            curve:   [8, 4, 13, 8]
            churn:   [8, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Referidos retiene 86 % de sus clientes al mes 3; Afiliados, solo 51 %"
          - id: channel_slicer
            region: filters
            kind: slicer
            field_bindings: dim_canal[canal]
            slicer_type: dropdown
          - id: kpi_ret_m1
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte sigue activa al mes 1?"
            field_bindings: _Medidas[Retención M1]
            color_strategy: measure_match
            slot: 1
            of: 5
          - id: kpi_ret_m3
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte sigue activa al mes 3?"
            field_bindings: _Medidas[Retención M3]
            color_strategy: measure_match
            slot: 2
            of: 5
          - id: kpi_ret_m6
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte sigue activa al mes 6?"
            field_bindings: _Medidas[Retención M6]
            color_strategy: measure_match
            slot: 3
            of: 5
          - id: kpi_churn
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de los clientes está inactiva hoy?"
            field_bindings: _Medidas[Churn %]
            color_strategy: measure_match
            slot: 4
            of: 5
          - id: kpi_ltv
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto ingreso deja un cliente en 12 meses?"
            field_bindings: _Medidas[LTV12m promedio]
            color_strategy: none
            slot: 5
            of: 5
          - id: cohort_matrix
            region: cohorts
            kind: pivotTable
            purpose: "¿Cómo decae la actividad de cada cohorte mes a mes?"
            field_bindings: { Rows: fact_retencion_cohortes[cohorte], Columns: fact_retencion_cohortes[mes_desde_activacion], Values: _Medidas[Retención (cohortes)] }
            sort_policy: category_asc
            color_strategy: gradient
          - id: retention_curve
            region: curve
            kind: lineChart
            purpose: "¿Qué tipo de canal retiene mejor a lo largo del tiempo?"
            field_bindings: { Category: fact_retencion_cohortes[mes_desde_activacion], Y: _Medidas[Retención (cohortes)], Legend: dim_canal[tipo_canal] }
            sort_policy: category_asc
            color_strategy: unique
          - id: churn_by_channel
            region: churn
            kind: barChart
            purpose: "¿Qué canal tiene más clientes perdidos?"
            field_bindings: { Category: dim_canal[canal], Y: _Medidas[Churn %] }
            sort_policy: value_desc
            color_strategy: measure_match
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: cohorts, pct_of_content: 48 }
          balance_rationale: "La matriz de cohortes tiene 18 filas por 21 meses y es la evidencia de la página; la curva y el churn quedan en paneles de 5 columnas, legibles."
    - name: Segmentos y audiencias
      role: detail
      archetype: Operational
      layout_variant: A
      variant_rationale: "La página termina en una lista accionable, así que la tabla de audiencias ocupa el ancho completo abajo."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "Tamaño y valor de cada segmento RFM arriba; audiencias con destino y tamaño abajo."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:    [1, 1, 10, 2]
            filters:   [10, 1, 13, 2]
            segments:  [1, 2, 7, 8]
            value:     [7, 2, 13, 8]
            audiences: [1, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "1.115 cuentas registradas o aprobadas esperan un empujón para activarse"
          - id: channel_slicer
            region: filters
            kind: slicer
            field_bindings: dim_canal[canal]
            slicer_type: dropdown
          - id: clients_by_segment
            region: segments
            kind: barChart
            purpose: "¿Cuántos clientes hay en cada segmento RFM?"
            field_bindings: { Category: dim_cliente[segmento_rfm], Y: _Medidas[Clientes] }
            sort_policy: natural_order
            color_strategy: none
          - id: value_by_segment
            region: value
            kind: barChart
            purpose: "¿Cuánto mueve en promedio un cliente de cada segmento en 180 días?"
            field_bindings: { Category: dim_cliente[segmento_rfm], Y: _Medidas[Monto 180d promedio] }
            sort_policy: natural_order
            color_strategy: none
          - id: audiences_table
            region: audiences
            kind: tableEx
            purpose: "¿A quién activar ahora, en qué plataforma y con qué objetivo?"
            field_bindings: [fact_audiencias[audiencia], fact_audiencias[destino], fact_audiencias[objetivo], _Medidas[Tamaño audiencia]]
            sort_policy: value_desc
            color_strategy: none
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: audiences, pct_of_content: 45 }
          balance_rationale: "Los dos gráficos de segmentos comparten la mitad superior en partes iguales; la tabla de audiencias lleva texto largo (objetivo) y necesita el ancho completo."
    - name: Experimentos y calidad
      role: detail
      archetype: Operational
      layout_variant: B
      variant_rationale: "Dos tablas de estado (tests y controles) con un gráfico de apoyo; sin slicers porque las tablas son pequeñas."
      navigation: []
      page_background: "#F4F6F9"
      layout_summary: "Tasa A vs B y tabla de decisiones arriba; controles de calidad abajo."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:   [1, 1, 13, 2]
            ab_chart: [1, 2, 6, 8]
            ab_table: [6, 2, 13, 8]
            quality:  [1, 8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Ambos tests favorecen a B, pero con muestras justas: implementar con grupo de control y volver a medir"
          - id: ab_rates
            region: ab_chart
            kind: clusteredColumnChart
            purpose: "¿Cuánto cambió la métrica entre A y B en cada test?"
            field_bindings: { Category: ab_resultados[nombre], Y: [ab_resultados[tasa_a], ab_resultados[tasa_b]] }
            sort_policy: category_asc
            color_strategy: unique
          - id: ab_table
            region: ab_table
            kind: tableEx
            purpose: "¿Qué decisión tomar con cada test y qué tan confiable es?"
            field_bindings: [ab_resultados[nombre], ab_resultados[n_a], ab_resultados[n_b], ab_resultados[lift_relativo], ab_resultados[ic_inf], ab_resultados[ic_sup], ab_resultados[p_valor], ab_resultados[mde_abs], ab_resultados[srm_p_valor], ab_resultados[decision]]
            sort_policy: none
            color_strategy: none
          - id: quality_table
            region: quality
            kind: tableEx
            purpose: "¿Qué controles de integración fallan y en qué proporción?"
            field_bindings: [calidad_datos[tabla], calidad_datos[control], calidad_datos[filas_con_falla], calidad_datos[filas_evaluadas], calidad_datos[pct_falla], calidad_datos[estado]]
            sort_policy: value_desc
            color_strategy: semantic
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: quality, pct_of_content: 45 }
          balance_rationale: "La tabla de calidad tiene 10 controles y nombres largos; los dos bloques de experimentos comparten la mitad superior."
  interaction_pattern:
    drill_targets: []
    cross_filter_rules: "Filter entre todos los visuales de cada página; las tarjetas KPI no filtran a otros visuales."
  accessibility:
    alt_text_strategy: "headline+trend: titular del hallazgo + qué muestra el visual"
    contrast_notes: "Texto #1B2A41 sobre #FFFFFF y #F4F6F9 supera AA; los estados de calidad llevan texto (OK/Alerta/Falla) además del color; último clic en gris para no depender de rojo/verde."
  theme:
    base: "references/design/assets/base.json adaptado a la paleta Fintech sobria"
    user_overrides: "Ninguno (proyecto nuevo, sin marca)"
```

## Implementation notes

- Model changes: crear `powerbi/FinDemoGrowth.SemanticModel` en TMDL con import de CSV desde el parámetro `RutaMarts`, las relaciones y medidas listadas; agregar `fecha_trimestre` a `fact_atribucion` en el pipeline y regenerar los marts.
- PBIR/report authoring: `powerbi/FinDemoGrowth.Report` en formato PBIR enlazado por ruta al modelo, 6 páginas según el contrato.
- Validation: validar JSON/PBIR con el CLI de authoring; validar medidas con DAX contra el modelo abierto en Desktop.
- Desktop screenshot verification: abrir `powerbi/FinDemoGrowth.pbip`, refrescar y capturar las 6 páginas.
- Publishing boundary: sin publicación.
- Risks: la ruta absoluta de los CSV cambia en cada máquina (se documenta en el README); la matriz de cohortes con 21 columnas puede requerir fuente de 9 pt.

## Notas de implementación (post-aprobación)

- Nombres del modelo: las tablas y columnas usan nombres de negocio (Fecha, Canal, Cliente, Embudo, Inversión, Atribución, Cliente mes, Retención cohortes, Audiencias, Experimentos, Calidad de datos) en lugar de `dim_*`/`fact_*`, y las medidas viven en la tabla de su dominio en vez de `_Medidas`, según las guías de modelado. Las referencias `_Medidas[...]` del contrato se mapean así: Inversión y CAC → `Inversión`; etapas y tasas → `Embudo`; activaciones y CAC por modelo → `Atribución`; churn, LTV y clientes → `Cliente`; retención → `Retención cohortes`.
- El embudo usa una tabla auxiliar `Etapa` y la medida `Embudo[Personas en la etapa]`, porque el visual de embudo necesita una categoría.
- Las franjas de KPIs se implementaron como una sola tarjeta multivalor por página.
- El título de la página 6 cambió porque la regla de decisión del pipeline ahora marca "Implementar B con holdout" cuando el efecto observado es menor que el MDE.
- Rediseño orientado al usuario final (posterior a la aprobación): menú lateral fijo con logo genérico de FinDemo, navegación con botones y filtros; paleta azul marino + naranja; tarjetas KPI con ícono y línea de contexto (medidas de texto); dona y minigráficos en SVG generados con DAX; color por medida (*field value*) para LTV/CAC, cambio de Markov y estado de calidad. El layout vigente es el de `powerbi/tools/generate_report.js`; las grillas del contrato de arriba describen la primera versión.
