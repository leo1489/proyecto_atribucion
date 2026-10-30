// Genera las páginas PBIR de FinDemoGrowth.Report (lienzo 1920x1080).
//
// Diseño orientado al usuario final: menú lateral fijo (logo, navegación entre
// páginas y filtros), encabezado con el hallazgo de la página, franja de KPIs
// con ícono y línea de contexto, y gráficos en tarjetas blancas.
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

// ---------- Paleta: azul marino + naranja ----------
const C = {
  navy: '#0E2841', navySoft: '#1F3B5C', navyLine: '#2A4A6E',
  orange: '#F28C28', orangeTint: '#FDEBD8',
  ink: '#13233A', muted: '#6B7A90', onDark: '#C9D6E3', onDarkMuted: '#8FA5BD',
  page: '#EEF2F7', card: '#FFFFFF', line: '#E3E8EF',
  steel: '#5B7FA6', gray: '#9AA8BA', navyTint: '#DCE5F0',
};
const THEME_FILE = 'FinDemoNavyOrange-5a9c13e2.json';
const LOGO_FILE = 'FinDemoLogo1761780000.png';

// ---------- Geometría ----------
const W = 1920, H = 1080, G = 24;
const SIDEBAR_W = 296;
const X0 = SIDEBAR_W + G;           // inicio del área de contenido
const X1 = W - G;                   // fin del área de contenido
const CONTENT_W = X1 - X0;          // 1576
const ROW = { header: 24, kpi: 112, kpiH: 120, r2: 256, r2H: 384, r3: 664, r3H: 392 };
const LEFT_W = 1000, RIGHT_X = X0 + LEFT_W + G, RIGHT_W = X1 - RIGHT_X;
const HALF_W = (CONTENT_W - G) / 2;

const rect = (x, y, width, height) => ({ x, y, width, height });
const kpiSlots = (n) => {
  const w = (CONTENT_W - (n - 1) * G) / n;
  return Array.from({ length: n }, (_, i) => rect(Math.round(X0 + i * (w + G)), ROW.kpi, Math.round(w), ROW.kpiH));
};

// ---------- Helpers de expresiones ----------
const id = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20);
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${s.replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? 'true' : 'false');
const fill = (hex) => ({ solid: { color: lit(`'${hex}'`) } });
const measureExpr = (t, p) => ({ expr: { Measure: { Expression: { SourceRef: { Entity: t } }, Property: p } } });
const fillMeasure = (t, p) => ({ solid: { color: measureExpr(t, p) } });
const padding = (t, r = t, b = t, l = r) => [{ properties: { top: num(t), right: num(r), bottom: num(b), left: num(l) } }];

const measure = (t, p) => ({ field: { Measure: { Expression: { SourceRef: { Entity: t } }, Property: p } }, queryRef: `${t}.${p}`, nativeQueryRef: p });
const column = (t, p) => ({ field: { Column: { Expression: { SourceRef: { Entity: t } }, Property: p } }, queryRef: `${t}.${p}`, nativeQueryRef: p });
const sortBy = (proj, direction) => ({ sort: [{ field: proj.field, direction }], isDefaultSort: false });
const queryOf = (roles, sort) => {
  const q = { queryState: Object.fromEntries(Object.entries(roles).map(([r, p]) => [r, { projections: p }])) };
  if (sort) q.sortDefinition = sort;
  return q;
};

// Íconos SVG para las tarjetas (círculo naranja suave con un glifo).
const icon = (glyph, onDark = false) => 'data:image/svg+xml;utf8,'
  + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
  + `<circle cx='16' cy='16' r='16' fill='${onDark ? '%23F28C28' : '%23FDEBD8'}'/>`
  + `<text x='16' y='21.5' text-anchor='middle' font-family='Segoe UI' font-size='15' font-weight='700' fill='${onDark ? '%23FFFFFF' : '%23F28C28'}'>${glyph}</text></svg>`;

// ---------- Contenedores ----------
function cardChrome({ title, subtitle, altText, bg = C.card }) {
  const vco = {
    background: [{ properties: { show: bool(true), color: fill(bg), transparency: num(0) } }],
    border: [{ properties: { show: bool(true), color: fill(C.line), radius: num(12), width: num(1) } }],
    dropShadow: [{ properties: { show: bool(false) } }],
    padding: padding(16, 20),
    general: [{ properties: { altText: str(altText) } }],
    visualHeader: [{ properties: { show: bool(false) } }],
  };
  if (title) {
    vco.title = [{ properties: { show: bool(true), text: str(title), fontSize: num(14), bold: bool(true), fontColor: fill(C.ink) } }];
    vco.subTitle = [{ properties: subtitle
      ? { show: bool(true), text: str(subtitle), fontSize: num(11), fontColor: fill(C.muted) }
      : { show: bool(false) } }];
  } else {
    vco.title = [{ properties: { show: bool(false) } }];
  }
  return vco;
}

// ---------- Constructores de visuales ----------
function shapeVisual(hex, radius = 0) {
  return {
    visualType: 'shape',
    objects: {
      shape: [{ properties: { tileShape: str(radius ? 'rectangleRounded' : 'rectangle'), ...(radius ? { roundEdge: int(radius) } : {}) } }],
      fill: [{ properties: { fillColor: fill(hex), transparency: num(0) }, selector: { id: 'default' } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: padding(0),
      general: [{ properties: { altText: str('Elemento decorativo') } }],
    },
  };
}

function textVisual(runs, altText) {
  return {
    visualType: 'textbox',
    objects: {
      general: [{ properties: { paragraphs: runs.map(([text, style, align = 'left']) => ({
        textRuns: [{ value: text, textStyle: style }], horizontalTextAlignment: align,
      })) } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: padding(0),
      general: [{ properties: { altText: str(altText) } }],
    },
  };
}

function logoVisual() {
  return {
    visualType: 'image',
    objects: {
      general: [{ properties: { imageUrl: { expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: LOGO_FILE } } } } }],
      image: [{ properties: { fit: str('Fit') } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(true), color: fill('#FFFFFF'), transparency: num(0) } }],
      border: [{ properties: { show: bool(true), color: fill('#FFFFFF'), radius: num(16), width: num(1) } }],
      padding: padding(14),
      general: [{ properties: { altText: str('Logo de FinDemo') } }],
      visualHeader: [{ properties: { show: bool(false) } }],
    },
  };
}

function navButton(label, targetPageId, active) {
  const textStyle = { fontSize: num(12), fontColor: fill(active ? C.navy : C.onDark), bold: bool(active), horizontalAlignment: str('left'), leftMargin: int(20), text: str(label) };
  return {
    visualType: 'actionButton',
    objects: {
      text: [
        { properties: { show: bool(true) } },
        { properties: textStyle, selector: { id: 'default' } },
        { properties: { fontColor: fill(active ? C.navy : '#FFFFFF') }, selector: { id: 'hover' } },
      ],
      icon: [
        { properties: { show: bool(false) } },
        { properties: { placement: str('left') }, selector: { id: 'default' } },
      ],
      fill: [
        { properties: { show: bool(true) } },
        { properties: { fillColor: fill(active ? C.orange : C.navy), transparency: num(0) }, selector: { id: 'default' } },
        { properties: { fillColor: fill(active ? C.orange : C.navySoft), transparency: num(0) }, selector: { id: 'hover' } },
      ],
      outline: [{ properties: { show: bool(false) } }],
      shape: [
        { properties: { tileShape: str('rectangleRounded'), roundEdge: int(10) } },
        { properties: { tileShape: str('rectangleRounded') }, selector: { id: 'default' } },
      ],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: padding(0),
      visualLink: [{ properties: {
        show: bool(true), type: str('PageNavigation'), navigationSection: str(targetPageId), tooltip: str(`Ir a ${label}`),
      } }],
      general: [{ properties: { altText: str(`Navegación: ${label}`) } }],
    },
  };
}

function slicerVisual(proj, header) {
  return {
    visualType: 'slicer',
    query: queryOf({ Values: [proj] }),
    objects: {
      data: [{ properties: { mode: str('Dropdown') } }],
      header: [{ properties: { show: bool(true), text: str(header), fontColor: fill(C.ink) } }],
    },
    visualContainerObjects: {
      padding: padding(8, 12),
      background: [{ properties: { show: bool(true), color: fill('#FFFFFF'), transparency: num(0) } }],
      border: [{ properties: { show: bool(true), color: fill('#FFFFFF'), radius: num(10), width: num(1) } }],
      general: [{ properties: { altText: str(`Filtro por ${header}`) } }],
      visualHeader: [{ properties: { show: bool(false) } }],
    },
  };
}

// Línea de contexto de una tarjeta KPI: tarjeta transparente con una medida de
// texto, superpuesta en la parte baja de la tarjeta principal. (Las reference
// labels nativas del cardVisual no renderizan de forma fiable desde PBIR.)
function contextCard([table, name], dark) {
  return {
    visualType: 'cardVisual',
    query: queryOf({ Data: [measure(table, name)] }),
    objects: {
      value: [{ properties: { fontSize: num(11), bold: bool(false), fontColor: fill(dark ? C.orange : C.muted), horizontalAlignment: str('left') }, selector: { id: 'default' } }],
      label: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
      padding: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
      layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
      fillCustom: [{ properties: { show: bool(true), fillColor: fill(dark ? C.navy : C.card), transparency: num(0) }, selector: { id: 'default' } }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      title: [{ properties: { show: bool(false) } }],
      padding: padding(0),
      general: [{ properties: { altText: str('Línea de contexto del KPI') } }],
      visualHeader: [{ properties: { show: bool(false) } }],
    },
  };
}

// Tarjeta KPI: valor, etiqueta e ícono; la línea de contexto va en contextCard.
function kpiCard({ value, label, context, glyph, dark = false, displayUnits = 1 }) {
  const ink = dark ? '#FFFFFF' : C.ink;
  const sub = dark ? C.onDark : C.muted;
  const objects = {
    value: [{ properties: { fontSize: num(28), bold: bool(true), fontColor: fill(ink), labelDisplayUnits: num(displayUnits) }, selector: { id: 'default' } }],
    label: [{ properties: { show: bool(true), text: str(label), fontSize: num(12), fontColor: fill(sub), position: str('aboveValue') }, selector: { id: 'default' } }],
    padding: [{ properties: { paddingUniform: num(4) }, selector: { id: 'default' } }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: { id: 'default' } }],
    outline: [{ properties: { show: bool(false) }, selector: { id: 'default' } }],
    fillCustom: [{ properties: { show: bool(true), fillColor: fill(dark ? C.navy : C.card), transparency: num(0) }, selector: { id: 'default' } }],
    image: [{ properties: {
      show: bool(true), imageType: str('imageUrl'), imageUrl: str(icon(glyph, dark)),
      position: str('Right'), size: int(36), fit: str('Fit'),
    }, selector: { id: 'default' } }],
  };
  return {
    __context: context ? { context, dark } : null,
    visualType: 'cardVisual',
    query: queryOf({ Data: [value] }),
    objects,
    visualContainerObjects: {
      ...cardChrome({ altText: `${label}: KPI${context ? ' con línea de contexto' : ''}`, bg: dark ? C.navy : C.card }),
      ...(dark ? { border: [{ properties: { show: bool(false) } }] } : {}),
      // Con línea de contexto, el valor sube para dejarle espacio abajo.
      padding: context ? padding(10, 20, 40, 20) : padding(16, 20),
    },
  };
}

function chartVisual(type, { roles, sort, colors, single, colorMeasure, title, subtitle, altText, extraObjects = {} }) {
  const objects = { ...extraObjects };
  if (single) objects.dataPoint = [{ properties: { defaultColor: fill(single) } }];
  if (colors) objects.dataPoint = colors.map(([proj, hex]) => ({ properties: { fill: fill(hex) }, selector: { metadata: proj.queryRef } }));
  if (colorMeasure) {
    objects.dataPoint = [{ properties: { fill: fillMeasure(...colorMeasure) }, selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }] } }];
  }
  return { visualType: type, query: queryOf(roles, sort), objects, visualContainerObjects: cardChrome({ title, subtitle, altText }) };
}

function tableVisual(type, { roles, sort, title, subtitle, altText, gradient, fontColorBy, imageSize, fontSize = 11, hideColumnTotals, hideTotals, rowPadding = 4 }) {
  const objects = {
    columnHeaders: [{ properties: {
      columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true),
      backColor: fill(C.card), fontColor: fill(C.muted), bold: bool(true), fontSize: num(fontSize),
    } }],
    values: [{ properties: {
      backColorPrimary: fill(C.card), backColorSecondary: fill('#F7F9FC'),
      fontColorPrimary: fill(C.ink), fontColorSecondary: fill(C.ink), fontSize: num(fontSize),
    } }],
    grid: [{ properties: {
      gridHorizontal: bool(true), gridHorizontalColor: fill(C.line), gridVertical: bool(false),
      rowPadding: num(rowPadding),
      ...(imageSize ? { imageHeight: num(imageSize[1]), imageWidth: num(imageSize[0]) } : {}),
    } }],
  };
  if (type === 'pivotTable') {
    objects.rowHeaders = [{ properties: { fontColor: fill(C.ink), fontSize: num(fontSize), backColor: fill(C.card) } }];
    objects.rowTotal = [{ properties: { fontColor: fill(C.navy), backColor: fill('#EEF2F7') } }];
  }
  if (hideTotals) objects.total = [{ properties: { totals: bool(false) } }];
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
  for (const [proj, colorMeasure] of fontColorBy || []) {
    objects.values.push({
      properties: { fontColor: fillMeasure(...colorMeasure) },
      selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: proj.queryRef },
    });
  }
  const vco = cardChrome({ title, subtitle, altText });
  vco.stylePreset = [{ properties: { name: str('None') } }];
  return { visualType: type, query: queryOf(roles, sort), objects, visualContainerObjects: vco };
}

function svgImageVisual(measureRef, { title, subtitle, altText }) {
  return {
    visualType: 'image',
    objects: {
      image: [{ properties: { sourceType: str('imageData'), sourceField: measureExpr(...measureRef), fit: str('Fit') } }],
    },
    visualContainerObjects: cardChrome({ title, subtitle, altText }),
  };
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
const m = measure;
const MS = {
  inversion: m('Inversión', 'Inversión'), cac: m('Inversión', 'CAC'),
  activados: m('Embudo', 'Activados'), visitantes: m('Embudo', 'Visitantes'), personas: m('Embudo', 'Personas en la etapa'),
  tasaRegistro: m('Embudo', 'Tasa registro'), tasaKyc: m('Embudo', 'Tasa KYC'),
  tasaDeposito: m('Embudo', 'Tasa depósito'), conversion: m('Embudo', 'Conversión total'),
  tendencia: m('Embudo', 'Tendencia activados'),
  atribuidas: m('Atribución', 'Activaciones atribuidas'),
  actUltimo: m('Atribución', 'Activaciones último clic'), actPrimero: m('Atribución', 'Activaciones primer clic'),
  actMarkov: m('Atribución', 'Activaciones Markov'), actShapley: m('Atribución', 'Activaciones Shapley'),
  cambioMarkov: m('Atribución', 'Cambio Markov vs último clic'),
  cacUltimo: m('Atribución', 'CAC último clic'), cacMarkov: m('Atribución', 'CAC Markov'),
  subvalorado: m('Atribución', 'Canal más subvalorado'), sobrevalorado: m('Atribución', 'Canal más sobrevalorado'),
  clientes: m('Cliente', 'Clientes'), churn: m('Cliente', 'Churn %'),
  ltv: m('Cliente', 'Ingreso 12 meses promedio'), ltvCac: m('Cliente', 'LTV 12 meses / CAC'),
  monto180: m('Cliente', 'Monto 180 días promedio'),
  campeones: m('Cliente', 'Clientes campeones'), enRiesgo: m('Cliente', 'Clientes en riesgo'),
  porActivar: m('Audiencias', 'Cuentas por activar'), audiencia: m('Audiencias', 'Tamaño audiencia'),
  retencion: m('Retención cohortes', 'Retención'),
  ret1: m('Retención cohortes', 'Retención mes 1'), ret3: m('Retención cohortes', 'Retención mes 3'),
  ret6: m('Retención cohortes', 'Retención mes 6'),
  tasaA: m('Experimentos', 'Tasa variante A'), tasaB: m('Experimentos', 'Tasa variante B'),
  liftKyc: m('Experimentos', 'Lift onboarding KYC'), liftEmail: m('Experimentos', 'Lift email bienvenida'),
  fallas: m('Calidad de datos', 'Controles con falla'), controlesOk: m('Calidad de datos', 'Controles OK'),
};
const col = (t, p) => column(t, p);

// ---------- Páginas ----------
// Cada página: nombre, etiqueta del menú, título (hallazgo), subtítulo,
// slicer propio del menú lateral y lista de [id, rect, constructor].
const PAGES = [
  {
    name: 'Resumen ejecutivo', nav: 'Resumen',
    title: 'Paid Search se lleva el 37 % de la inversión y no se paga en 12 meses',
    subtitle: 'Inversión, clientes activados y retorno por canal · enero 2025 a junio 2026',
    pageSlicer: [F.tipoCanal, 'Tipo de canal'],
    visuals: (k = kpiSlots(5)) => [
      ['kpi_inversion', k[0], () => kpiCard({ value: MS.inversion, label: 'Inversión total', context: ['Inversión', 'Contexto inversión'], glyph: '$', dark: true, displayUnits: 1000000 })],
      ['kpi_activados', k[1], () => kpiCard({ value: MS.activados, label: 'Clientes activados', context: ['Embudo', 'Contexto activados'], glyph: '#' })],
      ['kpi_cac', k[2], () => kpiCard({ value: MS.cac, label: 'CAC promedio', context: ['Atribución', 'Contexto CAC'], glyph: '$' })],
      ['kpi_ltv_cac', k[3], () => kpiCard({ value: MS.ltvCac, label: 'LTV 12 meses / CAC', context: ['Cliente', 'Contexto LTV/CAC'], glyph: 'x' })],
      ['kpi_churn', k[4], () => kpiCard({ value: MS.churn, label: 'Churn actual', context: ['Cliente', 'Contexto churn'], glyph: '!' })],
      ['trend', rect(X0, ROW.r2, LEFT_W, ROW.r2H), () => chartVisual('lineClusteredColumnComboChart', {
        roles: { Category: [F.anioMes], Y: [MS.inversion], Y2: [MS.activados] },
        sort: sortBy(F.anioMes, 'Ascending'),
        colors: [[MS.inversion, C.navy], [MS.activados, C.orange]],
        title: 'Inversión y clientes activados por mes',
        subtitle: 'Columnas: inversión (COP) · línea: clientes con primer depósito',
        altText: 'Combinado mensual de inversión y activados; los activados siguen a la inversión con picos en junio y diciembre.',
      })],
      ['donut', rect(RIGHT_X, ROW.r2, RIGHT_W, ROW.r2H), () => svgImageVisual(['Inversión', 'Dona inversión sin retorno'], {
        title: 'Inversión sin retorno a 12 meses',
        subtitle: 'Parte de la inversión en canales con LTV/CAC menor a 1,0x',
        altText: 'Dona con el porcentaje de la inversión puesta en canales que no se pagan en 12 meses.',
      })],
      ['audit', rect(X0, ROW.r3, LEFT_W, ROW.r3H), () => tableVisual('pivotTable', {
        roles: { Rows: [F.canal], Values: [MS.inversion, MS.activados, MS.cacMarkov, MS.ret3, MS.ltvCac, MS.tendencia] },
        fontColorBy: [[MS.ltvCac, ['Cliente', 'Color LTV/CAC']]], imageSize: [120, 22], rowPadding: 2,
        title: 'Auditoría de canales',
        subtitle: 'LTV/CAC en naranja: el canal no recupera su costo en 12 meses · tendencia mensual de activados',
        altText: 'Tabla por canal con inversión, activados, CAC Markov, retención al mes 3, LTV/CAC y minigráfico de activados.',
      })],
      ['ltv_cac', rect(RIGHT_X, ROW.r3, RIGHT_W, ROW.r3H), () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.ltvCac] },
        sort: sortBy(MS.ltvCac, 'Descending'), colorMeasure: ['Cliente', 'Color LTV/CAC'],
        title: 'Retorno a 12 meses por canal',
        subtitle: 'LTV 12 meses / CAC Markov · naranja = por debajo de 1,0x',
        altText: 'Barras de LTV/CAC por canal; Referidos lidera con 3,3x y Paid Search queda en 0,87x.',
      })],
    ],
  },
  {
    name: 'Embudo', nav: 'Embudo',
    title: '4 de cada 10 registros nunca completan el KYC',
    subtitle: 'De la visita al primer depósito, por canal de primer toque',
    pageSlicer: [F.dispositivo, 'Dispositivo'],
    visuals: (k = kpiSlots(5)) => [
      ['kpi_visitantes', k[0], () => kpiCard({ value: MS.visitantes, label: 'Visitantes', context: ['Embudo', 'Contexto visitantes'], glyph: '#', dark: true })],
      ['kpi_registro', k[1], () => kpiCard({ value: MS.tasaRegistro, label: 'Tasa de registro', glyph: '1' })],
      ['kpi_kyc', k[2], () => kpiCard({ value: MS.tasaKyc, label: 'Tasa de KYC', glyph: '2' })],
      ['kpi_deposito', k[3], () => kpiCard({ value: MS.tasaDeposito, label: 'Tasa de depósito', glyph: '3' })],
      ['kpi_conversion', k[4], () => kpiCard({ value: MS.conversion, label: 'Conversión total', context: ['Embudo', 'Contexto activados'], glyph: '%25' })],
      ['funnel', rect(X0, ROW.r2, HALF_W, ROW.r2H), () => chartVisual('funnel', {
        roles: { Category: [F.etapa], Y: [MS.personas] },
        sort: sortBy(F.etapa, 'Ascending'), single: C.navy,
        title: 'Personas en cada etapa',
        subtitle: 'La mayor caída ocurre entre registro y KYC completo',
        altText: 'Embudo de 5 etapas desde la visita hasta el primer depósito.',
      })],
      ['by_channel', rect(X0 + HALF_W + G, ROW.r2, HALF_W, ROW.r2H), () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.conversion] },
        sort: sortBy(MS.conversion, 'Descending'), single: C.orange,
        title: 'Conversión visita → primer depósito por canal',
        subtitle: 'Canal de la primera visita',
        altText: 'Barras de conversión por canal; Referidos casi duplica el promedio.',
      })],
      ['rates', rect(X0, ROW.r3, CONTENT_W, ROW.r3H), () => chartVisual('lineChart', {
        roles: { Category: [F.anioMes], Y: [MS.tasaKyc, MS.tasaDeposito] },
        sort: sortBy(F.anioMes, 'Ascending'),
        colors: [[MS.tasaKyc, C.navy], [MS.tasaDeposito, C.orange]],
        title: 'Tasa de KYC y tasa de primer depósito por mes',
        subtitle: 'La tasa de KYC sube durante el test de onboarding simplificado (ene-abr 2026)',
        altText: 'Líneas mensuales de tasa de KYC y tasa de depósito.',
        extraObjects: { legend: [{ properties: { show: bool(true), position: str('Top') } }] },
      })],
    ],
  },
  {
    name: 'Atribución', nav: 'Atribución',
    title: 'Markov le da a TikTok Ads 57 % más crédito que el último clic',
    subtitle: 'Los canales que abren journeys están subvalorados por el último clic',
    pageSlicer: [F.tipoCanal, 'Tipo de canal'],
    visuals: (k = kpiSlots(4)) => [
      ['kpi_markov', k[0], () => kpiCard({ value: MS.actMarkov, label: 'Activaciones atribuidas', context: ['Atribución', 'Contexto activaciones Markov'], glyph: '#', dark: true })],
      ['kpi_sub', k[1], () => kpiCard({ value: MS.subvalorado, label: 'Canal más subvalorado', context: ['Atribución', 'Contexto subvalorado'], glyph: '+' })],
      ['kpi_sobre', k[2], () => kpiCard({ value: MS.sobrevalorado, label: 'Canal más sobrevalorado', context: ['Atribución', 'Contexto sobrevalorado'], glyph: '-' })],
      ['kpi_cac', k[3], () => kpiCard({ value: MS.cacMarkov, label: 'CAC Markov', context: ['Atribución', 'Contexto CAC'], glyph: '$' })],
      ['models', rect(X0, ROW.r2, LEFT_W, ROW.r2H), () => chartVisual('clusteredBarChart', {
        roles: { Category: [F.canal], Y: [MS.actUltimo, MS.actPrimero, MS.actMarkov, MS.actShapley] },
        sort: sortBy(F.canal, 'Ascending'),
        colors: [[MS.actUltimo, C.gray], [MS.actPrimero, C.steel], [MS.actMarkov, C.orange], [MS.actShapley, C.navy]],
        title: 'Activaciones por canal según el modelo',
        subtitle: 'Último clic, primer clic y los dos modelos algorítmicos',
        altText: 'Barras agrupadas por canal con cuatro modelos de atribución.',
        extraObjects: { labels: [{ properties: { show: bool(false) } }] },
      })],
      ['shift', rect(RIGHT_X, ROW.r2, RIGHT_W, ROW.r2H), () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.cambioMarkov] },
        sort: sortBy(MS.cambioMarkov, 'Descending'), colorMeasure: ['Atribución', 'Color cambio Markov'],
        title: 'Cambio de crédito: Markov vs último clic',
        subtitle: 'Naranja: el último clic subvalora el canal',
        altText: 'Variación del crédito por canal al pasar de último clic a Markov.',
      })],
      ['matrix', rect(X0, ROW.r3, LEFT_W, ROW.r3H), () => tableVisual('pivotTable', {
        roles: { Rows: [F.canal], Columns: [F.modelo], Values: [MS.atribuidas] },
        gradient: [MS.atribuidas, '#F4F7FB', C.steel], hideColumnTotals: true,
        title: 'Activaciones por canal en los 7 modelos',
        subtitle: 'Cada modelo reparte el mismo total de activaciones',
        altText: 'Matriz de canal por modelo de atribución con mapa de calor.',
      })],
      ['cac', rect(RIGHT_X, ROW.r3, RIGHT_W, ROW.r3H), () => chartVisual('clusteredBarChart', {
        roles: { Category: [F.canal], Y: [MS.cacUltimo, MS.cacMarkov] },
        sort: sortBy(MS.cacMarkov, 'Descending'),
        colors: [[MS.cacUltimo, C.gray], [MS.cacMarkov, C.orange]],
        title: 'CAC por canal: último clic vs Markov',
        subtitle: 'Costo por cliente activado (COP)',
        altText: 'CAC por canal con ambos modelos; Paid Search es el más caro.',
        extraObjects: { labels: [{ properties: { show: bool(false) } }] },
      })],
    ],
  },
  {
    name: 'Retención', nav: 'Retención',
    title: 'Referidos retiene 86 % de sus clientes al mes 3; Afiliados, solo 51 %',
    subtitle: 'Clientes con al menos una transacción en cada mes desde su activación',
    pageSlicer: [F.canal, 'Canal de primer toque'],
    visuals: (k = kpiSlots(5)) => [
      ['kpi_ret3', k[0], () => kpiCard({ value: MS.ret3, label: 'Retención al mes 3', context: ['Retención cohortes', 'Contexto retención'], glyph: '3', dark: true })],
      ['kpi_ret1', k[1], () => kpiCard({ value: MS.ret1, label: 'Retención al mes 1', glyph: '1' })],
      ['kpi_ret6', k[2], () => kpiCard({ value: MS.ret6, label: 'Retención al mes 6', glyph: '6' })],
      ['kpi_churn', k[3], () => kpiCard({ value: MS.churn, label: 'Churn actual', context: ['Cliente', 'Contexto churn'], glyph: '!' })],
      ['kpi_ltv', k[4], () => kpiCard({ value: MS.ltv, label: 'Ingreso 12 meses', glyph: '$' })],
      ['cohorts', rect(X0, ROW.r2, LEFT_W, ROW.r3 + ROW.r3H - ROW.r2), () => tableVisual('pivotTable', {
        roles: { Rows: [F.cohorte], Columns: [F.mesDesde], Values: [MS.retencion] },
        gradient: [MS.retencion, '#F4F7FB', '#8FB0D3'], fontSize: 8, hideColumnTotals: true,
        title: 'Retención por cohorte de activación',
        subtitle: 'Filas: mes de activación · columnas: meses desde la activación',
        altText: 'Matriz de cohortes mensuales con el porcentaje de clientes activos en cada mes.',
      })],
      ['curve', rect(RIGHT_X, ROW.r2, RIGHT_W, ROW.r2H), () => chartVisual('lineChart', {
        roles: { Category: [F.mesDesde], Y: [MS.retencion], Series: [F.tipoCanal] },
        sort: sortBy(F.mesDesde, 'Ascending'),
        title: 'Curva de retención por tipo de canal',
        subtitle: 'Los canales propios retienen más que los pagados',
        altText: 'Curvas de retención por tipo de canal.',
        extraObjects: { legend: [{ properties: { show: bool(true), position: str('Top') } }], labels: [{ properties: { show: bool(false) } }] },
      })],
      ['churn', rect(RIGHT_X, ROW.r3, RIGHT_W, ROW.r3H), () => chartVisual('barChart', {
        roles: { Category: [F.canal], Y: [MS.churn] },
        sort: sortBy(MS.churn, 'Descending'), single: C.orange,
        title: 'Churn actual por canal',
        subtitle: 'Sin transacciones en los últimos 60 días',
        altText: 'Barras de churn por canal; Afiliados y TikTok Ads tienen el churn más alto.',
      })],
    ],
  },
  {
    name: 'Segmentos y audiencias', nav: 'Segmentos',
    title: '1.115 cuentas registradas o aprobadas esperan un empujón para activarse',
    subtitle: 'Segmentación RFM y audiencias listas para pauta y CRM',
    pageSlicer: [F.canal, 'Canal de primer toque'],
    visuals: (k = kpiSlots(4)) => [
      ['kpi_clientes', k[0], () => kpiCard({ value: MS.clientes, label: 'Clientes activados', context: ['Cliente', 'Contexto clientes'], glyph: '#', dark: true })],
      ['kpi_campeones', k[1], () => kpiCard({ value: MS.campeones, label: 'Campeones', glyph: '+' })],
      ['kpi_riesgo', k[2], () => kpiCard({ value: MS.enRiesgo, label: 'En riesgo o hibernando', context: ['Cliente', 'Contexto en riesgo'], glyph: '!' })],
      ['kpi_activar', k[3], () => kpiCard({ value: MS.porActivar, label: 'Cuentas por activar', context: ['Audiencias', 'Contexto cuentas por activar'], glyph: '>' })],
      ['segments', rect(X0, ROW.r2, HALF_W, ROW.r2H), () => chartVisual('barChart', {
        roles: { Category: [F.segmento], Y: [MS.clientes] },
        sort: sortBy(F.segmento, 'Ascending'), single: C.navy,
        title: 'Clientes por segmento RFM',
        subtitle: 'Recencia, frecuencia y monto de los últimos 180 días',
        altText: 'Barras de clientes por segmento RFM.',
      })],
      ['value', rect(X0 + HALF_W + G, ROW.r2, HALF_W, ROW.r2H), () => chartVisual('barChart', {
        roles: { Category: [F.segmento], Y: [MS.monto180] },
        sort: sortBy(F.segmento, 'Ascending'), single: C.orange,
        title: 'Monto transado promedio por segmento',
        subtitle: 'COP por cliente en los últimos 180 días',
        altText: 'Barras del monto promedio transado por segmento RFM.',
      })],
      ['audiences', rect(X0, ROW.r3, CONTENT_W, ROW.r3H), () => tableVisual('tableEx', {
        roles: { Values: [col('Audiencias', 'Audiencia'), col('Audiencias', 'Destino'), col('Audiencias', 'Objetivo'), MS.audiencia] },
        sort: sortBy(MS.audiencia, 'Descending'), fontSize: 12, hideTotals: true,
        title: 'Audiencias dinámicas listas para activar',
        subtitle: 'Se recalculan en cada corte de datos',
        altText: 'Tabla de audiencias con destino, objetivo y número de personas.',
      })],
    ],
  },
  {
    name: 'Experimentos y calidad', nav: 'Experimentos',
    title: 'Ambos tests favorecen a B, pero con muestras justas',
    subtitle: 'Implementar con grupo de control y volver a medir · estado de los datos integrados',
    pageSlicer: null,
    visuals: (k = kpiSlots(4)) => [
      ['kpi_kyc', k[0], () => kpiCard({ value: MS.liftKyc, label: 'Lift onboarding KYC', context: ['Experimentos', 'Contexto lift KYC'], glyph: 'A', dark: true })],
      ['kpi_email', k[1], () => kpiCard({ value: MS.liftEmail, label: 'Lift email de bienvenida', context: ['Experimentos', 'Contexto lift email'], glyph: 'B' })],
      ['kpi_fallas', k[2], () => kpiCard({ value: MS.fallas, label: 'Controles con falla o alerta', context: ['Calidad de datos', 'Contexto controles con falla'], glyph: '!' })],
      ['kpi_ok', k[3], () => kpiCard({ value: MS.controlesOk, label: 'Controles OK', context: ['Calidad de datos', 'Contexto controles OK'], glyph: '+' })],
      ['ab_table', rect(X0 + 440 + G, ROW.r2, CONTENT_W - 440 - G, ROW.r2H), () => tableVisual('tableEx', {
        roles: { Values: ['Test', 'Muestra A', 'Muestra B', 'Lift relativo', 'IC 95 inferior', 'IC 95 superior', 'p-valor', 'Efecto mínimo detectable', 'Decisión'].map((c) => col('Experimentos', c)) },
        hideTotals: true, fontSize: 10,
        title: 'Resultado y decisión de cada experimento',
        subtitle: 'El efecto observado es menor que el mínimo detectable en ambos tests',
        altText: 'Tabla de experimentos con muestras, lift, intervalo de confianza, p-valor, efecto mínimo detectable y decisión.',
      })],
      ['ab_rates', rect(X0, ROW.r2, 440, ROW.r2H), () => chartVisual('clusteredColumnChart', {
        roles: { Category: [col('Experimentos', 'Test')], Y: [MS.tasaA, MS.tasaB] },
        sort: sortBy(col('Experimentos', 'Test'), 'Ascending'),
        colors: [[MS.tasaA, C.gray], [MS.tasaB, C.orange]],
        title: 'Control (A) vs tratamiento (B)',
        subtitle: 'Tasa de la métrica de cada test',
        altText: 'Columnas agrupadas con la tasa de A y B en cada test.',
      })],
      ['quality', rect(X0, ROW.r3, CONTENT_W, ROW.r3H), () => tableVisual('tableEx', {
        roles: { Values: ['Tabla fuente', 'Control', 'Filas con falla', 'Filas evaluadas', 'Porcentaje de falla', 'Estado'].map((c) => col('Calidad de datos', c)) },
        sort: sortBy(col('Calidad de datos', 'Porcentaje de falla'), 'Descending'),
        fontColorBy: [[col('Calidad de datos', 'Estado'), ['Calidad de datos', 'Color estado calidad']]], hideTotals: true, rowPadding: 2,
        title: 'Controles de calidad sobre las fuentes integradas',
        subtitle: 'Las fallas se concentran en HubSpot: fuentes vacías, OFFLINE y duplicados',
        altText: 'Tabla de controles de calidad con filas con falla, porcentaje y estado.',
      })],
    ],
  },
];

// ---------- Menú lateral (igual en todas las páginas) ----------
function sidebar(page, pageIds) {
  const items = [
    ['sb_bg', rect(0, 0, SIDEBAR_W, H), () => shapeVisual(C.navy)],
    ['sb_logo', rect(68, 28, 160, 160), logoVisual],
    ['sb_title', rect(24, 204, 248, 32), () => textVisual([['Growth Analytics', { fontFamily: 'Segoe UI Semibold', fontSize: '20px', color: '#FFFFFF' }, 'center']], 'Nombre del tablero')],
    ['sb_sub', rect(24, 238, 248, 24), () => textVisual([['FinDemo · corte 30 sep 2026', { fontFamily: 'Segoe UI', fontSize: '12px', color: C.onDarkMuted }, 'center']], 'Fecha de corte')],
    ['sb_div', rect(24, 280, 248, 1), () => shapeVisual(C.navyLine)],
  ];
  PAGES.forEach((p, i) => {
    items.push([`sb_nav_${i}`, rect(24, 300 + i * 52, 248, 44), () => navButton(p.nav, pageIds[i], p === page)]);
  });
  items.push(['sb_filters_label', rect(24, 636, 248, 24), () => textVisual([['FILTROS', { fontFamily: 'Segoe UI Semibold', fontSize: '11px', color: C.onDarkMuted }]], 'Sección de filtros')]);
  items.push(['sb_year', rect(24, 664, 248, 80), () => slicerVisual(F.anio, 'Año')]);
  if (page.pageSlicer) items.push(['sb_page_slicer', rect(24, 760, 248, 80), () => slicerVisual(...page.pageSlicer)]);
  items.push(['sb_footer', rect(24, 1016, 248, 40), () => textVisual([
    ['Datos sintéticos de una fintech ficticia.', { fontFamily: 'Segoe UI', fontSize: '10px', color: C.onDarkMuted }],
    ['Proyecto de portafolio.', { fontFamily: 'Segoe UI', fontSize: '10px', color: C.onDarkMuted }],
  ], 'Nota sobre los datos')]);
  return items;
}

function header(page) {
  return [
    ['hd_title', rect(X0, ROW.header - 4, CONTENT_W, 48), () => textVisual([[page.title, { fontFamily: 'Segoe UI Semibold', fontSize: '26px', color: C.ink }]], `Título de la página: ${page.title}`)],
    ['hd_sub', rect(X0, ROW.header + 46, CONTENT_W, 28), () => textVisual([[page.subtitle, { fontFamily: 'Segoe UI', fontSize: '15px', color: C.muted }]], page.subtitle)],
  ];
}

// ---------- Escritura ----------
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function snap(r) {
  const s = (v) => Math.round(v);
  return { x: s(r.x), y: s(r.y), width: s(r.width), height: s(r.height) };
}

function buildPage(page, pageIds) {
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
  const items = [];
  for (const [vid, r, build] of [...sidebar(page, pageIds), ...header(page), ...page.visuals()]) {
    const visual = build();
    const ctx = visual.__context;
    delete visual.__context;
    items.push([vid, r, visual]);
    if (ctx) items.push([`${vid}_ctx`, rect(r.x + 16, r.y + r.height - 36, r.width - 32, 28), contextCard(ctx.context, ctx.dark)]);
  }
  items.forEach(([vid, r, visual], i) => {
    const visualId = id(page.name, vid);
    const z = (i + 1) * 1000;
    writeJson(path.join(dir, 'visuals', visualId, 'visual.json'), {
      $schema: SCHEMA.visual,
      name: visualId,
      position: { ...snap(r), z, tabOrder: z },
      visual,
    });
  });
  return items.length;
}

function buildTheme() {
  const theme = {
    name: THEME_FILE,
    dataColors: [C.navy, C.orange, C.steel, C.gray, '#2E7D5B', '#D64545', '#7FB3E6', '#F5B971'],
    background: C.card, foreground: C.ink, tableAccent: C.orange,
    good: '#2E7D5B', neutral: C.orange, bad: '#D64545',
    maximum: C.navy, center: C.steel, minimum: '#F4F7FB', null: '#C0C6D0',
    textClasses: {
      callout: { fontSize: 28, fontFace: 'Segoe UI Semibold', color: C.ink },
      title: { fontSize: 14, fontFace: 'Segoe UI Semibold', color: C.ink },
      header: { fontSize: 12, fontFace: 'Segoe UI Semibold', color: C.ink },
      label: { fontSize: 10, fontFace: 'Segoe UI', color: C.muted },
    },
    visualStyles: {
      '*': { '*': {
        border: [{ show: true, color: { solid: { color: C.line } }, radius: 12 }],
        dropShadow: [{ show: false }],
        padding: [{ top: 16, bottom: 16, left: 20, right: 20 }],
        visualHeader: [{ show: false }],
      } },
      lineChart: { '*': {
        lineStyles: [{ strokeWidth: 3, lineChartType: 'smooth' }],
        categoryAxis: [{ showAxisTitle: false, gridlineShow: false, labelColor: { solid: { color: C.muted } } }],
        valueAxis: [{ showAxisTitle: false, gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.line } }, labelColor: { solid: { color: C.muted } } }],
      } },
      barChart: { '*': {
        labels: [{ show: true, fontSize: 10, color: { solid: { color: C.ink } } }],
        valueAxis: [{ show: false, gridlineShow: false }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } }, fontSize: 11 }],
        legend: [{ show: false }],
      } },
      clusteredBarChart: { '*': {
        labels: [{ show: false }],
        valueAxis: [{ show: true, showAxisTitle: false, gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.line } }, labelColor: { solid: { color: C.muted } } }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } }, fontSize: 11 }],
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
      } },
      clusteredColumnChart: { '*': {
        labels: [{ show: true, fontSize: 11, color: { solid: { color: C.ink } } }],
        valueAxis: [{ show: false, gridlineShow: false }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
      } },
      lineClusteredColumnComboChart: { '*': {
        legend: [{ show: true, position: 'Top', labelColor: { solid: { color: C.muted } } }],
        categoryAxis: [{ showAxisTitle: false, labelColor: { solid: { color: C.muted } } }],
        valueAxis: [{ showAxisTitle: false, gridlineStyle: 'dotted', gridlineColor: { solid: { color: C.line } }, labelColor: { solid: { color: C.muted } } }],
      } },
      funnel: { '*': {
        labels: [{ show: true, color: { solid: { color: '#FFFFFF' } } }],
      } },
      slicer: { '*': {
        header: [{ fontFamily: 'Segoe UI Semibold', textSize: 10, fontColor: { solid: { color: C.ink } } }],
        items: [{ fontFamily: 'Segoe UI', textSize: 10, fontColor: { solid: { color: C.ink } } }],
      } },
    },
  };
  fs.mkdirSync(RES_DIR, { recursive: true });
  for (const f of fs.readdirSync(RES_DIR)) {
    if (f.endsWith('.json') && f !== THEME_FILE) fs.rmSync(path.join(RES_DIR, f));
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
    items: [
      { name: THEME_FILE, path: THEME_FILE, type: 'CustomTheme' },
      { name: LOGO_FILE, path: LOGO_FILE, type: 'Image' },
    ],
  });
  report.settings = { ...report.settings, hideVisualContainerHeader: true };
  writeJson(reportFile, report);
}

function main() {
  fs.rmSync(PAGES_DIR, { recursive: true, force: true });
  const pageIds = PAGES.map((p) => id('page', p.name));
  const counts = PAGES.map((p) => buildPage(p, pageIds));
  writeJson(path.join(PAGES_DIR, 'pages.json'), { $schema: SCHEMA.pages, pageOrder: pageIds, activePageName: pageIds[0] });
  buildTheme();
  console.log(`${pageIds.length} páginas, ${counts.reduce((a, b) => a + b, 0)} visuales escritos en ${PAGES_DIR}`);
}

main();
