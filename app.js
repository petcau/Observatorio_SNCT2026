(() => {
  "use strict";

  const researchers = Array.isArray(window.PESQUISADORAS) ? window.PESQUISADORAS : [];
  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);
  const INACTIVITY_DELAY = 60_000;
  let inactivityTimer;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const initials = (name) => name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  const unique = (key) => [...new Set(researchers.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const navigate = (path) => { window.location.href = path; };
  const openProfile = (id) => navigate(`perfil.html?id=${encodeURIComponent(id)}`);
  const goHome = () => navigate("index.html");
  const goBack = () => { if (window.history.length > 1) window.history.back(); else goHome(); };

  function renderResearcherCard(researcher) {
    return `
      <button class="researcher-card" type="button" data-researcher-id="${researcher.id}" aria-label="Conheça a trajetória de ${escapeHTML(researcher.nome)}">
        <span class="avatar" aria-hidden="true">${escapeHTML(initials(researcher.nome))}</span>
        <span class="researcher-card__info">
          <span class="researcher-card__institution">${escapeHTML(researcher.sigla)}</span>
          <h3>${escapeHTML(researcher.nome)}</h3>
          <span class="researcher-card__meta">
            <span>${escapeHTML(researcher.area)}</span><span>${escapeHTML(researcher.cidade)}</span>
          </span>
          <p class="researcher-card__theme">${escapeHTML(researcher.tematica)}</p>
          <span class="researcher-card__action">Conheça a trajetória →</span>
        </span>
      </button>`;
  }

  function bindResearcherCards(container = document) {
    container.querySelectorAll("[data-researcher-id]").forEach((card) => {
      card.addEventListener("click", () => openProfile(card.dataset.researcherId));
    });
  }

  function fillSelect(id, values) {
    const select = document.querySelector(`#${id}`);
    if (!select) return;
    values.forEach((value) => select.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`));
  }

  function renderCientistas() {
    const grid = document.querySelector("#researcher-grid");
    const count = document.querySelector("#result-count");
    const search = document.querySelector("#search");
    const listingTitle = document.querySelector("#listing-title");
    const filters = ["instituicao", "area", "tematica", "cidade"];

    filters.forEach((key) => fillSelect(key, unique(key)));
    const preset = ["instituicao", "area", "tematica", "cidade"].find((key) => params.has(key));
    if (preset) document.querySelector(`#${preset}`).value = params.get(preset);

    if (params.has("tematica")) listingTitle.textContent = `Mulheres que pesquisam ${params.get("tematica")}`;
    if (params.has("instituicao")) listingTitle.textContent = `Mulheres cientistas da ${params.get("instituicao")}`;
    if (params.has("cidade")) listingTitle.textContent = `Mulheres cientistas em ${params.get("cidade")}`;
    if (params.get("ordem") === "destaques") listingTitle.textContent = "Destaques da ciência";

    const applyFilters = () => {
      const term = search.value.trim().toLocaleLowerCase("pt-BR");
      const selected = Object.fromEntries(filters.map((key) => [key, document.querySelector(`#${key}`).value]));
      let filtered = researchers.filter((item) => {
        const nameMatches = item.nome.toLocaleLowerCase("pt-BR").includes(term);
        const filtersMatch = filters.every((key) => !selected[key] || item[key] === selected[key]);
        return nameMatches && filtersMatch;
      });

      if (params.get("ordem") === "destaques") filtered = filtered.sort((a, b) => (b.artigos || 0) - (a.artigos || 0));
      count.textContent = `${filtered.length} ${filtered.length === 1 ? "pesquisadora encontrada" : "pesquisadoras encontradas"}`;
      grid.innerHTML = filtered.length
        ? filtered.map(renderResearcherCard).join("")
        : `<div class="empty-state"><h3>Nenhum resultado encontrado</h3><p>Tente ajustar ou limpar os filtros.</p></div>`;
      bindResearcherCards(grid);
    };

    search.addEventListener("input", applyFilters);
    filters.forEach((key) => document.querySelector(`#${key}`).addEventListener("change", applyFilters));
    document.querySelector("#clear-filters").addEventListener("click", () => {
      search.value = "";
      filters.forEach((key) => { document.querySelector(`#${key}`).value = ""; });
      window.history.replaceState({}, "", "cientistas.html");
      applyFilters();
    });
    applyFilters();
  }

  const themeDescriptions = {
    "Biodiversidade, ecologia e conservação": "Vida, ecossistemas e conservação dos territórios.",
    "Saúde coletiva e epidemiologia": "Saúde, população e qualidade de vida.",
    "Computação e inteligência artificial": "Dados, sistemas inteligentes e novas tecnologias.",
    "Educação, ensino e formação docente": "Aprendizagem, práticas educativas e formação.",
    "Energia e tecnologias sustentáveis": "Inovação para uma transição mais sustentável.",
    "Produção animal e pastagens": "Conhecimento aplicado aos sistemas produtivos.",
    "Biotecnologia": "Processos biológicos transformados em soluções.",
    "Comunicação, mídia e cultura digital": "Informação, sociedade e ambientes digitais."
  };

  function renderThemeCard(theme, count) {
    return `<button class="explore-card" type="button" data-theme="${escapeHTML(theme)}">
      <span class="explore-card__icon" aria-hidden="true">✦</span>
      <h3>${escapeHTML(theme)}</h3><p>${escapeHTML(themeDescriptions[theme] || "Uma rede de pesquisas e conexões científicas.")}</p>
      <span class="explore-card__footer"><span>${count} ${count === 1 ? "pesquisadora" : "pesquisadoras"}</span><span>Explorar →</span></span>
    </button>`;
  }

  function renderTematicas() {
    const chipRow = document.querySelector("#area-chips");
    const grid = document.querySelector("#theme-grid");
    const areas = ["Todas as áreas", ...unique("area")];
    let activeArea = "Todas as áreas";

    chipRow.innerHTML = areas.map((area, index) => `<button class="chip${index === 0 ? " is-active" : ""}" type="button" data-area="${escapeHTML(area)}">${escapeHTML(area)}</button>`).join("");
    const draw = () => {
      const subset = activeArea === "Todas as áreas" ? researchers : researchers.filter((item) => item.area === activeArea);
      const totals = subset.reduce((map, item) => map.set(item.tematica, (map.get(item.tematica) || 0) + 1), new Map());
      grid.innerHTML = [...totals].map(([theme, count]) => renderThemeCard(theme, count)).join("") || `<div class="empty-state"><h3>Nenhuma temática nesta área</h3></div>`;
      grid.querySelectorAll("[data-theme]").forEach((card) => card.addEventListener("click", () => navigate(`cientistas.html?tematica=${encodeURIComponent(card.dataset.theme)}`)));
    };
    chipRow.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-area]");
      if (!chip) return;
      activeArea = chip.dataset.area;
      chipRow.querySelectorAll(".chip").forEach((item) => item.classList.toggle("is-active", item === chip));
      draw();
    });
    draw();
  }

  function renderTerritorio() {
    const grid = document.querySelector("#territory-grid");
    const buttons = document.querySelectorAll("[data-mode]");
    const draw = (mode) => {
      const key = mode === "instituicao" ? "instituicao" : "cidade";
      const groups = researchers.reduce((map, item) => {
        const label = item[key];
        const group = map.get(label) || { count: 0, cities: new Set(), sigla: item.sigla };
        group.count += 1; group.cities.add(item.cidade); map.set(label, group); return map;
      }, new Map());
      grid.innerHTML = [...groups].sort((a,b) => b[1].count-a[1].count).map(([label, info]) => `<button class="explore-card" type="button" data-filter-key="${key}" data-filter-value="${escapeHTML(label)}">
        <span class="explore-card__icon" aria-hidden="true">${mode === "instituicao" ? escapeHTML(info.sigla) : "⌖"}</span>
        <h3>${escapeHTML(label)}</h3><p>${mode === "instituicao" ? escapeHTML([...info.cities].join(" • ")) : "Bahia"}</p>
        <span class="explore-card__footer"><span>${info.count} ${info.count === 1 ? "pesquisadora" : "pesquisadoras"}</span><span>Conhecer →</span></span>
      </button>`).join("");
      grid.querySelectorAll("[data-filter-key]").forEach((card) => card.addEventListener("click", () => navigate(`cientistas.html?${card.dataset.filterKey}=${encodeURIComponent(card.dataset.filterValue)}`)));
    };
    buttons.forEach((button) => button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      draw(button.dataset.mode);
    }));
    draw("instituicao");
  }

  function discoverResearcher(currentId) {
    const options = researchers.filter((item) => String(item.id) !== String(currentId));
    const pool = options.length ? options : researchers;
    if (!pool.length) return;
    const selected = pool[Math.floor(Math.random() * pool.length)];
    const overlay = document.querySelector("#randomizing");
    overlay?.classList.add("is-visible");
    window.setTimeout(() => openProfile(selected.id), 720);
  }

  function renderProfile() {
    const researcher = researchers.find((item) => String(item.id) === params.get("id")) || researchers[0];
    const root = document.querySelector("#profile-content");
    if (!researcher) { root.innerHTML = `<div class="empty-state"><h2>Perfil não encontrado</h2></div>`; return; }
    document.title = `${researcher.nome} • Ciência Delas`;
    const indicators = [
      ["Artigos",researcher.artigos],["Livros",researcher.livros],["Capítulos",researcher.capitulos],
      ["Patentes",researcher.patentes],["Softwares",researcher.softwares],["Índice H",researcher.indiceH]
    ].filter(([,value]) => Number(value) > 0);
    root.innerHTML = `<header class="profile-head">
      <div class="profile-avatar" aria-hidden="true">${escapeHTML(initials(researcher.nome))}</div>
      <div><span class="profile-head__institution">${escapeHTML(researcher.instituicao)} • ${escapeHTML(researcher.sigla)}</span><h1>${escapeHTML(researcher.nome)}</h1><div class="profile-meta"><span>${escapeHTML(researcher.cidade)}</span><span>${escapeHTML(researcher.area)}</span></div></div>
    </header>
    <section class="profile-section"><h2>O que ela pesquisa</h2><div class="research-tags"><article class="research-tag"><span>TEMÁTICA IA</span><strong>${escapeHTML(researcher.tematica)}</strong></article>${researcher.tema ? `<article class="research-tag"><span>TEMA IA</span><strong>${escapeHTML(researcher.tema)}</strong></article>` : ""}</div></section>
    <section class="profile-section"><h2>Conheça sua trajetória</h2><p class="trajectory">${escapeHTML(researcher.resumo)}</p></section>
    ${indicators.length ? `<section class="profile-section"><h2>Produção científica e tecnológica</h2><div class="profile-indicators">${indicators.map(([label,value]) => `<article class="indicator"><strong>${value}</strong><span>${label}</span></article>`).join("")}</div></section>` : ""}
    <section class="profile-section"><h2>Conexões</h2><div class="profile-actions"><button class="touch-button" data-link-theme>Outras pesquisadoras desta temática</button><button class="touch-button" data-link-institution>Outras desta instituição</button><button class="touch-button touch-button--primary" data-discover>Descobrir outra cientista ✦</button></div></section>`;
    root.querySelector("[data-link-theme]").addEventListener("click", () => navigate(`cientistas.html?tematica=${encodeURIComponent(researcher.tematica)}`));
    root.querySelector("[data-link-institution]").addEventListener("click", () => navigate(`cientistas.html?instituicao=${encodeURIComponent(researcher.instituicao)}`));
    root.querySelector("[data-discover]").addEventListener("click", () => discoverResearcher(researcher.id));
  }

  function initializeNavigation() {
    document.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", goHome));
    document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", goBack));
  }

  function startInactivityTimer() {
    const restart = () => { window.clearTimeout(inactivityTimer); inactivityTimer = window.setTimeout(goHome, INACTIVITY_DELAY); };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => document.addEventListener(eventName, restart, { passive: true }));
    restart();
  }

  initializeNavigation();
  if (page === "cientistas") renderCientistas();
  if (page === "tematicas") renderTematicas();
  if (page === "territorio") renderTerritorio();
  if (page === "perfil") renderProfile();
  startInactivityTimer();
})();
