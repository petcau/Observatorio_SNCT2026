(() => {
  "use strict";

  const DATA_URL = "data/dados_simcc_completo.json";
  const formatterCache = new Map();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);

  function formatNumberBR(value, decimals = 0) {
    if (!Number.isFinite(Number(value))) return "—";
    if (!formatterCache.has(decimals)) {
      formatterCache.set(decimals, new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }));
    }
    return formatterCache.get(decimals).format(Number(value));
  }

  function validText(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text && !["null", "undefined", "nan"].includes(text.toLowerCase()) ? text : null;
  }

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = validText(value);
    if (!text) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  const areaLabels = {
    CIENCIAS_AGRARIAS: "Ciências Agrárias",
    CIENCIAS_BIOLOGICAS: "Ciências Biológicas",
    CIENCIAS_DA_SAUDE: "Ciências da Saúde",
    CIENCIAS_EXATAS_E_DA_TERRA: "Ciências Exatas e da Terra",
    CIENCIAS_HUMANAS: "Ciências Humanas",
    CIENCIAS_SOCIAIS_APLICADAS: "Ciências Sociais Aplicadas",
    ENGENHARIAS: "Engenharias",
    LINGUISTICA_LETRAS_E_ARTES: "Linguística, Letras e Artes"
  };

  function areaKey(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase();
  }

  function displayArea(value) {
    const key = areaKey(value);
    if (areaLabels[key]) return areaLabels[key];
    return value.toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
  }

  async function loadData() {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Falha ao carregar a base (${response.status})`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) throw new Error("Estrutura de dados inválida");
    return payload.data;
  }

  function getFemaleResearchers(records) {
    const uniqueResearchers = new Map();
    records.forEach((record) => {
      if (validText(record.Sexo)?.toUpperCase() !== "F") return;
      const id = validText(record.id);
      if (!id || uniqueResearchers.has(id)) return;

      const areaFinal = validText(record.area) || validText(record["ÁREA IA"]);
      const areas = areaFinal
        ? [...new Set(areaFinal.split(";").map((area) => validText(area)).filter(Boolean).map(displayArea))]
        : [];

      uniqueResearchers.set(id, {
        id,
        institution: validText(record["SIGLA IA"]) || validText(record.university),
        city: validText(record.city),
        areas,
        thematic: validText(record["TEMÁTICA IA"]),
        raw: record
      });
    });
    return [...uniqueResearchers.values()];
  }

  function sumField(researchers, field) {
    const values = researchers.map(({ raw }) => toNumber(raw[field])).filter((value) => value !== null);
    return { value: values.reduce((total, value) => total + value, 0), available: values.length > 0 };
  }

  function calculateGeneralStats(researchers) {
    const institutions = new Set(researchers.map(({ institution }) => institution).filter(Boolean));
    const localities = new Set(researchers.map(({ city }) => city).filter(Boolean));
    const areas = new Set(researchers.flatMap(({ areas: values }) => values));
    return { researchers: researchers.length, institutions: institutions.size, localities: localities.size, areas: areas.size };
  }

  function countBy(researchers, valuesForResearcher) {
    const counts = new Map();
    researchers.forEach((researcher) => {
      [...new Set(valuesForResearcher(researcher).filter(Boolean))].forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }

  const calculateInstitutionRanking = (researchers) => countBy(researchers, ({ institution }) => institution ? [institution] : []);
  const calculateAreaRanking = (researchers) => countBy(researchers, ({ areas }) => areas);
  const calculateThematicRanking = (researchers) => countBy(researchers, ({ thematic }) => thematic ? [thematic] : []);

  function calculateBibliometrics(researchers) {
    const hValues = researchers.map(({ raw }) => toNumber(raw.h_index)).filter((value) => value !== null && value > 0);
    const i10Values = researchers.map(({ raw }) => toNumber(raw.i10_index)).filter((value) => value !== null && value >= 0);
    const citations = sumField(researchers, "cited_by_count");
    return {
      averageH: hValues.length ? hValues.reduce((sum, value) => sum + value, 0) / hValues.length : null,
      citations: citations.available ? citations.value : null,
      averageI10: i10Values.length ? i10Values.reduce((sum, value) => sum + value, 0) / i10Values.length : null
    };
  }

  function iconSVG(name) {
    const paths = {
      person: '<circle cx="16" cy="10" r="5"/><path d="M7 28c1-7 4-10 9-10s8 3 9 10"/>',
      institution: '<path d="M4 12h24L16 4 4 12Zm3 3v10m6-10v10m6-10v10m6-10v10M4 28h24"/>',
      location: '<path d="M16 29S7 21 7 13a9 9 0 1 1 18 0c0 8-9 16-9 16Z"/><circle cx="16" cy="13" r="3"/>',
      areas: '<circle cx="8" cy="9" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="17" cy="24" r="3"/><path d="m11 10 10-1M10 12l5 9m7-10-4 10"/>',
      article: '<path d="M8 3h12l5 5v21H8V3Z"/><path d="M20 3v6h6M12 15h9m-9 5h9m-9 5h6"/>',
      chapter: '<path d="M5 5h9a5 5 0 0 1 5 5v18H10a5 5 0 0 0-5 1V5Zm22 0h-3a5 5 0 0 0-5 5v18h3a5 5 0 0 1 5 1V5Z"/>',
      book: '<path d="M6 4h15a5 5 0 0 1 5 5v19H11a5 5 0 0 0-5 1V4Z"/><path d="M11 9h10M11 14h10"/>',
      patent: '<path d="M16 3a9 9 0 0 0-5 16.5V23h10v-3.5A9 9 0 0 0 16 3Z"/><path d="M12 27h8m-7-4h6"/>',
      software: '<rect x="3" y="5" width="26" height="21" rx="3"/><path d="m10 12-4 4 4 4m12-8 4 4-4 4m-4-10-4 12"/>',
      brand: '<circle cx="16" cy="16" r="12"/><path d="m16 9 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L16 9Z"/>',
      impact: '<path d="M5 25 12 17l5 4L27 8"/><path d="M20 8h7v7"/>'
    };
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${paths[name] || paths.areas}</svg>`;
  }

  function numberMarkup(value, decimals = 0) {
    return `<span class="animated-number" data-number="${value}" data-decimals="${decimals}">${formatNumberBR(0, decimals)}</span>`;
  }

  function renderHeroStats(stats) {
    const cards = [
      ["person", stats.researchers, "Pesquisadoras", "pesquisadoras identificadas na base"],
      ["institution", stats.institutions, "Instituições", "instituições de ensino e pesquisa"],
      ["location", stats.localities, "Localidades", "localidades presentes nos perfis"],
      ["areas", stats.areas, "Áreas do conhecimento", "grandes áreas do conhecimento"]
    ];
    document.querySelector("#portrait-stats").innerHTML = cards.map(([icon, value, title, description]) => `<article class="portrait-stat">
      <span class="line-icon">${iconSVG(icon)}</span><strong>${numberMarkup(value)}</strong><h3>${title}</h3><p>${description}</p>
    </article>`).join("");
  }

  function renderScientificProduction(researchers) {
    const articles = sumField(researchers, "articles");
    const chapters = sumField(researchers, "book_chapters");
    const books = sumField(researchers, "book");
    const articleRoot = document.querySelector("#article-total");
    articleRoot.innerHTML = articles.available ? `${iconSVG("article")}<div><span>TOTAL DE ARTIGOS</span><strong>${numberMarkup(articles.value)}</strong><p>artigos científicos registrados</p></div>` : "";
    document.querySelector("#publication-secondary").innerHTML = [
      ["chapter", chapters, "Capítulos de livros"], ["book", books, "Livros"]
    ].filter(([, total]) => total.available).map(([icon, total, label]) => `<article><span class="line-icon">${iconSVG(icon)}</span><div><strong>${numberMarkup(total.value)}</strong><span>${label}</span></div></article>`).join("");
  }

  function renderTechnologyProduction(researchers) {
    const definitions = [["patent", "patent", "Patentes"], ["software", "software", "Softwares"], ["brand", "brand", "Marcas"]];
    document.querySelector("#technology-stats").innerHTML = definitions.map(([icon, field, label]) => {
      const total = sumField(researchers, field);
      return total.available ? `<article class="technology-stat"><span class="line-icon">${iconSVG(icon)}</span><strong>${numberMarkup(total.value)}</strong><h3>${label}</h3></article>` : "";
    }).join("");
    const patentResearchers = researchers.filter(({ raw }) => (toNumber(raw.patent) || 0) > 0).length;
    const softwareResearchers = researchers.filter(({ raw }) => (toNumber(raw.software) || 0) > 0).length;
    document.querySelector("#technology-notes").innerHTML = `<article><strong>${numberMarkup(patentResearchers)}</strong><span>pesquisadoras possuem pelo menos uma patente</span></article><article><strong>${numberMarkup(softwareResearchers)}</strong><span>pesquisadoras desenvolveram pelo menos um software</span></article>`;
  }

  function rankingMarkup(entries, type, limit = entries.length) {
    const max = Math.max(...entries.map(([, count]) => count), 1);
    return entries.map(([label, count], index) => `<button class="ranking-row${index >= limit ? " is-extra" : ""}" type="button" data-filter-type="${type}" data-filter-value="${escapeHTML(label)}"${index >= limit ? " hidden" : ""}>
      <span class="ranking-row__header"><strong>${escapeHTML(label)}</strong><span>${numberMarkup(count)} ${count === 1 ? "pesquisadora" : "pesquisadoras"}</span></span>
      <span class="ranking-track"><span class="ranking-fill" data-width="${(count / max) * 100}"></span></span>
    </button>`).join("");
  }

  function renderInstitutionRanking(ranking) {
    const root = document.querySelector("#institution-ranking");
    root.innerHTML = rankingMarkup(ranking, "instituicao", 10);
    const more = document.querySelector("#institutions-more");
    if (ranking.length > 10) {
      more.hidden = false;
      more.addEventListener("click", () => {
        const expanded = more.getAttribute("aria-expanded") === "true";
        more.setAttribute("aria-expanded", String(!expanded));
        root.querySelectorAll(".is-extra").forEach((row) => { row.hidden = expanded; });
        more.textContent = expanded ? "Ver todas as instituições ↓" : "Mostrar apenas as 10 principais ↑";
        if (!expanded) activateVisibleAnimations(root);
      });
    }
  }

  function renderAreaRanking(ranking) {
    const max = Math.max(...ranking.map(([, count]) => count), 1);
    document.querySelector("#area-ranking").innerHTML = ranking.map(([area, count], index) => `<button class="area-card" type="button" data-filter-type="area" data-filter-value="${escapeHTML(area)}">
      <span class="area-card__order">${String(index + 1).padStart(2, "0")}</span><span class="line-icon">${iconSVG("areas")}</span>
      <strong>${numberMarkup(count)}</strong><h3>${escapeHTML(area)}</h3><span class="area-card__bar"><i data-width="${(count / max) * 100}"></i></span>
    </button>`).join("");
  }

  function renderThematicRanking(ranking) {
    document.querySelector("#thematic-ranking").innerHTML = ranking.slice(0, 10).map(([thematic, count], index) => `<button class="thematic-card" type="button" data-filter-type="tematica" data-filter-value="${escapeHTML(thematic)}">
      <span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHTML(thematic)}</h3><p>${numberMarkup(count)} ${count === 1 ? "pesquisadora" : "pesquisadoras"}</p><i aria-hidden="true">→</i>
    </button>`).join("");
  }

  function renderBibliometricStats(stats) {
    const items = [
      ["Índice H médio", stats.averageH, 1], ["Total de citações", stats.citations, 0], ["Índice i10 médio", stats.averageI10, 1]
    ].filter(([, value]) => value !== null);
    document.querySelector("#bibliometric-stats").innerHTML = items.map(([label, value, decimals]) => `<article><span class="line-icon">${iconSVG("impact")}</span><strong>${numberMarkup(value, decimals)}</strong><span>${label}</span></article>`).join("");
  }

  function animateNumber(element, finalValue) {
    if (element.dataset.animated === "true") return;
    element.dataset.animated = "true";
    const decimals = Number(element.dataset.decimals) || 0;
    if (reducedMotion) { element.textContent = formatNumberBR(finalValue, decimals); return; }
    const duration = 900;
    const startedAt = performance.now();
    const tick = (time) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatNumberBR(finalValue * eased, decimals);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function activateVisibleAnimations(container) {
    container.querySelectorAll("[data-number]").forEach((element) => animateNumber(element, Number(element.dataset.number)));
    container.querySelectorAll("[data-width]").forEach((bar) => bar.style.setProperty("--bar-width", `${bar.dataset.width}%`));
  }

  function animateNumbers() {
    const blocks = [...document.querySelectorAll(".reveal-block")];
    if (!("IntersectionObserver" in window) || reducedMotion) {
      blocks.forEach((block) => { block.classList.add("is-visible"); activateVisibleAnimations(block); });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("is-pending");
        entry.target.classList.add("is-visible");
        activateVisibleAnimations(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5%" });

    blocks.forEach((block) => {
      const bounds = block.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        block.classList.add("is-visible");
        activateVisibleAnimations(block);
      } else {
        block.classList.add("is-pending");
        observer.observe(block);
      }
    });
  }

  function setupInteractiveCards() {
    document.querySelectorAll("[data-filter-type]").forEach((card) => card.addEventListener("click", () => {
      const type = card.dataset.filterType;
      const value = card.dataset.filterValue;
      if (type === "instituicao") console.log("Filtrar pesquisadoras por instituição:", value);
      if (type === "tematica") console.log("Abrir pesquisadoras da temática:", value);
      window.location.href = `cientistas.html?${type}=${encodeURIComponent(value)}`;
    }));
  }

  async function initialize() {
    const status = document.querySelector("#data-status");
    try {
      const records = await loadData();
      const researchers = getFemaleResearchers(records);
      if (!researchers.length) throw new Error("Nenhuma pesquisadora identificada na base");

      const generalStats = calculateGeneralStats(researchers);
      const institutionRanking = calculateInstitutionRanking(researchers);
      const areaRanking = calculateAreaRanking(researchers);
      const thematicRanking = calculateThematicRanking(researchers);
      const bibliometrics = calculateBibliometrics(researchers);

      renderHeroStats(generalStats);
      renderScientificProduction(researchers);
      renderTechnologyProduction(researchers);
      renderInstitutionRanking(institutionRanking);
      renderAreaRanking(areaRanking);
      renderThematicRanking(thematicRanking);
      renderBibliometricStats(bibliometrics);

      document.querySelector("#numbers-content").hidden = false;
      status.remove();
      setupInteractiveCards();
      animateNumbers();
    } catch (error) {
      console.error("Não foi possível montar Ciência em números:", error);
      status.classList.add("is-error");
      status.innerHTML = `<strong>Não foi possível carregar os dados.</strong><span>Execute o projeto por um servidor local para permitir a leitura do arquivo JSON.</span>`;
    }
  }

  initialize();
})();
