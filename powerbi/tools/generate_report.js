// Genera las páginas PBIR de FinDemoGrowth.Report a partir del contrato de
// diseño aprobado en _brief/report-spec.md (grilla 12x12, lienzo 1920x1080).
//
// Uso:  node powerbi/tools/generate_report.js
//
// Reescribe definition/pages/ y el tema por completo; los IDs son
// deterministas (hash del nombre) para que los diffs en git sean estables.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPORT_DIR = path.resolve(__dirname, '..', 'FinDemoGrowth.Report');
const DEF_DIR = path.join(REPORT_DIR, 'definition');
const PAGES_DIR = path.join(DEF_DIR, 'pages');
const RES_DIR = path.join(REPORT_DIR, 'StaticResources', 'RegisteredResources');

const SCHEMA = {
  page: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
  pages: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json',
  visual: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json',
};

// ---------- Paleta (color_map del spec) ----------
const C = {
  ink: '#1B2A41', muted: '#5B6B82', page: '#F4F6F9', card: '#FFFFFF', line: '#E3E7EE',
  inversion: '#3B5BA5', activados: '#0F7B6C', cac: '#B85C00', churn: '#B42318',
  ltv: '#6941C6', gris: '#8A94A6',
  tintActivados: '#DDF2EE', tintInversion: '#E3E9F6',
};
const THEME_NAME = 'FinDemoSobria';
const THEME_FILE = `${THEME_NAME}-7c1e9a42.json`;

// ---------- Geometría ----------
const W = 1920, H = 1080, M = 32, G = 24, HEADER_H = 88;
const COL_W = (W - 2 * M - 11 * G) / 12;
const ROW_H = (H - 2 * M - HEADER_H - 11 * G) / 11;
const snap = (v) => Math.round(v / 8) * 8;
const colX = (c) => (c === 13 ? W - M + G : M + (c - 1) * (COL_W + G));
const rowY = (r) => (r === 1 ? M : r === 13 ? H - M + G : M + HEADER_H + G + (r - 2) * (ROW_H + G));

function regionRect([c0, r0, c1, r1]) {
  const x = snap(colX(c0)), y = snap(rowY(r0));
  return { x, y, width: snap(colX(c1) - G) - x, height: snap(rowY(r1) - G) - y };
}

function slotRect(rect, slot, of) {
  if (!slot) return rect;
  const horizontal = rect.width >= rect.height;
  const total = horizontal ? rect.width : rect.height;
  const size = (total - (of - 1) * G) / of;
  const start = (slot - 1) * (size + G);
  return horizontal
    ? { x: snap(rect.x + start), y: rect.y, width: snap(size), height: rect.height }
    : { x: rect.x, y: snap(rect.y + start), width: rect.width, height: snap(size) };
}

// ---------- Helpers de expresiones ----------
const id = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20);
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${s.replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const bool = (b) => lit(b ? 'true' : 'false');
const fill = (hex) => ({ solid: { color: lit(`'${hex}'`) } });

const measure = (t, p) => ({ field: { Measure: { Expression: { SourceRef: { Entity: t } }, Property: p } }, queryRef: `${t}.${p}`, nativeQueryRef: p });
const column = (t, p) => ({ field: { Column: { Expression: { SourceRef: { Entity: t } }, Property: p } }, queryRef: `${t}.${p}`, nativeQueryRef: p });
const sortBy = (proj, direction) => ({ sort: [{ field: proj.field, direction }], isDefaultSort: false });

function container({ title, altText, background = true }) {
  const vco = {
    padding: [{ properties: { top: num(12), bottom: num(12), left: num(16), right: num(16) } }],
    general: [{ properties: { altText: str(altText) } }],
  };
  if (title) {
    vco.title = [{ properties: { show: bool(true), text: str(title), fontSize: num(13), bold: bool(true), fontColor: fill(C.ink) } }];
  }
  if (background) {
    vco.background = [{ properties: { show: bool(true), color: fill(C.card), transparency: num(0) } }];
  }
  return vco;
}

// ---------- Constructores de visuales ----------
function textboxVisual(text) {
  return {
    visualType: 'textbox',
    objects: {
      general: [{ properties: { paragraphs: [{
        textRuns: [{ value: text, textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '22px', color: C.ink } }],
        horizontalTextAlignment: 'left',
      }] } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: [{ properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) } }],
      general: [{ properties: { altText: str(`Título de la página: ${text}`) } }],
    },
  };
}

function slicerVisual(proj, header) {
  return {
    visualType: 'slicer',
    query: { queryState: { Values: { projections: [proj] } } },
    objects: {
      data: [{ properties: { mode: str('Dropdown') } }],
      header: [{ properties: { show: bool(true), text: str(header) } }],
    },
    visualContainerObjects: {
      padding: [{ properties: { top: num(8), bottom: num(8), left: num(8), right: num(8) } }],
      background: [{ properties: { show: bool(true), color: fill(C.card), transparency: num(0) } }],
      general: [{ properties: { altText: str(`Filtro por ${header}`) } }],
    },
  };
}

function cardVisual(measures, altText) {
  return {
    visualType: 'cardVisual',
    query: { queryState: { Data: { projections: measures } } },
    objects: {
      value: [{ properties: { fontSize: num(28), fontColor: fill(C.ink), labelDisplayUnits: num(1) }, selector: { id: 'default' } }],
      label: [{ properties: { fontSize: num(12), fontColor: fill(C.muted) }, selector: { id: 'default' } }],
      padding: [{ properties: { paddingUniform: num(8) }, selector: { id: 'default' } }],
      layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      padding: [{ properties: { top: num(8), bottom: num(8), left: num(8), right: num(8) }, selector: { id: 'default' } }],
      spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: 'default' } }],
      background: [{ properties: { show: bool(true), color: fill(C.card), transparency: num(0) } }],
      general: [{ properties: { altText: str(altText) } }],
    },
  };
}

// Colores por serie: un measure → un color, con selector metadata = queryRef.
function seriesFills(pairs) {
  return pairs.map(([proj, hex]) => ({ properties: { fill: fill(hex) }, selector: { metadata: proj.queryRef } }));
}

function chartVisual(type, { roles, sort, colors, single, title, altText, extraObjects = {} }) {
  const objects = { ...extraObjects };
  if (single) objects.dataPoint = [{ properties: { defaultColor: fill(single) } }];
  if (colors) objects.dataPoint = seriesFills(colors);
  const query = { queryState: Object.fromEntries(Object.entries(roles).map(([r, p]) => [r, { projections: p }])) };
  if (sort) query.sortDefinition = sort;
  return { visualType: type, query, objects, visualContainerObjects: container({ title, altText }) };
}

function tableVisual(type, { roles, sort, title, altText, gradient, fontSize, hideColumnTotals }) {
  const objects = {
    columnHeaders: [{ properties: {
      columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true),
      backColor: fill('#EEF1F6'), fontColor: fill(C.ink), bold: bool(true),
    } }],
    values: [{ properties: {
      backColorPrimary: fill(C.card), backColorSecondary: fill('#F8F9FB'),
      fontColorPrimary: fill(C.ink), fontColorSecondary: fill(C.ink),
    } }],
  };
  if (fontSize) {
    objects.columnHeaders[0].properties.fontSize = num(fontSize);
    objects.values[0].properties.fontSize = num(fontSize);
    objects.rowHeaders = [{ properties: { fontSize: num(fontSize) } }];
  }
  if (hideColumnTotals) objects.subTotals = [{ properties: { columnSubtotals: bool(false) } }];
  if (gradient) {
    const [proj, min, max] = gradient;
    objects.values.push({
      properties: { backColor: { solid: { color: { expr: { FillRule: {
        Input: { SelectRef: { ExpressionName: proj.queryRef } },
        FillRule: { linearGradient2: {
          min: { color: { Literal: { Value: `'${min}'` } } },
          max: { color: { Literal: { Value: `'${max}'` } } },
          nullColoringStrategy: { strategy: { Literal: { Value: "'noColor'" } } },
        } },
      } } } } } },
      selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: proj.queryRef },
    });
  }
  const query = { queryState: Object.fromEntries(Object.entries(roles).map(([r, p]) => [r, { projections: p }])) };
  if (sort) query.sortDefinition = sort;
  const vco = container({ title, altText });
  vco.stylePreset = [{ properties: { name: str('None') } }];
  return { visualType: type, query, objects, visualContainerObjects: vco };
}

// ---------- Campos ----------
const F = {
  anio: column('Fecha', 'Año'), anioMes: column('Fecha', 'Año mes'),
  canal: column('Canal', 'Canal'), tipoCanal: column('Canal', 'Tipo de canal'),
  dispositivo: column('Embudo', 'Dispositivo'), etapa: column('Etapa', 'Etapa'),
  modelo: column('Atribución', 'Modelo'),
  cohorte: column('Retención cohortes', 'Cohorte'), mesDesde: column('Retención cohortes', 'Mes desde activación'),
  segmento: column('Cliente', 'Segmento RFM'),
};
const MS = {
  inversion: measure('Inversión', 'Inversión'), cac: measure('Inversión', 'CAC'),
  activados: measure('Embudo', 'Activados'), personas: measure('Embudo', 'Personas en la etapa'),
  tasaRegistro: measure('Embudo', 'Tasa registro'), tasaKyc: measure('Embudo', 'Tasa KYC'),
  tasaDeposito: measure('Embudo', 'Tasa depósito'), conversion: measure('Embudo', 'Conversión total'),
  atribuidas: measure('Atribución', 'Activaciones atribuidas'),
  actUltimo: measure('Atribución', 'Activaciones último clic'), actPrimero: measure('Atribución', 'Activaciones primer clic'),
  actMarkov: measure('Atribución', 'Activaciones Markov'), actShapley: measure('Atribución', 'Activaciones Shapley'),
  cambioMarkov: measure('Atribución', 'Cambio Markov vs último clic'),
  cacUltimo: measure('Atribución', 'CAC último clic'), cacMarkov: measure('Atribución', 'CAC Markov'),
  clientes: measure('Cliente', 'Clientes'), churn: measure('Cliente', 'Churn %'),
  ltv: measure('Cliente', 'Ingreso 12 meses promedio'), ltvCac: measure('Cliente', 'LTV 12 meses / CAC'),
  monto180: measure('Cliente', 'Monto 180 días promedio'),
  retencion: measure('Retención cohortes', 'Retención'),
  ret1: measure('Retención cohortes', 'Retención mes 1'), ret3: measure('Retención cohortes', 'Retención mes 3'),
  ret6: measure('Retención cohortes', 'Retención mes 6'),
  audiencia: measure('Audiencias', 'Tamaño audiencia'),
  tasaA: measure('Experimentos', 'Tasa variante A'), tasaB: measure('Experimentos', 'Tasa variante B'),
};
const col = (t, p) => column(t, p);

// ---------- Páginas (layout_contract del spec) ----------
const PAGES = [
  {
    name: 'Resumen ejecutivo',
    regions: { header: [1, 1, 9, 2], filters: [9, 1, 13, 2], kpis: [1, 2, 13, 4], trend: [1, 4, 8, 8], ranking: [8, 4, 13, 8], detail: [1, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('Paid Search se lleva el 37 % de la inversión y es el único canal pagado que no se paga en 12 meses')],
      ['year_slicer', 'filters', [1, 2], () => slicerVisual(F.anio, 'Año')],
      ['channel_type_slicer', 'filters', [2, 2], () => slicerVisual(F.tipoCanal, 'Tipo de canal')],
      ['kpis', 'kpis', null, () => cardVisual([MS.inversion, MS.activados, MS.cac, MS.ltvCac, MS.churn],
        'KPIs globales: inversión, clientes activados, CAC, LTV a 12 meses sobre CAC y churn.')],
      ['monthly_trend', 'trend', null, () => chartVisual('lineClusteredColumnComboChart', {
        roles: { Category: [F.anioMes], Y: [MS.inversion], Y2: [MS.activados] },
        sort: sortBy(F.anioMes, 'Ascending'),
        colors: [[MS.inversion, C.inversion], [MS.activados, C.activados]],
        title: 'Inversión (columnas) y clientes activados (línea) por mes',
        altText: 'Combinado mensual: la inversión crece con el tráfico y los activados la siguen con picos en junio y diciembre.',
      })],
      ['ltv_cac_by_channel', 'ranking', null, () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.ltvCac] },
        sort: sortBy(MS.ltvCac, 'Descending'), single: C.ltv,
        title: 'LTV 12 meses / CAC Markov por canal (umbral: 1,0x)',
        altText: 'Barras por canal del LTV a 12 meses sobre CAC Markov; Referidos lidera y Paid Search queda por debajo de 1,0x.',
      })],
      ['channel_audit', 'detail', null, () => tableVisual('pivotTable', {
        roles: { Rows: [F.canal], Values: [MS.inversion, MS.activados, MS.cacUltimo, MS.cacMarkov, MS.ret3, MS.churn, MS.ltv, MS.ltvCac] },
        title: 'Auditoría de canales',
        altText: 'Tabla por canal con inversión, activados, CAC por modelo, retención al mes 3, churn, ingreso a 12 meses y LTV/CAC.',
      })],
    ],
  },
  {
    name: 'Embudo',
    regions: { header: [1, 1, 9, 2], filters: [9, 1, 13, 2], kpis: [1, 2, 13, 4], funnel: [1, 4, 6, 13], by_channel: [6, 4, 13, 8], trend: [6, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('4 de cada 10 registros nunca completan el KYC: es la mayor fuga del embudo')],
      ['year_slicer', 'filters', [1, 2], () => slicerVisual(F.anio, 'Año')],
      ['device_slicer', 'filters', [2, 2], () => slicerVisual(F.dispositivo, 'Dispositivo')],
      ['kpis', 'kpis', null, () => cardVisual([MS.tasaRegistro, MS.tasaKyc, MS.tasaDeposito, MS.conversion],
        'Tasas de paso del embudo: registro, KYC, primer depósito y conversión total.')],
      ['funnel_chart', 'funnel', null, () => chartVisual('funnel', {
        roles: { Category: [F.etapa], Y: [MS.personas] },
        sort: sortBy(F.etapa, 'Ascending'), single: C.activados,
        title: 'Personas en cada etapa',
        altText: 'Embudo de 5 etapas desde la visita hasta el primer depósito; la caída más grande es de registro a KYC completo.',
      })],
      ['conversion_by_channel', 'by_channel', null, () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.conversion] },
        sort: sortBy(MS.conversion, 'Descending'), single: C.activados,
        title: 'Conversión visita → primer depósito por canal de primer toque',
        altText: 'Barras de conversión total por canal; Referidos casi duplica el promedio y Afiliados y TikTok quedan al final.',
      })],
      ['stage_rate_trend', 'trend', null, () => chartVisual('lineChart', {
        roles: { Category: [F.anioMes], Y: [MS.tasaKyc, MS.tasaDeposito] },
        sort: sortBy(F.anioMes, 'Ascending'),
        colors: [[MS.tasaKyc, C.inversion], [MS.tasaDeposito, C.cac]],
        title: 'Tasa de KYC y tasa de depósito por mes',
        altText: 'Líneas mensuales de tasa de KYC y tasa de depósito; la tasa de KYC sube durante el test de onboarding simplificado.',
        extraObjects: { legend: [{ properties: { show: bool(true) } }] },
      })],
    ],
  },
  {
    name: 'Atribución',
    regions: { header: [1, 1, 11, 2], filters: [11, 1, 13, 2], compare: [1, 2, 8, 8], shift: [8, 2, 13, 8], matrix: [1, 8, 8, 13], cac: [8, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('Markov le da a TikTok Ads 57 % más activaciones que el último clic: los canales que abren journeys están subvalorados')],
      ['year_slicer', 'filters', null, () => slicerVisual(F.anio, 'Año')],
      ['models_by_channel', 'compare', null, () => chartVisual('clusteredBarChart', {
        roles: { Category: [F.canal], Y: [MS.actUltimo, MS.actPrimero, MS.actMarkov, MS.actShapley] },
        sort: sortBy(F.canal, 'Ascending'),
        colors: [[MS.actUltimo, C.gris], [MS.actPrimero, C.inversion], [MS.actMarkov, C.cac], [MS.actShapley, C.ltv]],
        title: 'Activaciones atribuidas por canal según el modelo',
        altText: 'Barras agrupadas por canal con último clic, primer clic, Markov y Shapley; Email y Directo dependen del último clic.',
        extraObjects: { labels: [{ properties: { show: bool(false) } }] },
      })],
      ['markov_shift', 'shift', null, () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.cambioMarkov] },
        sort: sortBy(MS.cambioMarkov, 'Descending'), single: C.cac,
        title: 'Cambio de crédito: Markov vs último clic',
        altText: 'Variación porcentual del crédito al pasar de último clic a Markov; TikTok Ads y Paid Social ganan, Email y Directo pierden.',
      })],
      ['model_matrix', 'matrix', null, () => tableVisual('pivotTable', {
        roles: { Rows: [F.canal], Columns: [F.modelo], Values: [MS.atribuidas] },
        gradient: [MS.atribuidas, C.tintInversion, C.inversion], hideColumnTotals: true,
        title: 'Activaciones por canal en los 7 modelos',
        altText: 'Matriz de canal por modelo de atribución con las activaciones atribuidas; mapa de calor azul por magnitud.',
      })],
      ['cac_by_model', 'cac', null, () => chartVisual('clusteredBarChart', {
        roles: { Category: [F.canal], Y: [MS.cacUltimo, MS.cacMarkov] },
        sort: sortBy(MS.cacMarkov, 'Descending'),
        colors: [[MS.cacUltimo, C.gris], [MS.cacMarkov, C.cac]],
        title: 'CAC por canal: último clic vs Markov',
        altText: 'CAC por canal con los dos modelos; Paid Search es el más caro en ambos y TikTok baja con Markov.',
      })],
    ],
  },
  {
    name: 'Retención',
    regions: { header: [1, 1, 10, 2], filters: [10, 1, 13, 2], kpis: [1, 2, 13, 4], cohorts: [1, 4, 8, 13], curve: [8, 4, 13, 8], churn: [8, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('Referidos retiene 86 % de sus clientes al mes 3; Afiliados, solo 51 %')],
      ['channel_slicer', 'filters', null, () => slicerVisual(F.canal, 'Canal de primer toque')],
      ['kpis', 'kpis', null, () => cardVisual([MS.ret1, MS.ret3, MS.ret6, MS.churn, MS.ltv],
        'Retención al mes 1, 3 y 6, churn actual e ingreso promedio a 12 meses.')],
      ['cohort_matrix', 'cohorts', null, () => tableVisual('pivotTable', {
        roles: { Rows: [F.cohorte], Columns: [F.mesDesde], Values: [MS.retencion] },
        gradient: [MS.retencion, C.tintActivados, C.activados], fontSize: 8, hideColumnTotals: true,
        title: 'Retención por cohorte de activación y meses desde la activación',
        altText: 'Matriz de cohortes mensuales con el porcentaje de clientes activos en cada mes posterior a la activación.',
      })],
      ['retention_curve', 'curve', null, () => chartVisual('lineChart', {
        roles: { Category: [F.mesDesde], Y: [MS.retencion], Series: [F.tipoCanal] },
        sort: sortBy(F.mesDesde, 'Ascending'),
        title: 'Curva de retención por tipo de canal',
        altText: 'Curvas de retención por tipo de canal; los canales propios y ganados retienen más que los pagados.',
        extraObjects: { legend: [{ properties: { show: bool(true) } }], labels: [{ properties: { show: bool(false) } }] },
      })],
      ['churn_by_channel', 'churn', null, () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.churn] },
        sort: sortBy(MS.churn, 'Descending'), single: C.churn,
        title: 'Churn actual por canal de primer toque',
        altText: 'Barras de churn por canal; Afiliados y TikTok Ads tienen el churn más alto y Referidos el más bajo.',
      })],
    ],
  },
  {
    name: 'Segmentos y audiencias',
    regions: { header: [1, 1, 10, 2], filters: [10, 1, 13, 2], segments: [1, 2, 7, 8], value: [7, 2, 13, 8], audiences: [1, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('1.115 cuentas registradas o aprobadas esperan un empujón para activarse')],
      ['channel_slicer', 'filters', null, () => slicerVisual(F.canal, 'Canal de primer toque')],
      ['clients_by_segment', 'segments', null, () => chartVisual('barChart', {
        roles: { Category: [F.segmento], Y: [MS.clientes] },
        sort: sortBy(F.segmento, 'Ascending'), single: C.inversion,
        title: 'Clientes por segmento RFM',
        altText: 'Barras de clientes por segmento RFM, de Campeones a Perdidos.',
      })],
      ['value_by_segment', 'value', null, () => chartVisual('barChart', {
        roles: { Category: [F.segmento], Y: [MS.monto180] },
        sort: sortBy(F.segmento, 'Ascending'), single: C.ltv,
        title: 'Monto transado promedio en 180 días por segmento',
        altText: 'Barras del monto promedio transado en 180 días por segmento RFM; Campeones mueve varias veces más que los demás.',
      })],
      ['audiences_table', 'audiences', null, () => tableVisual('tableEx', {
        roles: { Values: [col('Audiencias', 'Audiencia'), col('Audiencias', 'Destino'), col('Audiencias', 'Objetivo'), MS.audiencia] },
        sort: sortBy(MS.audiencia, 'Descending'),
        title: 'Audiencias dinámicas listas para activar',
        altText: 'Tabla de audiencias con destino en pauta o CRM, objetivo y número de personas.',
      })],
    ],
  },
  {
    name: 'Experimentos y calidad',
    regions: { header: [1, 1, 13, 2], ab_chart: [1, 2, 5, 8], ab_table: [5, 2, 13, 8], quality: [1, 8, 13, 13] },
    visuals: [
      ['page_title', 'header', null, () => textboxVisual('Ambos tests favorecen a B, pero con muestras justas: implementar con grupo de control y volver a medir')],
      ['ab_rates', 'ab_chart', null, () => chartVisual('clusteredColumnChart', {
        roles: { Category: [col('Experimentos', 'Test')], Y: [MS.tasaA, MS.tasaB] },
        sort: sortBy(col('Experimentos', 'Test'), 'Ascending'),
        colors: [[MS.tasaA, C.gris], [MS.tasaB, C.activados]],
        title: 'Tasa de la métrica: control (A) vs tratamiento (B)',
        altText: 'Columnas agrupadas con la tasa de A y B en cada test; B supera a A en ambos.',
      })],
      ['ab_table', 'ab_table', null, () => tableVisual('tableEx', {
        roles: { Values: ['Test', 'Muestra A', 'Muestra B', 'Lift relativo', 'IC 95 inferior', 'IC 95 superior', 'p-valor', 'Efecto mínimo detectable', 'p-valor SRM', 'Decisión'].map((c) => col('Experimentos', c)) },
        title: 'Resultado y decisión de cada experimento',
        altText: 'Tabla de experimentos con muestras, lift, intervalo de confianza, p-valor, efecto mínimo detectable, chequeo de SRM y decisión.',
      })],
      ['quality_table', 'quality', null, () => tableVisual('tableEx', {
        roles: { Values: ['Tabla fuente', 'Control', 'Filas con falla', 'Filas evaluadas', 'Porcentaje de falla', 'Estado'].map((c) => col('Calidad de datos', c)) },
        sort: sortBy(col('Calidad de datos', 'Porcentaje de falla'), 'Descending'),
        title: 'Controles de calidad sobre las fuentes integradas',
        altText: 'Tabla de controles de calidad con filas con falla, porcentaje y estado; las fallas se concentran en HubSpot.',
      })],
    ],
  },
];

// ---------- Escritura ----------
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function buildPage(page) {
  const pageId = id('page', page.name);
  const dir = path.join(PAGES_DIR, pageId);
  writeJson(path.join(dir, 'page.json'), {
    $schema: SCHEMA.page,
    name: pageId,
    displayName: page.name,
    displayOption: 'FitToPage',
    height: H,
    width: W,
    objects: { background: [{ properties: { color: fill(C.page), transparency: num(0) } }] },
  });
  page.visuals.forEach(([vid, region, slot, build], i) => {
    const rect = slotRect(regionRect(page.regions[region]), ...(slot || []));
    const visualId = id(page.name, vid);
    const z = (i + 1) * 1000;
    writeJson(path.join(dir, 'visuals', visualId, 'visual.json'), {
      $schema: SCHEMA.visual,
      name: visualId,
      position: { ...rect, z, tabOrder: z },
      visual: build(),
    });
  });
  return pageId;
}

function buildTheme() {
  const theme = {
    name: THEME_FILE,
    dataColors: [C.inversion, C.activados, C.cac, C.ltv, C.gris, C.churn, '#2E90FA', C.ink],
    background: C.card, foreground: C.ink, tableAccent: C.inversion,
    good: C.activados, neutral: '#D9A400', bad: C.churn,
    maximum: C.inversion, center: '#D9A400', minimum: C.tintInversion, null: '#C0C6D0',
    textClasses: {
      callout: { fontSize: 28, fontFace: 'Segoe UI Semibold', color: C.ink },
      title: { fontSize: 13, fontFace: 'Segoe UI Semibold', color: C.ink },
      header: { fontSize: 12, fontFace: 'Segoe UI Semibold', color: C.ink },
      label: { fontSize: 10, fontFace: 'Segoe UI', color: C.muted },
    },
    visualStyles: {
      '*': { '*': {
        border: [{ show: true, color: { solid: { color: C.line } }, radius: 8 }],
        dropShadow: [{ show: false }],
        padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
        visualHeader: [{ show: false }],
      } },
      lineChart: { '*': {
        lineStyles: [{ strokeWidth: 2.5, lineChartType: 'smooth' }],
        categoryAxis: [{ showAxisTitle: false, gridlineShow: false, labelColor: { solid: { color: C.muted } } }],
        valueAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
      } },
      barChart: { '*': {
        labels: [{ show: true, fontSize: 10, color: { solid: { color: C.ink } } }],
        valueAxis: [{ show: false, gridlineShow: false }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        legend: [{ show: false }],
      } },
      clusteredBarChart: { '*': {
        labels: [{ show: true, fontSize: 9, color: { solid: { color: C.ink } } }],
        valueAxis: [{ show: false, gridlineShow: false }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
      } },
      clusteredColumnChart: { '*': {
        labels: [{ show: true, fontSize: 10, color: { solid: { color: C.ink } } }],
        valueAxis: [{ show: false, gridlineShow: false }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
      } },
      lineClusteredColumnComboChart: { '*': {
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        valueAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
      } },
      slicer: { '*': {
        header: [{ fontFamily: 'Segoe UI Semibold', textSize: 10, fontColor: { solid: { color: C.ink } } }],
        items: [{ fontFamily: 'Segoe UI', textSize: 10, fontColor: { solid: { color: C.ink } } }],
      } },
    },
  };
  fs.mkdirSync(RES_DIR, { recursive: true });
  for (const f of fs.readdirSync(RES_DIR)) {
    if (f.startsWith(`${THEME_NAME}-`)) fs.rmSync(path.join(RES_DIR, f));
  }
  writeJson(path.join(RES_DIR, THEME_FILE), theme);

  const reportFile = path.join(DEF_DIR, 'report.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  report.themeCollection.customTheme = {
    name: THEME_FILE,
    reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport,
    type: 'RegisteredResources',
  };
  report.resourcePackages = report.resourcePackages.filter((p) => p.type !== 'RegisteredResources');
  report.resourcePackages.push({
    name: 'RegisteredResources', type: 'RegisteredResources',
    items: [{ name: THEME_FILE, path: THEME_FILE, type: 'CustomTheme' }],
  });
  writeJson(reportFile, report);
}

function main() {
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  const ids = PAGES.map(buildPage);
  writeJson(path.join(PAGES_DIR, 'pages.json'), { $schema: SCHEMA.pages, pageOrder: ids, activePageName: ids[0] });
  buildTheme();
  console.log(`${ids.length} páginas, ${PAGES.reduce((n, p) => n + p.visuals.length, 0)} visuales escritos en ${PAGES_DIR}`);
}

main();
