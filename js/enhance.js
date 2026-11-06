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

/* Kindred weather visuals and small interactions (decorative only; pages work without them). */
(function () {
  var C = '<path d="M10 28h26a8 8 0 0 0 0-16 11 11 0 0 0-21 3 7 7 0 0 0-5 13z" fill="#fff"/>';
  var ICON = {
    sun: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#F2A541"/><g stroke="#F2A541" stroke-width="3" stroke-linecap="round"><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"/></g></svg>',
    card: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 22h22a7 7 0 0 0 0-14 10 10 0 0 0-19 3 6 6 0 0 0-3 11z" fill="#C9D5E6"/><rect x="10" y="24" width="28" height="18" rx="3" fill="#16204A"/><rect x="10" y="28" width="28" height="4" fill="#F2A541"/></svg>',
    storm: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 30h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 7 7 0 0 0 1 13z" fill="#8E9AC0"/><path d="M25 30l-5 9h5l-3 7 9-11h-5l3-5z" fill="#F2A541"/></svg>',
    umbrella: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 24a18 18 0 0 1 36 0z" fill="#16204A"/><path d="M24 24v14a4 4 0 0 1-8 0" fill="none" stroke="#16204A" stroke-width="3" stroke-linecap="round"/><g fill="#8FA3C6"><path d="M12 4l-2 5"/><circle cx="11" cy="8" r="1.6"/><circle cx="37" cy="8" r="1.6"/><circle cx="24" cy="3" r="1.6"/></g></svg>',
    calendar: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="10" width="32" height="30" rx="5" fill="#fff" stroke="#16204A" stroke-width="3"/><path d="M8 18h32" stroke="#16204A" stroke-width="3"/><circle cx="31" cy="30" r="5" fill="#F2A541"/></svg>',
    shield: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v11c0 10-6.5 17-15 21C15.5 39 9 32 9 22V11z" fill="#16204A"/><path d="M17 24l5 5 9-10" fill="none" stroke="#F2A541" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wind: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#16204A" stroke-width="3" stroke-linecap="round"><path d="M6 18h24a5 5 0 1 0-5-5"/><path d="M6 26h32a5 5 0 1 1-5 5"/><path d="M6 34h16"/></g></svg>'
  };
  var path = location.pathname.split("/").pop() || "index.html";
  var heroIcon = { "topic-card-networks.html": "card", "topic-enforcement.html": "storm", "events.html": "calendar", "guides.html": "shield", "payments-compliance-guide.html": "shield", "human-crimes.html": "umbrella", "topics.html": "wind", "get-involved.html": "sun" }[path] || "sun";

  // Sky headers with drifting clouds on inner pages.
  document.querySelectorAll(".ed-hero").forEach(function (h) {
    h.classList.add("sky-hero");
    var d = document.createElement("div");
    d.className = "sky-deco"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = '<span class="sky-main">' + ICON[heroIcon] + '</span>' +
      '<svg class="sky-c c1" viewBox="0 0 48 30">' + C + '</svg><svg class="sky-c c2" viewBox="0 0 48 30">' + C + '</svg>';
    h.insertBefore(d, h.firstChild);
  });

  // Topic icons on tiles, edition sections and briefing lists.
  function iconFor(href) {
    if (/card-networks|#cards/.test(href)) return "card";
    if (/enforcement/.test(href)) return "storm";
    if (/human-crimes/.test(href)) return "umbrella";
    return null;
  }
  document.querySelectorAll("a.tile, a.hv-item").forEach(function (a) {
    var k = iconFor(a.getAttribute("href") || "");
    if (/visa/i.test(a.textContent)) k = "card";
    if (!k) return;
    var s = document.createElement("span"); s.className = "topic-ico"; s.innerHTML = ICON[k];
    a.insertBefore(s, a.firstChild);
  });
  document.querySelectorAll(".ed-topic").forEach(function (sec) {
    var k = sec.id === "cards" ? "card" : sec.id === "enforcement" ? "storm" : null;
    var head = sec.querySelector(".ed-topic-head");
    if (!k || !head) return;
    var s = document.createElement("span"); s.className = "topic-ico big"; s.innerHTML = ICON[k];
    head.insertBefore(s, head.firstChild);
  });

  // Events: filter by region and add-to-calendar.
  var list = document.querySelector(".ev-full");
  if (list) {
    var region = function (li) {
      var t = li.textContent;
      if (/Online/.test(t)) return "Online";
      if (/Netherlands|London|Europe/.test(t)) return "Europe";
      if (/Ontario|Canada/.test(t)) return "Canada";
      return "United States";
    };
    var lis = [].slice.call(list.querySelectorAll(".ev"));
    lis.forEach(function (li) { li.dataset.region = region(li); });
    var bar = document.createElement("div"); bar.className = "ev-filter"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filter by region");
    ["All", "United States", "Canada", "Europe", "Online"].forEach(function (r, i) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = r; b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.onclick = function () {
        bar.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        lis.forEach(function (li) { li.hidden = !(r === "All" || li.dataset.region === r); });
      };
      bar.appendChild(b);
    });
    list.parentNode.insertBefore(bar, list);
  }
  document.querySelectorAll(".ev[data-date]").forEach(function (li) {
    var a = li.querySelector(".ev-name a"); if (!a) return;
    var metas = li.querySelectorAll(".ev-meta");
    var d = li.dataset.date.replace(/-/g, "");
    var b = document.createElement("button"); b.type = "button"; b.className = "ev-add"; b.textContent = "Add to calendar";
    b.onclick = function () {
      var next = new Date(li.dataset.date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      var end = next.toISOString().slice(0, 10).replace(/-/g, "");
      var esc = function (s) { return s.replace(/[,;\\]/g, "\\$&"); };
      var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kindred//Events//EN", "BEGIN:VEVENT",
        "UID:" + d + "-" + a.textContent.replace(/\W+/g, "") + "@kindredmission.github.io",
        "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
        "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + end,
        "SUMMARY:" + esc(a.textContent),
        "LOCATION:" + esc(metas[1] ? metas[1].textContent : ""),
        "DESCRIPTION:" + esc((metas[0] ? metas[0].textContent : "") + ". Confirm dates with the organizer: " + a.href),
        "URL:" + a.href, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      var t = document.createElement("a"); t.href = url; t.download = a.textContent.replace(/[^\w]+/g, "-") + ".ics";
      document.body.appendChild(t); t.click(); t.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    li.querySelector(".ev-body").appendChild(b);
  });
})();
