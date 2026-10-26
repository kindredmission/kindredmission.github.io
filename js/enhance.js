// Kindred: gentle motion and the Learn page topic switcher. Everything works without this file.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reveal sections as they scroll into view.
  var items = document.querySelectorAll(".reveal, .section, .cards .card, .stats .stat, .feature, .two-col > div");
  items.forEach(function (el, i) { el.classList.add("reveal"); if (el.closest(".cards") || el.closest(".stats")) el.style.transitionDelay = (i % 4) * 90 + "ms"; });
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Shadow under the menu once the page scrolls.
  var nav = document.querySelector(".site-nav");
  if (nav) window.addEventListener("scroll", function () { nav.classList.toggle("stuck", window.scrollY > 120); }, { passive: true });

  // Learn page: show one topic at a time.
  var wrap = document.querySelector(".learn-wrap");
  if (wrap) {
    var topics = wrap.querySelectorAll(".topic");
    var tabs = document.querySelectorAll(".topic-tab");
    function select(id, focus) {
      var found = false;
      topics.forEach(function (t) { var on = t.id === id; t.hidden = !on; if (on) found = true; });
      if (!found) return false;
      tabs.forEach(function (b) { var on = b.getAttribute("aria-controls") === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      return true;
    }
    function fromHash() {
      var h = decodeURIComponent(location.hash.slice(1));
      if (!h) return select(topics[0].id);
      if (select(h)) return true;
      var inner = document.getElementById(h);
      var t = inner && inner.closest(".topic");
      if (t) { select(t.id); setTimeout(function () { inner.scrollIntoView(); }, 30); return true; }
      select(topics[0].id);
    }
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("aria-controls"); select(id);
        history.replaceState(null, "", "#" + id);
        document.querySelector(".topic-tabs").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        n.click(); n.focus();
      });
    });
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }
})();
