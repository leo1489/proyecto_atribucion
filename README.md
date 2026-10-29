# Growth Analytics para una fintech: atribución, embudo, retención y experimentos

Proyecto de portafolio que reproduce el trabajo de un **analista de datos de marketing digital** en una fintech colombiana. Integra las fuentes de un equipo de growth (GA4, HubSpot, plataformas de pauta y core transaccional), construye una capa de negocio para **Power BI** y responde preguntas como *¿qué canal merece más presupuesto?* o *¿dónde se pierden los clientes?*

> Los datos son **sintéticos** y corresponden a una fintech ficticia ("FinDemo"). El generador está diseñado para que haya patrones reales que descubrir, no ruido aleatorio. Así el proyecto se puede compartir sin exponer información de clientes.

## Qué cubre

| Necesidad del rol | Dónde está |
|---|---|
| Tableros de control y KPIs de negocio | Marts en `data/marts/` (modelo estrella) para Power BI, más el resumen en [`reports/resumen_kpis.md`](reports/resumen_kpis.md) |
| Atribución y full-funnel | [`growth/attribution.py`](growth/attribution.py): último clic, primer clic, lineal, posicional, decaimiento temporal, **cadenas de Markov** y **valor de Shapley**. Embudo en [`growth/funnel.py`](growth/funnel.py) |
| Auditoría de canales | `resumen_canal`: inversión, CAC según el modelo, retención, churn y LTV/CAC por canal |
| Ciclo de vida, churn y retención | [`growth/retention.py`](growth/retention.py): cohortes mensuales, churn por inactividad e ingreso a 12 meses |
| Segmentación dinámica para pauta y CRM | [`growth/segmentation.py`](growth/segmentation.py): RFM y 6 audiencias con destino (Meta Ads, Google Customer Match, HubSpot) |
| Experimentos de growth y A/B tests | [`growth/ab_testing.py`](growth/ab_testing.py): prueba z, IC, chequeo de SRM y efecto mínimo detectable (MDE) |
| Gobierno e integración de datos | [`growth/data_quality.py`](growth/data_quality.py): controles de integridad entre GA4, la app, HubSpot y el core |
| Insights y recomendaciones | La sección [Hallazgos](#hallazgos-y-recomendaciones) de este documento |

## Arquitectura

```
Fuentes crudas (data/raw)           Análisis (growth/)              Capa de negocio (data/marts)      Consumo
─────────────────────────           ─────────────────               ────────────────────────────      ───────
ga4_sessions        ─┐              attribution.py  ─┐              dim_fecha, dim_canal,
app_customers        │              funnel.py        │              dim_cliente                       Power BI
hubspot_contacts     ├──────────▶   retention.py     ├─────────▶    fact_sesiones_diarias       ───▶  (tablero)
ad_spend             │              segmentation.py  │              fact_embudo_diario
core_transactions    │              ab_testing.py    │              fact_inversion_diaria             resumen_kpis.md
core_balances        │              data_quality.py ─┘              fact_atribucion
ab_assignments      ─┘                                              fact_cliente_mes
                                                                    fact_retencion_cohortes
                                                                    fact_audiencias, ab_resultados,
                                                                    calidad_datos, resumen_canal
```

Las fuentes crudas usan los nombres de columna de cada sistema (en inglés, como los exporta GA4 o HubSpot). Los marts usan nombres de negocio en español, listos para el tablero.

## Cómo ejecutarlo

Requiere Python 3.10 o superior.

```bash
pip install -r requirements.txt
```

```bash
python -m growth.pipeline
```

```bash
python -m pytest -q
```

El pipeline tarda unos 30 segundos. Regenera `data/raw/` (no versionado), `data/marts/` y `reports/resumen_kpis.md`. Todo es reproducible con la semilla de [`growth/config.py`](growth/config.py).

## Datos simulados

- **60.000 visitantes** entre enero de 2025 y junio de 2026, con 140.000 sesiones en 8 canales. La fecha de corte del análisis es el 30 de septiembre de 2026.
- Embudo: visita → registro → KYC → cuenta aprobada → primer depósito (la **activación**, que es la conversión que se atribuye).
- Hay unos 3.400 clientes activados, con unas 123.000 transacciones y saldos mensuales. El ingreso combina comisiones por transacción y margen financiero sobre el saldo.
- Dos A/B tests: un onboarding de KYC simplificado y un email de bienvenida personalizado.
- El CRM tiene ruido deliberado (contactos duplicados, fuentes vacías o marcadas OFFLINE) para ejercitar los controles de calidad.

## Hallazgos y recomendaciones

*Cifras del resumen generado; ver [`reports/resumen_kpis.md`](reports/resumen_kpis.md).*

**1. El último clic premia a los canales que cierran y castiga a los que abren.**
Email recibe 677 activaciones con último clic y 0 con primer clic, porque nunca inicia un journey. Con Markov, TikTok Ads pasa de 174 a 274 activaciones (+57 %) y Paid Social de 395 a 487 (+23 %). Si el presupuesto se reparte con último clic, se recortan justo los canales que llenan el embudo.
→ *Recomendación:* usar Markov (o Shapley) para planear el presupuesto y dejar el último clic solo para la optimización táctica dentro de cada plataforma.

**2. Paid Search se lleva el 37 % de la inversión y es el único canal pagado que no se paga en 12 meses.**
Su CAC con Markov es $168 mil, el más alto, frente a un ingreso a 12 meses de $147 mil por cliente (LTV/CAC 0,87x).
→ *Recomendación:* separar las campañas de marca de las genéricas (non-brand) y bajar las pujas genéricas. Lo que se libere puede ir a Referidos y Paid Social.

**3. Referidos es el mejor canal en todas las métricas.**
Convierte 9,6 % de las visitas en activaciones (el promedio es 5,7 %), tiene un churn de 21 % y un LTV/CAC de 3,3x.
→ *Recomendación:* escalar el programa (subir el bono o hacer campañas de referidos dirigidas a Campeones) y usar a los Campeones como semilla de lookalikes.

**4. Un CAC barato no garantiza clientes rentables: TikTok Ads y Afiliados.**
TikTok tiene el CAC más bajo ($39 mil con Markov), pero un churn de 62 %. En Afiliados, solo 49 % de las cuentas aprobadas hace el primer depósito (72 % en Paid Search) y el churn llega a 73 %.
→ *Recomendación:* pagar a los afiliados por cliente activo a 90 días y no por depósito inicial. Medir TikTok por LTV/CAC y no por CAC.

**5. La mayor fuga del embudo está en el KYC, y el test lo confirma.**
Cerca del 40 % de los registros nunca completa el KYC. El onboarding simplificado subió la tasa de 60,9 % a 65,6 % (+4,7 pp, p = 0,045, IC 95 % [0,1; 9,3] pp, sin SRM).
→ *Recomendación:* implementarlo. Mientras tanto, activar la audiencia **Recuperar KYC incompleto** (790 personas) en HubSpot y en retargeting.

**6. Un resultado significativo no siempre es confiable: el email de bienvenida.**
El test marca +8,8 pp en clientes activos en el mes 2 (p = 0,019). Pero cada grupo tiene unas 220 personas, el IC va de 1,6 a 16 pp y el MDE es 11 pp. Con muestras pequeñas, los efectos que salen significativos suelen estar inflados (*winner's curse*).
→ *Recomendación:* implementarlo con un grupo de control (holdout) del 10 % y volver a medir el efecto antes de proyectar su impacto.

**7. Hay acciones de CRM listas para ejecutar.**
Hay 325 cuentas aprobadas sin primer depósito, 70 clientes de alto valor en riesgo y 643 clientes leales que no usan la tarjeta. Además, la lista de exclusión (2.208 clientes activos) evita pagar pauta para adquirir a quien ya es cliente.

**8. Gobierno de datos.**
El 2 % de los contactos de HubSpot tiene una fuente original que no coincide con GA4 (OFFLINE), otro 1,5 % no tiene fuente y el 0,4 % está duplicado.
→ *Recomendación:* usar el `user_id` de la app como llave única en la integración y volver obligatoria la propiedad de fuente al crear el contacto.

## Estructura

```
growth/
  config.py          parámetros (fechas, ventanas, semilla)
  generate_data.py   simulación de las fuentes
  attribution.py     modelos de atribución
  funnel.py          embudo
  retention.py       cohortes, churn y valor
  segmentation.py    RFM y audiencias
  ab_testing.py      estadística de experimentos
  data_quality.py    controles de calidad
  report.py          resumen en Markdown
  pipeline.py        orquestación y construcción de marts
tests/               pruebas de atribución y A/B
data/marts/          capa de negocio (versionada)
reports/             resumen de KPIs
powerbi/             tablero (en construcción)
```

## Notas metodológicas

- **Ventana de atribución:** se consideran los toques de los 45 días anteriores al primer depósito.
- **Markov:** cadena de primer orden; el crédito de cada canal es proporcional a su *removal effect*. Se estima por trimestre.
- **Shapley:** v(S) es el número de conversiones de los journeys cuyos canales están contenidos en S. Se calcula exacto sobre los 2⁸ subconjuntos.
- **Churn:** un cliente se cuenta como perdido si no tiene transacciones en los últimos 60 días a la fecha de corte.
- **LTV12m:** ingreso observado (comisiones + margen) de los primeros 12 meses. Solo incluye cohortes con 12 meses completos.
- **Limitación:** son datos simulados. Los hallazgos ilustran el método de análisis, no el mercado colombiano.
