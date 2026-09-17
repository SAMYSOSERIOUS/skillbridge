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
const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
};
const pctile = (x) => ordinal(Math.round(x * 100));

let current = { originSoc: null, originTitle: "", transitions: [] };

/* Static edition (GitHub Pages): the same "API" answered from precomputed
   JSON exported by skillbridge.export_static. Everything shown was computed
   server-side by the pipeline; the only client-side computation is the BOM
   tier split from precomputed skill levels (documented deviation,
   docs/03_ARCHITECTURE.md §5). */
const STATIC = !!window.SB_STATIC;
const staticCache = {};

async function staticFetch(name) {
  if (!(name in staticCache)) {
    const res = await fetch(`./data/${name}.json`);
    if (!res.ok) throw new Error("MISSING");
    staticCache[name] = await res.json();
  }
  return staticCache[name];
}

const NOT_FOUND = "We couldn't match that occupation. Try a broader job title.";

async function staticApi(path) {
  const [p, queryStr] = path.split("?");
  const seg = p.split("/").filter(Boolean); // ["api", endpoint, ...args]
  const endpoint = seg[1];

  if (endpoint === "occupations") {
    const occs = await staticFetch("occupations");
    const q = new URLSearchParams(queryStr || "").get("q") || "";
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const scored = [];
    for (const o of Object.values(occs)) {
      const hay = `${o.title} ${o.display_title}`.toLowerCase();
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (tokens.length && hits === 0) continue;
      scored.push([hits * 1e12 + (o.employment || 0), o]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return {
      query: q,
      results: scored.slice(0, 8).map(([, o]) => ({
        soc_code: o.soc_code,
        title: o.title,
        display_title: o.display_title,
        servable: o.servable,
      })),
    };
  }

  if (endpoint === "transitions" || endpoint === "paths") {
    const soc = seg[2];
    const occs = await staticFetch("occupations");
    const occ = occs[soc];
    if (!occ) throw new Error(NOT_FOUND);
    if (!occ.servable) {
      throw new Error(`'${occ.title}' can't be analyzed: ${occ.excluded_reason}.`);
    }
    let bundle;
    try {
      bundle = await staticFetch(`origins/${soc}`);
    } catch {
      throw new Error(NOT_FOUND);
    }
    if (endpoint === "paths") {
      return { origin_soc: soc, paths: bundle.paths, synthetic: false };
    }
    return bundle;
  }

  if (endpoint === "exposure") {
    const occs = await staticFetch("occupations");
    const occ = occs[seg[2]];
    if (!occ) throw new Error(NOT_FOUND);
    if (!occ.exposure) throw new Error(`No AI-exposure data for '${occ.title}'.`);
    return {
      soc_code: occ.soc_code,
      display_title: occ.display_title,
      exposure: occ.exposure,
      synthetic: false,
    };
  }

  if (endpoint === "bom") {
    const [fromSoc, toSoc] = [seg[2], seg[3]];
    const [occs, skills, config] = await Promise.all([
      staticFetch("occupations"),
      staticFetch("skills"),
      staticFetch("config"),
    ]);
    const origin = occs[fromSoc];
    const target = occs[toSoc];
    if (!origin || !target) throw new Error(NOT_FOUND);
    const ov = skills[fromSoc];
    const tv = skills[toSoc];
    if (!ov || !tv) {
      throw new Error(
        "One of these occupations has no O*NET skill profile (residual category)."
      );
    }
    const cfg = config.bom;
    const tiers = { transferable: [], upgrade: [], acquire: [] };
    for (const skill of Object.keys(tv).sort()) {
      const tIm = tv[skill][0];
      if (tIm < cfg.relevant_importance_min) continue;
      const oLv = (ov[skill] || [0, 0])[1];
      const tLv = tv[skill][1];
      const gap = Math.max(0, tLv - oLv);
      const entry = {
        skill,
        origin_level: Math.round(oLv * 1000) / 10,
        target_level: Math.round(tLv * 1000) / 10,
        gap: Math.round(gap * 1000) / 10,
        weighted_gap: gap * tIm,
      };
      if (oLv >= tLv - cfg.transferable_tolerance) tiers.transferable.push(entry);
      else if (oLv >= cfg.upgrade_floor_ratio * tLv) tiers.upgrade.push(entry);
      else tiers.acquire.push(entry);
    }
    for (const t of Object.values(tiers)) t.sort((a, b) => b.weighted_gap - a.weighted_gap);
    return {
      from_title: origin.display_title,
      to_title: target.display_title,
      wage_delta:
        origin.wage_median != null && target.wage_median != null
          ? target.wage_median - origin.wage_median
          : null,
      exposure_delta:
        origin.exposure && target.exposure
          ? Math.round((target.exposure.composite - origin.exposure.composite) * 1000) / 1000
          : null,
      ...tiers,
      synthetic: false,
    };
  }

  if (endpoint === "meta") {
    const config = await staticFetch("config");
    return { mode: "real", synthetic: false, ...config.meta };
  }

  throw new Error("Something went wrong. Try again.");
}

async function api(path) {
  if (STATIC) return staticApi(path);
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
  const close = trans.best_close;
  if (!best) {
    $("best-move").innerHTML =
      '<p class="label">Best moves</p><p class="meta">No frontier move with a pay gain was found for this occupation.</p>';
    return;
  }
  const pick = (id, kind, t, metaText) => `
    <button class="pick" id="${id}">
      <p class="kind">${kind}</p>
      <p class="title">${t.to_title}</p>
      <p class="wage">${fmtSigned(t.wage_delta)}</p>
      <p class="meta">${metaText} · click for the skill checklist</p>
    </button>`;
  let html = `<p class="label">Best moves on your frontier</p>`;
  html += pick(
    "best-bom",
    "🚀 Biggest win",
    best,
    `AI risk ${best.exposure_delta < 0 ? "↓ lower" : "↑ higher"} · most ambitious`
  );
  if (close) {
    html += pick(
      "close-bom",
      "🎯 Closest win",
      close,
      `AI risk ${close.exposure_delta < 0 ? "↓ lower" : "↑ higher"} · least retraining`
    );
  }
  $("best-move").innerHTML = html;
  $("best-bom").addEventListener("click", () => openBom(current.originSoc, best.to_soc));
  if (close) {
    $("close-bom").addEventListener("click", () => openBom(current.originSoc, close.to_soc));
  }
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
        `<div class="bar" data-h="${v == null ? 4 : Math.max(4, Math.round(v * 100))}"></div>`
    )
    .join("");
  const pcts = entries
    .map(([, v]) => `<span>${v == null ? "n/a" : pctile(v)}</span>`)
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
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const bar of document.querySelectorAll(".exposure-panel .bar")) {
        bar.style.height = `${bar.dataset.h}%`;
      }
    })
  );
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
        <div class="gap-track"><div class="gap-fill" data-w="${Math.min(100, Math.round((s.gap / 100) * 100))}"></div></div>
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
      ${
        STATIC
          ? '<button class="share" id="share-card">Download my escape plan card</button>'
          : `<a class="share" href="/api/card/${fromSoc}/${toSoc}" download>Download my escape plan card</a>`
      }
      <p class="hint">Levels are O*NET scores (0-100). Estimates from public data - not career advice.</p>
    `;
    if (STATIC) {
      $("share-card").addEventListener("click", () => downloadCard(b, fromSoc, toSoc));
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const bar of document.querySelectorAll(".drawer .gap-fill")) {
          bar.style.width = `${bar.dataset.w}%`;
        }
      })
    );
    countUp($("bom-wage"), b.wage_delta);
  } catch (e) {
    $("drawer-content").innerHTML = `<h2>Skill gap</h2><p class="pair">${e.message}</p>`;
  }
}

function downloadCard(b, fromSoc, toSoc) {
  /* Canvas render of the escape-plan card (static edition; mirrors
     python/skillbridge/cards/render.py and the styles.css tokens). */
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext("2d");
  const font = (px, w = 400) => `${w} ${px}px Inter, system-ui, sans-serif`;

  ctx.fillStyle = T("--bg");
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = T("--text-2");
  ctx.font = font(22, 500);
  ctx.fillText("SKILLBRIDGE", 60, 70);

  ctx.font = font(26);
  ctx.fillText("My career escape plan", 60, 160);

  const headline = `${b.from_title}  →  ${b.to_title}`;
  let size = 44;
  ctx.font = font(size, 500);
  while (size > 22 && ctx.measureText(headline).width > 560) {
    size -= 2;
    ctx.font = font(size, 500);
  }
  ctx.fillStyle = T("--text");
  ctx.fillText(headline, 60, 215);

  ctx.fillStyle = T("--accent");
  ctx.font = font(64, 500);
  ctx.fillText(b.wage_delta == null ? "wage: n/a" : fmtSigned(b.wage_delta), 60, 330);

  if (b.exposure_delta != null) {
    ctx.fillStyle = T("--text-2");
    ctx.font = font(26);
    const arrow = b.exposure_delta < 0 ? "lower" : "higher";
    const pts = Math.round(b.exposure_delta * 100);
    ctx.fillText(`AI exposure: ${arrow} (${pts >= 0 ? "+" : ""}${pts} percentile points)`, 60, 385);
  }

  ctx.fillStyle = T("--surface");
  ctx.strokeStyle = T("--border");
  ctx.beginPath();
  ctx.roundRect(640, 130, 500, 300, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = T("--text-2");
  ctx.font = font(24);
  ctx.fillText("Skills to learn first", 672, 190);
  const toLearn = [...b.acquire, ...b.upgrade].slice(0, 3);
  ctx.font = font(28);
  let y = 250;
  if (!toLearn.length) {
    ctx.fillStyle = T("--text");
    ctx.fillText("You already have the skills.", 672, y);
  }
  for (const item of toLearn) {
    ctx.fillStyle = T("--accent");
    ctx.beginPath();
    ctx.arc(680, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T("--text");
    ctx.fillText(item.skill, 704, y);
    y += 62;
  }

  ctx.strokeStyle = T("--border");
  ctx.beginPath();
  ctx.moveTo(60, 520);
  ctx.lineTo(1140, 520);
  ctx.stroke();
  ctx.fillStyle = T("--text-3");
  ctx.font = font(20);
  ctx.fillText(
    "Data: O*NET (USDOL/ETA, CC BY 4.0) · BLS OEWS · AIOE · OpenAI · Microsoft Research",
    60,
    565
  );
  ctx.fillText("Estimates from public data - not career advice. Built with SkillBridge.", 60, 598);

  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `skillbridge_${fromSoc}_${toSoc}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
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

/* ---------- Wow layer: hero constellation + scroll reveals ---------- */

(() => {
  if (reducedMotion) return;
  const canvas = $("constellation");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const mouse = { x: -9999, y: -9999 };
  let dots = [];
  let raf = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = hero.clientWidth * dpr;
    canvas.height = hero.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.floor(hero.clientWidth / 16));
    dots = Array.from({ length: n }, () => ({
      x: Math.random() * hero.clientWidth,
      y: Math.random() * hero.clientHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: 1.2 + Math.random() * 1.6,
      green: Math.random() < 0.18,
    }));
  }

  function tick() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    ctx.clearRect(0, 0, w, h);

    for (const d of dots) {
      // gentle drift + soft repulsion from the mouse
      const dx = d.x - mouse.x;
      const dy = d.y - mouse.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 120 * 120) {
        const f = 14 / Math.max(dist2, 200);
        d.vx += dx * f * 0.6;
        d.vy += dy * f * 0.6;
      }
      d.vx *= 0.985;
      d.vy *= 0.985;
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      d.x = Math.max(0, Math.min(w, d.x));
      d.y = Math.max(0, Math.min(h, d.y));
    }

    ctx.lineWidth = 0.6;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i];
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 95 * 95) {
          const alpha = 0.1 * (1 - Math.sqrt(d2) / 95);
          ctx.strokeStyle = `rgba(138, 148, 142, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.green ? "rgba(46, 224, 138, 0.55)" : "rgba(111, 122, 116, 0.45)";
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }

  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  hero.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(tick);
  });
  resize();
  raf = requestAnimationFrame(tick);
})();

(() => {
  const revealables = document.querySelectorAll(".reveal");
  if (!revealables.length || !("IntersectionObserver" in window)) {
    for (const el of revealables) el.classList.add("visible");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  for (const el of revealables) io.observe(el);
})();
