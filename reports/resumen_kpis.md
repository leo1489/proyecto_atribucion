# Resumen de KPIs — FinDemo (datos sintéticos)

Generado por `python -m growth.pipeline`. Fecha de corte: 2026-09-30.
Las cifras cambian si se modifican los parámetros de `growth/config.py` o `growth/generate_data.py`.

## KPIs globales

| KPI | Valor |
|---|---|
| Visitantes únicos | 60.000 |
| Registros | 9.434 |
| Clientes activados (primer depósito) | 3.393 |
| Conversión visita → activación | 5.7% |
| Inversión total de marketing | $291.027.010 |
| CAC promedio (inversión / activados) | $85.773 |
| Churn actual (sin transacciones > 60 días) | 39.1% |
| Ingreso promedio primeros 12 meses | $152.432 |

Retención promedio de cohortes (clientes con al menos una transacción en el mes): M1: 81.6% · M3: 74.6% · M6: 63.9%

## Embudo por canal de primer toque

| Canal (1er toque) | Visitantes | Registro | KYC | Depósito | Visita→activación |
|---|---|---|---|---|---|
| Paid Search | 12.236 | 15.5% | 62.2% | 72.3% | 6.0% |
| Paid Social | 13.253 | 15.2% | 60.7% | 67.3% | 5.3% |
| Orgánico | 11.896 | 14.8% | 60.2% | 75.8% | 5.8% |
| Referidos | 5.899 | 21.8% | 61.2% | 84.1% | 9.6% |
| TikTok Ads | 8.511 | 14.7% | 59.9% | 53.0% | 4.0% |
| Afiliados | 5.353 | 15.1% | 61.6% | 49.2% | 3.9% |
| Directo | 2.852 | 14.3% | 58.8% | 74.9% | 5.5% |

## Activaciones atribuidas por modelo

Ventana de lookback: 45 días. Cada modelo reparte el mismo total de activaciones.

| Canal | Último clic | Primer clic | Lineal | Posicional (40/20/40) | Decaimiento temporal | Markov | Shapley |
|---|---|---|---|---|---|---|---|
| Paid Search | 675 | 732 | 689 | 700 | 687 | 639 | 670 |
| Paid Social | 395 | 699 | 493 | 528 | 469 | 487 | 503 |
| TikTok Ads | 174 | 342 | 221 | 245 | 208 | 274 | 239 |
| Afiliados | 196 | 207 | 190 | 197 | 190 | 243 | 201 |
| Email | 677 | 0 | 477 | 389 | 528 | 500 | 458 |
| Orgánico | 478 | 689 | 539 | 565 | 525 | 522 | 545 |
| Directo | 572 | 158 | 452 | 398 | 482 | 485 | 429 |
| Referidos | 226 | 566 | 330 | 371 | 306 | 244 | 348 |

## Auditoría de canales

CAC = inversión del canal / activaciones atribuidas. LTV12m = ingreso (comisiones + margen) de los primeros 12 meses (cohortes con 12 meses observados), por canal de primer toque.

| Canal | Inversión | CAC último clic | CAC Markov | Retención M3 | Churn | Ingreso 12m | LTV12m / CAC |
|---|---|---|---|---|---|---|---|
| Paid Search | $107.602.213 | $159.411 | $168.290 | 76.1% | 38.9% | $146.988 | 0.87x |
| Paid Social | $33.849.338 | $85.695 | $69.464 | 72.4% | 43.3% | $125.690 | 1.81x |
| TikTok Ads | $10.615.563 | $61.009 | $38.767 | 56.7% | 61.7% | $82.640 | 2.13x |
| Afiliados | $14.280.000 | $72.857 | $58.884 | 51.0% | 72.6% | $72.552 | 1.23x |
| Email | $44.999.906 | $66.470 | $89.970 | — | — | — | — |
| Orgánico | $62.999.990 | $131.799 | $120.788 | 80.0% | 29.9% | $185.260 | 1.53x |
| Directo | $0 | — | — | 79.9% | 31.0% | $158.863 | — |
| Referidos | $16.680.000 | $73.805 | $68.443 | 86.5% | 21.2% | $224.883 | 3.29x |

## Segmentos RFM

| Segmento | Clientes | % clientes |
|---|---|---|
| Campeones | 653 | 19.2% |
| Leales | 737 | 21.7% |
| Potenciales | 275 | 8.1% |
| Necesitan atención | 371 | 10.9% |
| En riesgo | 172 | 5.1% |
| Hibernando | 333 | 9.8% |
| Perdidos | 852 | 25.1% |

## Audiencias dinámicas

| Audiencia | Destino | Tamaño |
|---|---|---|
| Cross-sell tarjeta débito | HubSpot | 643 |
| Exclusión de adquisición | Google Ads / Meta Ads / TikTok Ads | 2208 |
| Impulsar primer depósito | HubSpot + Google Ads | 325 |
| Reactivación alto valor | Meta Ads + HubSpot | 70 |
| Recuperar KYC incompleto | HubSpot + retargeting Meta | 790 |
| Semilla lookalike | Meta Ads / Google Customer Match | 653 |

## Experimentos

| Test | Métrica | n (A/B) | Tasa A | Tasa B | Lift | p-valor | MDE | SRM p | Decisión |
|---|---|---|---|---|---|---|---|---|---|
| Onboarding KYC simplificado | Tasa de KYC completo | 834 / 869 | 60.9% | 65.6% | 7.7% | 0.045 | 6.6 pp | 0.40 | Implementar B |
| Email de bienvenida personalizado | Activo en el mes 2 | 234 / 203 | 76.9% | 85.7% | 11.4% | 0.019 | 11.3 pp | 0.14 | Implementar B |

## Calidad de datos

| tabla | control | filas_con_falla | pct_falla | estado |
|---|---|---|---|---|
| ga4_sessions | session_id duplicado | 0 | 0.00% | OK |
| ga4_sessions | Canal sin clasificar | 0 | 0.00% | OK |
| app_customers | Registro sin sesión en GA4 | 0 | 0.00% | OK |
| app_customers | Orden de etapas (registro ≤ KYC ≤ aprobación ≤ depósito) | 0 | 0.00% | OK |
| hubspot_contacts | user_id duplicado en CRM | 38 | 0.40% | Alerta |
| hubspot_contacts | Fuente original vacía | 129 | 1.36% | Falla |
| hubspot_contacts | Fuente HubSpot distinta al primer canal GA4 | 194 | 2.06% | Falla |
| core_transactions | Transacción de cliente no activado | 0 | 0.00% | OK |
| core_transactions | Monto no positivo | 0 | 0.00% | OK |
| ad_spend | Inversión negativa | 0 | 0.00% | OK |
