(() => {
  const ATTRACTION_DELAY = 40_000;
  const cards = [...document.querySelectorAll(".nav-card")];
  const attraction = document.querySelector("#attraction");
  const attractionButton = attraction.querySelector(".attraction__button");
  const touchFeedback = document.querySelector(".touch-feedback");
  const discoveryTransition = document.querySelector("#discovery-transition");
  const researchers = Array.isArray(window.PESQUISADORAS) ? window.PESQUISADORAS : [];
  const routes = {
    cientistas: "cientistas.html",
    tematicas: "tematicas.html",
    mapa: "territorio.html",
    numeros: "numeros.html",
    destaques: "cientistas.html?ordem=destaques"
  };
  let attractionTimer;
  let lastFocusedElement = null;

  const showAttraction = () => {
    lastFocusedElement = document.activeElement;
    attraction.classList.add("is-visible");
    attraction.setAttribute("aria-hidden", "false");
    attractionButton.focus({ preventScroll: true });
  };

  const hideAttraction = () => {
    attraction.classList.remove("is-visible");
    attraction.setAttribute("aria-hidden", "true");

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };

  const restartAttractionTimer = () => {
    window.clearTimeout(attractionTimer);
    attractionTimer = window.setTimeout(showAttraction, ATTRACTION_DELAY);
  };

  const registerActivity = () => {
    if (attraction.classList.contains("is-visible")) return;
    restartAttractionTimer();
  };

  const animateTouch = (event) => {
    const point = event.touches?.[0] ?? event;
    if (typeof point.clientX !== "number") return;

    touchFeedback.style.left = `${point.clientX}px`;
    touchFeedback.style.top = `${point.clientY}px`;
    touchFeedback.classList.remove("is-active");
    void touchFeedback.offsetWidth;
    touchFeedback.classList.add("is-active");
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const { section } = card.dataset;
      card.classList.add("is-pressed");
      window.setTimeout(() => card.classList.remove("is-pressed"), 280);
      console.log("Abrir seção:", section);

      if (section === "descubra") {
        const selected = researchers[Math.floor(Math.random() * researchers.length)];
        if (!selected) return;
        discoveryTransition.classList.add("is-visible");
        window.setTimeout(() => { window.location.href = `perfil.html?id=${selected.id}`; }, 720);
        return;
      }

      if (routes[section]) window.location.href = routes[section];
    });
  });

  attractionButton.addEventListener("click", () => {
    hideAttraction();
    restartAttractionTimer();
  });

  attraction.addEventListener("click", (event) => {
    if (event.target === attraction) attractionButton.click();
  });

  ["pointerdown", "keydown", "wheel"].forEach((eventName) => {
    document.addEventListener(eventName, registerActivity, { passive: true });
  });

  document.addEventListener("pointerdown", animateTouch, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearTimeout(attractionTimer);
    else restartAttractionTimer();
  });

  window.addEventListener("load", () => {
    document.body.classList.add("is-ready");
    restartAttractionTimer();
  });
})();
