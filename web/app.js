/* SkillBridge frontend.
   Hard rule 4: every number here comes from the API - no in-browser math
   beyond formatting. Design contract: docs/05_DESIGN.md. */

const $ = (id) => document.getElementById(id);
const tokens = getComputedStyle(document.documentElement);
const T = (name) => tokens.getPropertyValue(name).trim();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const fmtSigned = (n) =>
  `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}/yr`;
const fmtWage = (n) => `$${Math.round(n).toLocaleString("en-US")}/yr`;
const pct = (x) => `${Math.round(x * 100)}`;

let current = { originSoc: null, originTitle: "", transitions: [] };

async function api(path) {
  let res;
  try {
    res = await fetch(path);
  } catch {
    throw new Error("Can't reach the SkillBridge server. Is `make app` running?");
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || "Something went wrong. Try again.");
  return body;
}

/* ---------- Search + autocomplete ---------- */

const input = $("search-input");
const list = $("autocomplete");
let acItems = [];
let acIndex = -1;
let acTimer = null;

function hideAc() {
  list.hidden = true;
  input.setAttribute("aria-expanded", "false");
  acIndex = -1;
}

function renderAc(results) {
  acItems = results;
  list.innerHTML = "";
  if (!results.length) return hideAc();
  for (const [i, r] of results.entries()) {
    const li = document.createElement("li");
    li.role = "option";
    li.textContent = r.display_title;
    if (!r.servable) li.classList.add("unservable");
    const soc = document.createElement("span");
    soc.className = "soc";
    soc.textContent = r.soc_code;
    li.appendChild(soc);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pick(i);
    });
    list.appendChild(li);
  }
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function pick(i) {
  const r = acItems[i];
  if (!r) return;
  input.value = r.display_title;
  hideAc();
  loadOccupation(r.soc_code);
}

input.addEventListener("input", () => {
  clearTimeout(acTimer);
  const q = input.value.trim();
  if (q.length < 2) return hideAc();
  acTimer = setTimeout(async () => {
    try {
      const body = await api(`/api/occupations?q=${encodeURIComponent(q)}`);
      renderAc(body.results);
    } catch {
      hideAc();
    }
  }, 150);
});

input.addEventListener("keydown", (e) => {
  if (list.hidden) return;
  const items = list.querySelectorAll("li");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    acIndex =
      e.key === "ArrowDown"
        ? Math.min(acIndex + 1, items.length - 1)
        : Math.max(acIndex - 1, 0);
    items.forEach((li, i) => li.classList.toggle("active", i === acIndex));
  } else if (e.key === "Enter" && acIndex >= 0) {
    e.preventDefault();
    pick(acIndex);
  } else if (e.key === "Escape") {
    hideAc();
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-box")) hideAc();
});

$("search-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideAc();
  const q = input.value.trim();
  if (!q) return showError("Enter a job title first.");
  try {
    const body = await api(`/api/occupations?q=${encodeURIComponent(q)}`);
    if (!body.results.length) {
      throw new Error("We couldn't match that job title - try a broader one.");
    }
    const servable = body.results.find((r) => r.servable) || body.results[0];
    input.value = servable.display_title;
    loadOccupation(servable.soc_code);
  } catch (e) {
    showError(e.message);
  }
});

$("try-demo").addEventListener("click", async () => {
  input.value = "Bank Teller";
  try {
    const body = await api(`/api/occupations?q=teller`);
    const hit = body.results.find((r) => r.servable);
    if (!hit) throw new Error("Demo occupation unavailable in this dataset.");
    loadOccupation(hit.soc_code);
  } catch (e) {
    showError(e.message);
  }
});

function showError(msg) {
  const el = $("search-error");
  el.textContent = msg;
  el.hidden = false;
}

/* ---------- Results ---------- */

function skeletons() {
  $("results").hidden = false;
  $("best-move").innerHTML =
    '<div class="skeleton" style="height:20px;width:60%"></div><div class="skeleton" style="height:34px;margin-top:10px"></div>';
  $("exposure-panel").innerHTML = '<div class="skeleton" style="height:90px"></div>';
  $("routes").innerHTML = '<div class="skeleton" style="height:40px"></div>';
}

async function loadOccupation(soc) {
  $("search-error").hidden = true;
  skeletons();
  try {
    const [trans, exposure, paths] = await Promise.all([
      api(`/api/transitions/${soc}`),
      api(`/api/exposure/${soc}`),
      api(`/api/paths/${soc}`),
    ]);
    current = {
      originSoc: soc,
      originTitle: trans.origin.display_title,
      transitions: trans.transitions,
    };
    renderResults(trans, exposure, paths);
  } catch (e) {
    $("results").hidden = true;
    showError(e.message);
  }
}

function renderResults(trans, exposure, paths) {
  $("results").hidden = false;
  $("synthetic-note").hidden = !trans.synthetic;
  const o = trans.origin;
  $("results-title").textContent = o.display_title;
  const bits = [];
  if (o.wage_median != null) bits.push(`median ${fmtWage(o.wage_median)}`);
  if (o.job_zone != null) bits.push(`education zone ${o.job_zone} of 5`);
  bits.push(`${trans.transitions.length} realistic moves analyzed`);
  $("results-sub").textContent = bits.join(" · ");
  renderChart(trans);
  renderBestMove(trans);
  renderExposure(exposure);
  renderRoutes(paths);
  $("results").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

function renderChart(trans) {
  const dominated = trans.transitions.filter((t) => !t.pareto);
  const frontier = trans.transitions
    .filter((t) => t.pareto)
    .sort((a, b) => a.skill_gap - b.skill_gap);
  const envelope = frontier.filter((t) => t.pareto2d);

  const hover =
    "<b>%{text}</b><br>Pay: %{y:$,.0f}/yr vs today<br>" +
    "Retraining effort: %{x:.2f}<br>%{customdata}<extra></extra>";
  const expNote = (t) =>
    t.exposure_delta < 0 ? "AI risk: lower" : t.exposure_delta > 0 ? "AI risk: higher" : "AI risk: same";

  const traces = [
    {
      x: dominated.map((t) => t.skill_gap),
      y: dominated.map((t) => t.wage_delta),
      text: dominated.map((t) => t.to_title),
      customdata: dominated.map(expNote),
      soc: dominated.map((t) => t.to_soc),
      mode: "markers",
      type: "scatter",
      marker: { color: T("--dot-dominated"), size: 7, opacity: 0.75 },
      hovertemplate: hover,
    },
    {
      x: envelope.map((t) => t.skill_gap),
      y: envelope.map((t) => t.wage_delta),
      mode: "lines",
      type: "scatter",
      line: { color: T("--accent"), dash: "dash", width: 1.5, shape: "spline" },
      opacity: 0.55,
      hoverinfo: "skip",
      soc: [],
    },
    {
      x: frontier.map((t) => t.skill_gap),
      y: frontier.map((t) => t.wage_delta),
      text: frontier.map((t) => t.to_title),
      customdata: frontier.map(expNote),
      soc: frontier.map((t) => t.to_soc),
      mode: "markers",
      type: "scatter",
      marker: {
        color: T("--accent"),
        size: 11,
        line: { color: T("--accent-dim"), width: 6 },
      },
      hovertemplate: hover,
    },
  ];

  const chart = $("frontier-chart");
  chart.classList.remove("revealed");
  Plotly.newPlot(
    chart,
    traces,
    {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: T("--text-3"), size: 12 },
      xaxis: { title: "Retraining effort →", gridcolor: T("--border"), zeroline: false },
      yaxis: {
        title: "Pay gain ($/yr)",
        gridcolor: T("--border"),
        zerolinecolor: T("--border-strong"),
        tickprefix: "$",
      },
      margin: { l: 70, r: 16, t: 8, b: 48 },
      showlegend: false,
      height: 380,
      hoverlabel: {
        bgcolor: T("--surface-2"),
        bordercolor: T("--border-strong"),
        font: { color: T("--text"), size: 12 },
      },
    },
    { displayModeBar: false, responsive: true }
  ).then(() => {
    requestAnimationFrame(() => chart.classList.add("revealed"));
  });

  chart.on("plotly_click", (ev) => {
    const p = ev.points[0];
    const soc = p.data.soc[p.pointIndex];
    if (soc) openBom(current.originSoc, soc);
  });
}

function renderBestMove(trans) {
  const best = trans.best_move;
  if (!best) {
    $("best-move").innerHTML =
      '<p class="label">Best move</p><p class="meta">No frontier move with a pay gain was found for this occupation.</p>';
    return;
  }
  $("best-move").innerHTML = `
    <p class="label">Best move</p>
    <p class="title">${best.to_title}</p>
    <p class="wage" id="best-wage">${fmtSigned(best.wage_delta)}</p>
    <p class="meta">AI risk ${best.exposure_delta < 0 ? "↓ lower" : "↑ higher"} · on the frontier</p>
    <button class="open-bom" id="best-bom">Which skills do I need?</button>
  `;
  $("best-bom").addEventListener("click", () => openBom(current.originSoc, best.to_soc));
}

function renderExposure(exposure) {
  const e = exposure.exposure;
  const entries = [
    ["AIOE", e.aioe],
    ["OpenAI", e.openai],
    ["Microsoft", e.msft],
  ];
  const bars = entries
    .map(
      ([, v]) =>
        `<div class="bar" style="height:${v == null ? 4 : Math.max(4, Math.round(v * 100))}%"></div>`
    )
    .join("");
  const pcts = entries
    .map(([, v]) => `<span>${v == null ? "n/a" : pct(v) + "th"}</span>`)
    .join("");
  const names = entries.map(([n]) => `<span>${n}</span>`).join("");
  $("exposure-panel").innerHTML = `
    <p class="panel-label">AI exposure today - three independent sources (percentile)</p>
    <div class="bars">${bars}</div>
    <div class="sources">${names}</div>
    <div class="pcts">${pcts}</div>
    <p class="agreement ${e.agreement ? "" : "disagree"}">
      ${e.agreement ? "Sources agree." : "Sources disagree - read with care."}
    </p>
  `;
}

function renderRoutes(pathsBody) {
  const routes = pathsBody.paths.slice(0, 4);
  if (!routes.length) {
    $("routes").innerHTML = '<p class="hint">No multi-step routes found.</p>';
    return;
  }
  $("routes").innerHTML = routes
    .map((p) => {
      const hops = p.hops
        .map((h, i) => {
          const cls = i === 0 ? "first" : i === p.hops.length - 1 ? "last" : "";
          return `<span class="hop ${cls}" title="median ${fmtWage(h.wage_median)}">${h.title}</span>`;
        })
        .join('<span class="arrow">→</span>');
      return `<div class="route">${hops}<span class="gain">${fmtSigned(p.cumulative_wage_delta)}</span></div>`;
    })
    .join("");
}

/* ---------- BOM drawer ---------- */

function tierBlock(name, cls, items, note) {
  const rows = items.length
    ? items
        .map(
          (s) => `
      <div class="skill-row">
        <div class="skill-head"><span>${s.skill}</span>
          <span class="lv">${s.origin_level} → ${s.target_level}</span></div>
        <div class="gap-track"><div class="gap-fill" style="width:${Math.min(100, Math.round((s.gap / 100) * 100))}%"></div></div>
      </div>`
        )
        .join("")
    : `<p class="empty-tier">${note}</p>`;
  return `<div class="tier ${cls}"><h3>${name}</h3>${rows}</div>`;
}

async function openBom(fromSoc, toSoc) {
  const drawer = $("drawer");
  const backdrop = $("backdrop");
  drawer.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("open"));
  $("drawer-content").innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const b = await api(`/api/bom/${fromSoc}/${toSoc}`);
    const expLine =
      b.exposure_delta == null
        ? ""
        : `<p class="exp">AI exposure ${b.exposure_delta < 0 ? "↓ lower" : "↑ higher"} (${b.exposure_delta > 0 ? "+" : ""}${Math.round(b.exposure_delta * 100)} percentile points)</p>`;
    $("drawer-content").innerHTML = `
      <h2>Skill gap: your bill of materials</h2>
      <p class="pair">${b.from_title} → ${b.to_title}</p>
      <p class="wage" id="bom-wage">${b.wage_delta == null ? "" : fmtSigned(b.wage_delta)}</p>
      ${expLine}
      ${tierBlock("✅ You already have", "transferable", b.transferable, "Nothing at target level yet.")}
      ${tierBlock("🟡 Needs upgrading", "upgrade", b.upgrade, "Nothing to upgrade.")}
      ${tierBlock("🔴 Must learn", "acquire", b.acquire, "Nothing brand new to learn.")}
      <a class="share" href="/api/card/${fromSoc}/${toSoc}" download>Download my escape plan card</a>
      <p class="hint">Levels are O*NET scores (0-100). Estimates from public data - not career advice.</p>
    `;
    countUp($("bom-wage"), b.wage_delta);
  } catch (e) {
    $("drawer-content").innerHTML = `<h2>Skill gap</h2><p class="pair">${e.message}</p>`;
  }
}

function countUp(el, target) {
  if (!el || target == null || reducedMotion) return;
  const t0 = performance.now();
  const dur = 500;
  function tick(now) {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = fmtSigned(target * (0.3 + 0.7 * k));
    if (k < 1) requestAnimationFrame(tick);
    else el.textContent = fmtSigned(target);
  }
  requestAnimationFrame(tick);
}

function closeBom() {
  const drawer = $("drawer");
  drawer.classList.remove("open");
  $("backdrop").hidden = true;
  setTimeout(() => (drawer.hidden = true), reducedMotion ? 0 : 220);
}
$("drawer-close").addEventListener("click", closeBom);
$("backdrop").addEventListener("click", closeBom);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("drawer").hidden) closeBom();
});

/* ---------- Transparency build info ---------- */

(async () => {
  try {
    const m = await api("/api/meta");
    const parts = [];
    if (m.mode === "sample") {
      parts.push("Running in demo mode on a synthetic fixture.");
    } else {
      parts.push(`Built ${m.built_at ? m.built_at.slice(0, 10) : "n/a"}.`);
      parts.push(
        `${m.occupations_serving} occupations served, ${Number(m.transitions).toLocaleString("en-US")} transitions scored, ${Number(m.pareto_moves).toLocaleString("en-US")} on frontiers.`
      );
      parts.push("Formulas and thresholds: config.yaml in the repository.");
    }
    $("meta-build").textContent = parts.join(" ");
  } catch {
    $("meta-build").textContent = "Build info unavailable.";
  }
})();
