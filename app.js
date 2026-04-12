const INITIAL = [
  { jugador: "Javier", anot: 7, fall: 3 },
  { jugador: "Emilio", anot: 15, fall: 5 },
  { jugador: "Rafael", anot: 15, fall: 10 },
  { jugador: "Antonio", anot: 40, fall: 10 },
  { jugador: "Tomás", anot: 75, fall: 25 },
  { jugador: "Camilo", anot: 80, fall: 120 },
];

const data = INITIAL.map((d) => {
  const total = d.anot + d.fall;
  return {
    jugador: d.jugador,
    origAnot: d.anot,
    origFall: d.fall,
    origTotal: total,
    lanz: total,
  };
});

function scaledValues(d) {
  const t = d.lanz;
  if (d.origTotal <= 0) return { anot: 0, fall: 0, lanz: 0 };
  const rawA = (d.origAnot / d.origTotal) * t;
  const anot = Math.round(rawA);
  const fall = Math.max(0, t - anot);
  return { anot, fall, lanz: t };
}

/** Dimensiones compactas para ver tabla + gráfico cómodo en HD (1080p) */
const SVG_W = 680;
const SVG_H = 210;
const margin = { top: 6, right: 8, bottom: 32, left: 34 };
const width = SVG_W - margin.left - margin.right;
const height = SVG_H - margin.top - margin.bottom;
const HANDLE_H = 8;
const MIN_LANZ = 1;
const MAX_LANZ = 400;
const Y_PAD = 1.08;

const tbody = d3.select("#tabla-body");
const chartTitle = d3.select("#chart-title");

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
  .attr("width", "100%")
  .attr("height", SVG_H)
  .attr("preserveAspectRatio", "xMidYMid meet");

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3
  .scaleBand()
  .domain(data.map((d) => d.jugador))
  .range([0, width])
  .padding(0.26);

let y = d3.scaleLinear().domain([0, 200]).nice().range([height, 0]);

const xAxis = g.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`);
const yAxisG = g.append("g").attr("class", "axis");

xAxis.call(d3.axisBottom(x).tickSizeOuter(0));
xAxis.selectAll("text").attr("class", "x-label");

const bars = g.append("g").attr("class", "bars");

/** Jugador con barra seleccionada (clic); flechas ↑/↓ ajustan lanzamientos */
let selectedJugador = null;

function yMax() {
  return d3.max(data, (d) => d.lanz) * Y_PAD || 200;
}

function updateYScale() {
  y = d3.scaleLinear().domain([0, yMax()]).nice().range([height, 0]);
  yAxisG.transition().duration(150).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
}

function setTableDragFocus(jugador) {
  tbody.selectAll("tr").classed("row-drag-focus", (d) => d.jugador === jugador);
}

function clearTableDragFocus() {
  tbody.selectAll("tr").classed("row-drag-focus", false);
}

function updateTable() {
  const rows = tbody.selectAll("tr").data(data, (d) => d.jugador);
  const enter = rows.enter().append("tr");
  enter.append("td").attr("class", "jugador");
  enter.append("td").attr("class", "num anot");
  enter.append("td").attr("class", "num fall");
  enter.append("td").attr("class", "num lanz");
  const all = enter.merge(rows);
  all.attr("data-jugador", (d) => d.jugador);
  all.select(".jugador").text((d) => d.jugador);
  all.select(".anot").text((d) => scaledValues(d).anot);
  all.select(".fall").text((d) => scaledValues(d).fall);
  all.select(".lanz").text((d) => scaledValues(d).lanz);
}

function allHundred() {
  return data.length && data.every((d) => d.lanz === 100);
}

function updateTitle() {
  chartTitle.text(
    allHundred()
      ? "Anotaciones y Fallos (100 lanzamientos)"
      : "Anotaciones y Fallos"
  );
}

function barPositions(d) {
  const { anot, fall, lanz } = scaledValues(d);
  const bw = x.bandwidth();
  const x0 = x(d.jugador);
  const yTot = y(lanz);
  const yAnotTop = y(anot);
  const yFallTop = y(anot + fall);
  return { x0, bw, yTot, yAnotTop, yFallTop, lanz, anot, fall };
}

const drag = d3
  .drag()
  .on("start", function (event, d) {
    selectedJugador = d.jugador;
    setTableDragFocus(d.jugador);
    event.sourceEvent?.preventDefault?.();
  })
  .on("drag", function (event, d) {
    const [, py] = d3.pointer(event, g.node());
    const newLanz = Math.round(y.invert(py));
    d.lanz = Math.max(MIN_LANZ, Math.min(MAX_LANZ, newLanz));
    updateTable();
    setTableDragFocus(d.jugador);
    updateTitle();
    drawBars();
  })
  .on("end", function () {
    clearTableDragFocus();
  });

d3.select("#chart").on("click", function (event) {
  if (!event.target.closest(".bar-group")) {
    selectedJugador = null;
    clearTableDragFocus();
    drawBars();
  }
});

document.addEventListener("keydown", function (e) {
  if (!selectedJugador) return;
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    const row = data.find((x) => x.jugador === selectedJugador);
    if (!row) return;
    const delta = e.key === "ArrowUp" ? 1 : -1;
    row.lanz = Math.max(MIN_LANZ, Math.min(MAX_LANZ, row.lanz + delta));
    updateTable();
    setTableDragFocus(selectedJugador);
    updateTitle();
    drawBars();
  } else if (e.key === "Escape") {
    e.preventDefault();
    selectedJugador = null;
    clearTableDragFocus();
    drawBars();
  }
});

function drawBars() {
  updateYScale();

  const sel = bars.selectAll("g.bar-group").data(data, (d) => d.jugador);

  const enter = sel.enter().append("g").attr("class", "bar-group");

  enter.append("rect").attr("class", "bar-anot");
  enter.append("rect").attr("class", "bar-fall");
  enter.append("rect").attr("class", "drag-handle").call(drag);

  const merged = enter.merge(sel);

  merged.classed("bar-group--selected", (d) => d.jugador === selectedJugador);

  merged.on("click", function (event, d) {
    event.stopPropagation();
    selectedJugador = d.jugador;
    setTableDragFocus(d.jugador);
    drawBars();
  });

  merged.each(function (d) {
    const p = barPositions(d);
    const gEl = d3.select(this);
    gEl
      .select(".bar-anot")
      .attr("x", p.x0)
      .attr("width", p.bw)
      .attr("y", p.yAnotTop)
      .attr("height", height - p.yAnotTop);
    gEl
      .select(".bar-fall")
      .attr("x", p.x0)
      .attr("width", p.bw)
      .attr("y", p.yFallTop)
      .attr("height", p.yAnotTop - p.yFallTop);
    const hy = Math.max(p.yTot - HANDLE_H, 0);
    gEl
      .select(".drag-handle")
      .attr("x", p.x0)
      .attr("width", p.bw)
      .attr("y", hy)
      .attr("height", HANDLE_H);
  });
}

function restoreOriginals() {
  data.forEach((d) => {
    d.lanz = d.origTotal;
  });
  selectedJugador = null;
  clearTableDragFocus();
  updateTable();
  updateTitle();
  drawBars();
}

document.getElementById("btn-restore").addEventListener("click", restoreOriginals);

updateTable();
updateTitle();
drawBars();
