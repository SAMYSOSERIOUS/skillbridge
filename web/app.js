/* SkillBridge frontend (M0 stub).
   Hard rule 4: every number here comes from the API - no in-browser math
   beyond formatting. Design contract: docs/05_DESIGN.md. */

const $ = (id) => document.getElementById(id);

const tokens = getComputedStyle(document.documentElement);
const T = (name) => tokens.getPropertyValue(name).trim();

const fmtWage = (n) =>
  `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}/yr`;

async function api(path) {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || "Something went wrong. Try again.");
  return body;
}

async function findMoves(query) {
  const errEl = $("search-error");
  errEl.hidden = true;
  try {
    const search = await api(`/api/occupations?q=${encodeURIComponent(query)}`);
    if (!search.results.length) {
      throw new Error("We couldn't match that job title - try a broader one.");
    }
    const soc = search.results[0].soc_code;
    const [trans, exposure] = await Promise.all([
      api(`/api/transitions/${soc}`),
      api(`/api/exposure/${soc}`),
    ]);
    renderResults(trans, exposure);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
  }
}

function renderResults(trans, exposure) {
  $("results").hidden = false;
  $("synthetic-note").hidden = !trans.synthetic;
  renderChart(trans);
  renderBestMove(trans);
  renderExposure(exposure);
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChart(trans) {
  const dominated = trans.transitions.filter((t) => !t.pareto);
  const frontier = trans.transitions
    .filter((t) => t.pareto)
    .sort((a, b) => a.skill_gap - b.skill_gap);

  const traces = [
    {
      x: dominated.map((t) => t.skill_gap),
      y: dominated.map((t) => t.wage_delta),
      text: dominated.map((t) => t.to_title),
      mode: "markers",
      type: "scatter",
      name: "Other moves",
      marker: { color: T("--dot-dominated"), size: 9 },
      hovertemplate: "%{text}<br>%{y:$,.0f}/yr<extra></extra>",
    },
    {
      x: frontier.map((t) => t.skill_gap),
      y: frontier.map((t) => t.wage_delta),
      text: frontier.map((t) => t.to_title),
      mode: "markers+lines",
      type: "scatter",
      name: "Pareto frontier",
      line: { color: T("--accent"), dash: "dash", width: 1 },
      marker: { color: T("--accent"), size: 12 },
      hovertemplate: "%{text}<br>%{y:$,.0f}/yr<extra></extra>",
    },
  ];

  Plotly.newPlot(
    "frontier-chart",
    traces,
    {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: T("--text-3"), size: 12 },
      xaxis: { title: "Retraining effort", gridcolor: T("--border"), zeroline: false },
      yaxis: { title: "Pay gain ($/yr)", gridcolor: T("--border"), zeroline: false },
      margin: { l: 60, r: 16, t: 8, b: 44 },
      showlegend: false,
      height: 340,
    },
    { displayModeBar: false, responsive: true }
  );
}

function renderBestMove(trans) {
  const best = trans.transitions
    .filter((t) => t.pareto && t.feasible)
    .sort((a, b) => a.skill_gap - b.skill_gap)[0];
  if (!best) return;
  $("best-move").innerHTML = `
    <p class="label">Best move</p>
    <p class="title">${best.to_title}</p>
    <p class="wage">${fmtWage(best.wage_delta)}</p>
    <p class="meta">AI risk ${best.exposure_delta < 0 ? "↓ lower" : "↑ higher"}</p>
  `;
}

function renderExposure(exposure) {
  const e = exposure.exposure;
  const bars = [e.aioe, e.openai, e.msft]
    .map((v) => `<div class="bar" style="height:${Math.round(v * 100)}%"></div>`)
    .join("");
  $("exposure-panel").innerHTML = `
    <p class="panel-label">AI exposure today - three independent sources</p>
    <div class="bars">${bars}</div>
    <div class="sources"><span>AIOE</span><span>OpenAI</span><span>Microsoft</span></div>
    <p class="agreement ${e.agreement ? "" : "disagree"}">
      ${e.agreement ? "3 sources agree" : "Sources disagree - read with care"}
    </p>
  `;
}

$("search-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const q = $("search-input").value.trim();
  if (!q) {
    $("search-error").textContent = "Enter a job title first.";
    $("search-error").hidden = false;
    return;
  }
  findMoves(q);
});

$("try-demo").addEventListener("click", () => {
  $("search-input").value = "Bank Teller";
  findMoves("Bank Teller");
});
