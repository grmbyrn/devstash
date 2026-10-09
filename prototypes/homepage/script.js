(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ─── Navbar: more opaque once the page scrolls ──────────────────────
  function initNavbar() {
    const nav = document.getElementById("nav");
    if (!nav) return;

    let queued = false;
    const update = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      queued = false;
    };

    window.addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  // ─── Fade elements in as they scroll into view ──────────────────────
  function initReveal() {
    const targets = document.querySelectorAll(".reveal");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    targets.forEach((el) => observer.observe(el));
  }

  // ─── Chaos icons: drift, bounce off walls, flee the cursor ──────────
  const CRUISE_MIN = 28;       // px/s
  const CRUISE_MAX = 55;       // px/s
  const MAX_SPEED = 520;       // px/s
  const REPEL_RADIUS = 110;    // px
  const REPEL_FORCE = 2600;    // px/s² at the cursor, fading to 0 at the radius
  const SPEED_EASE = 1.6;      // how quickly a pushed icon settles back to cruising
  const ROTATE_AMPLITUDE = 12; // degrees
  const SCALE_AMPLITUDE = 0.06;
  const MAX_FRAME = 0.05;      // s — clamp so a backgrounded tab doesn't teleport icons

  const random = (min, max) => min + Math.random() * (max - min);

  function initChaos() {
    const field = document.getElementById("chaos-field");
    if (!field) return;

    const icons = Array.from(field.querySelectorAll(".chaos__icon")).map((el) => {
      const angle = random(0, Math.PI * 2);
      const cruise = random(CRUISE_MIN, CRUISE_MAX);
      return {
        el,
        size: el.offsetWidth,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * cruise,
        vy: Math.sin(angle) * cruise,
        cruise,
        phase: random(0, Math.PI * 2),
        wobble: random(0.6, 1.2), // rad/s for rotation + scale
      };
    });

    let width = field.clientWidth;
    let height = field.clientHeight;

    // Spread icons across a 4×2 grid with jitter so they never start stacked.
    function scatter() {
      const cols = 4;
      const rows = Math.ceil(icons.length / cols);
      icons.forEach((icon, i) => {
        const cellW = width / cols;
        const cellH = height / rows;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const maxX = Math.max(0, cellW - icon.size);
        const maxY = Math.max(0, cellH - icon.size);
        icon.x = Math.min(col * cellW + random(0, maxX), width - icon.size);
        icon.y = Math.min(row * cellH + random(0, maxY), height - icon.size);
      });
    }

    function render(icon, time) {
      const t = time / 1000;
      const rotate = Math.sin(t * icon.wobble + icon.phase) * ROTATE_AMPLITUDE;
      const scale = 1 + Math.sin(t * icon.wobble * 1.7 + icon.phase) * SCALE_AMPLITUDE;
      icon.el.style.transform =
        `translate3d(${icon.x.toFixed(1)}px, ${icon.y.toFixed(1)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }

    scatter();
    icons.forEach((icon) => render(icon, 0));

    // Reduced motion: a static scatter, re-laid out when the field resizes.
    if (prefersReducedMotion) {
      new ResizeObserver(() => {
        width = field.clientWidth;
        height = field.clientHeight;
        scatter();
        icons.forEach((icon) => render(icon, 0));
      }).observe(field);
      return;
    }

    const pointer = { x: 0, y: 0, active: false };

    function trackPointer(event) {
      const rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    }
    field.addEventListener("pointermove", trackPointer);
    field.addEventListener("pointerdown", trackPointer);
    field.addEventListener("pointerleave", () => { pointer.active = false; });

    // Unit vector pushing the icon away from the cursor. Against a wall, the
    // component aimed into it is dropped so the icon slides along the wall
    // instead of being pinned under the cursor; a square-on push slides it
    // toward whichever side has more room.
    function repelDirection(icon, dx, dy, distance) {
      let ux = dx / distance;
      let uy = dy / distance;
      const maxX = width - icon.size;
      const maxY = height - icon.size;
      const blockedX = (icon.x <= 0.5 && ux < 0) || (icon.x >= maxX - 0.5 && ux > 0);
      const blockedY = (icon.y <= 0.5 && uy < 0) || (icon.y >= maxY - 0.5 && uy > 0);
      if (blockedX) {
        ux = 0;
        if (!blockedY && Math.abs(uy) < 0.3) uy = icon.y < maxY / 2 ? 1 : -1;
      }
      if (blockedY) {
        uy = 0;
        if (!blockedX && Math.abs(ux) < 0.3) ux = icon.x < maxX / 2 ? 1 : -1;
      }
      if (blockedX && blockedY) {
        // Cornered: slide out along the longer free edge.
        if (width >= height) ux = icon.x < maxX / 2 ? 1 : -1;
        else uy = icon.y < maxY / 2 ? 1 : -1;
      }
      const length = Math.hypot(ux, uy) || 1;
      return [ux / length, uy / length];
    }

    function step(icon, dt) {
      if (pointer.active) {
        const dx = icon.x + icon.size / 2 - pointer.x;
        const dy = icon.y + icon.size / 2 - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < REPEL_RADIUS) {
          const push = (1 - distance / REPEL_RADIUS) * REPEL_FORCE * dt;
          const [ux, uy] = repelDirection(icon, dx, dy, distance);
          icon.vx += ux * push;
          icon.vy += uy * push;
        }
      }

      // Ease the speed back toward cruising so a push fades out naturally.
      let speed = Math.hypot(icon.vx, icon.vy) || 1;
      const target = speed + (icon.cruise - speed) * Math.min(1, dt * SPEED_EASE);
      const limited = Math.min(target, MAX_SPEED);
      icon.vx *= limited / speed;
      icon.vy *= limited / speed;

      icon.x += icon.vx * dt;
      icon.y += icon.vy * dt;

      const maxX = width - icon.size;
      const maxY = height - icon.size;
      if (icon.x < 0) { icon.x = 0; icon.vx = Math.abs(icon.vx); }
      else if (icon.x > maxX) { icon.x = maxX; icon.vx = -Math.abs(icon.vx); }
      if (icon.y < 0) { icon.y = 0; icon.vy = Math.abs(icon.vy); }
      else if (icon.y > maxY) { icon.y = maxY; icon.vy = -Math.abs(icon.vy); }
    }

    let frameId = 0;
    let lastTime = 0;

    function frame(time) {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, MAX_FRAME) : 0;
      lastTime = time;
      icons.forEach((icon) => {
        step(icon, dt);
        render(icon, time);
      });
      frameId = requestAnimationFrame(frame);
    }

    function start() {
      if (frameId) return;
      lastTime = 0;
      frameId = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }

    new ResizeObserver(() => {
      width = field.clientWidth;
      height = field.clientHeight;
      icons.forEach((icon) => {
        icon.x = Math.min(icon.x, Math.max(0, width - icon.size));
        icon.y = Math.min(icon.y, Math.max(0, height - icon.size));
      });
    }).observe(field);

    // Only animate while the field is on screen.
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    }).observe(field);
  }

  // ─── AI section: tags "generate" one by one when the editor appears ─
  function initAiTags() {
    const editor = document.getElementById("ai-editor");
    const status = document.getElementById("ai-status");
    const tags = document.querySelectorAll("#ai-tags li");
    if (!editor || !status || tags.length === 0) return;

    const finish = () => {
      status.textContent = `${tags.length} tags suggested`;
      status.classList.add("is-done");
    };

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      tags.forEach((tag) => tag.classList.add("is-shown"));
      finish();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      tags.forEach((tag, i) => {
        setTimeout(() => {
          tag.classList.add("is-shown");
          if (i === tags.length - 1) finish();
        }, 800 + i * 220);
      });
    }, { threshold: 0.4 });

    observer.observe(editor);
  }

  // ─── Pricing: monthly ↔ yearly ──────────────────────────────────────
  const PRO_PRICING = {
    monthly: { amount: "$8", period: "/month", note: "Billed monthly" },
    yearly: { amount: "$72", period: "/year", note: "That's $6/month, billed yearly" },
  };

  function initBilling() {
    const toggle = document.getElementById("billing-toggle");
    const amount = document.getElementById("pro-amount");
    const period = document.getElementById("pro-period");
    const note = document.getElementById("pro-note");
    const monthlyLabel = document.getElementById("label-monthly");
    const yearlyLabel = document.getElementById("label-yearly");
    if (!toggle || !amount || !period || !note) return;

    toggle.addEventListener("click", () => {
      const yearly = toggle.getAttribute("aria-checked") !== "true";
      const plan = yearly ? PRO_PRICING.yearly : PRO_PRICING.monthly;

      toggle.setAttribute("aria-checked", String(yearly));
      amount.textContent = plan.amount;
      period.textContent = plan.period;
      note.textContent = plan.note;
      monthlyLabel?.classList.toggle("is-active", !yearly);
      yearlyLabel?.classList.toggle("is-active", yearly);
    });
  }

  // ─── Footer year ────────────────────────────────────────────────────
  function initYear() {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  initNavbar();
  initReveal();
  initChaos();
  initAiTags();
  initBilling();
  initYear();
})();
