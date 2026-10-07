// Rawgenzo 公式ページの動き
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------- スクロールに応じた処理(ナビ・ヒーロー・導入文) ----------
  const nav = $("#nav");
  const hero = $(".hero");
  const words = setupRevealWords($("[data-reveal-words]"));

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      nav.classList.toggle("is-scrolled", y > 10);
      if (!reduceMotion) hero.style.setProperty("--hero-p", clamp(y / innerHeight, 0, 1).toFixed(3));
      words && words.update();
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // 導入文を語ごとに分け、スクロール量に合わせて順に明るくする
  function setupRevealWords(el) {
    if (!el) return null;
    const text = el.textContent.replace(/\s*\n\s*/g, "").trim();
    let parts;
    if ("Segmenter" in Intl) {
      parts = [...new Intl.Segmenter("ja", { granularity: "word" }).segment(text)].map((s) => s.segment);
    } else {
      parts = [...text];
    }
    el.textContent = "";
    const spans = parts.map((p) => {
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = p;
      el.appendChild(s);
      return s;
    });
    if (reduceMotion) spans.forEach((s) => s.classList.add("on"));
    return {
      update() {
        if (reduceMotion) return;
        const r = el.getBoundingClientRect();
        // 段落の上端が画面の 85% に来たら始まり、下端が 45% に来たら全部点く
        const start = innerHeight * 0.85, end = innerHeight * 0.45;
        const p = clamp((start - r.top) / (start - end + r.height), 0, 1);
        const n = Math.round(p * spans.length);
        spans.forEach((s, i) => s.classList.toggle("on", i < n));
      },
    };
  }

  // ---------- 画面に入ったら表示 ----------
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
        e.target.dispatchEvent(new CustomEvent("enter"));
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
  );
  $$(".fade-up").forEach((el) => io.observe(el));

  // 数字のカウントアップ
  $$("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const card = el.closest(".fade-up");
    if (reduceMotion || !card) return;
    el.textContent = "0";
    card.addEventListener("enter", () => {
      const t0 = performance.now(), dur = 1400;
      const step = (t) => {
        const k = clamp((t - t0) / dur, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // ---------- LUT の比較スライダー ----------
  (function compareSlider() {
    const box = $("#compare");
    if (!box) return;
    const range = $(".compare-range", box);
    const after = $(".compare-after", box);
    const before = $(".compare-before img", box);
    const name = $("#compareName");
    let pos = 50, dragging = false, hinted = false;

    const set = (v) => {
      pos = clamp(v, 0, 100);
      box.style.setProperty("--pos", pos + "%");
      range.value = pos;
      $(".compare-tag-before", box).style.opacity = pos < 12 ? 0 : 1;
      $(".compare-tag-after", box).style.opacity = pos > 88 ? 0 : 1;
    };
    const fromEvent = (e) => {
      const r = box.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };

    // マウス・タッチは枠全体で受ける(縦方向はページのスクロールに任せる)。キーボードは range で受ける
    range.style.pointerEvents = "none";
    box.addEventListener("pointerdown", (e) => {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      box.classList.add("is-dragging");
      fromEvent(e);
    });
    box.addEventListener("pointermove", (e) => dragging && fromEvent(e));
    const stop = () => { dragging = false; box.classList.remove("is-dragging"); };
    box.addEventListener("pointerup", stop);
    box.addEventListener("pointercancel", stop);
    range.addEventListener("input", () => set(Number(range.value)));

    // 初めて見えたときに左右に動かして、操作できることを示す
    const hint = () => {
      if (hinted || reduceMotion) return;
      hinted = true;
      const keys = [[0, 50], [700, 22], [1500, 78], [2200, 50]];
      const t0 = performance.now();
      const step = (t) => {
        if (dragging) return;
        const dt = t - t0;
        let i = 0;
        while (i < keys.length - 2 && dt > keys[i + 1][0]) i++;
        const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
        const k = clamp((dt - ta) / (tb - ta), 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        set(va + (vb - va) * e);
        if (dt < keys[keys.length - 1][0]) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    new IntersectionObserver((es, o) => {
      if (es[0].isIntersecting) { setTimeout(hint, 400); o.disconnect(); }
    }, { threshold: 0.6 }).observe(box);

    // 写真の切り替え(両方読み込んでから差し替える)
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = src; });
    $$(".chip[data-lut]").forEach((chip) => {
      chip.addEventListener("click", async () => {
        if (chip.classList.contains("is-active")) return;
        $$(".chip[data-lut]").forEach((c) => {
          const on = c === chip;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-selected", on);
        });
        const key = chip.dataset.lut;
        const a = `assets/img/lut-${key}-after.jpg`, b = `assets/img/lut-${key}-before.jpg`;
        box.classList.add("is-loading");
        await Promise.all([load(a), load(b)]);
        after.src = a;
        before.src = b;
        name.textContent = chip.dataset.name;
        box.classList.remove("is-loading");
      });
    });
    // 他の比較用画像は手が空いたら先に読んでおく
    addEventListener("load", () => {
      setTimeout(() => $$(".chip[data-lut]").forEach((c) => {
        load(`assets/img/lut-${c.dataset.lut}-after.jpg`);
        load(`assets/img/lut-${c.dataset.lut}-before.jpg`);
      }), 1500);
    });
    set(50);
  })();

  // ---------- ルーペ ----------
  (function loupe() {
    const box = $("#loupe");
    if (!box) return;
    const img = $("img", box);
    const lens = $(".loupe-lens", box);
    const ZOOM = 3.2;
    lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    img.addEventListener("load", () => (lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`));

    const place = (x, y) => {
      const r = box.getBoundingClientRect();
      const size = lens.offsetWidth;
      lens.style.transform = "";
      lens.style.left = x - size / 2 + "px";
      lens.style.top = y - size / 2 + "px";
      lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
      lens.style.backgroundPosition = `${-(x * ZOOM - size / 2)}px ${-(y * ZOOM - size / 2)}px`;
    };

    if (matchMedia("(hover: hover)").matches) {
      box.addEventListener("pointerenter", () => box.classList.add("is-active"));
      box.addEventListener("pointerleave", () => box.classList.remove("is-active"));
      box.addEventListener("pointermove", (e) => {
        const r = box.getBoundingClientRect();
        place(e.clientX - r.left, e.clientY - r.top);
      });
    } else {
      // タッチ端末: ルーペがゆっくり動き回る
      $(".loupe-hint", box).textContent = "等倍の確認";
      box.classList.add("is-auto");
      let visible = false;
      new IntersectionObserver((es) => (visible = es[0].isIntersecting)).observe(box);
      const step = (t) => {
        if (visible) {
          const r = box.getBoundingClientRect();
          const s = reduceMotion ? 0 : t / 2600;
          place(r.width * (0.5 + 0.28 * Math.sin(s)), r.height * (0.5 + 0.25 * Math.sin(s * 1.7)));
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  })();

  // ---------- 傾き補正の角度表示 ----------
  (function tiltReadout() {
    const img = $(".tilt-photo img");
    const label = $(".tilt-angle");
    if (!img || !label) return;
    const step = () => {
      const m = getComputedStyle(img).transform;
      if (m && m !== "none") {
        const v = m.match(/matrix\(([^)]+)\)/);
        if (v) {
          const [a, b] = v[1].split(",").map(Number);
          const deg = (Math.atan2(b, a) * 180) / Math.PI;
          label.textContent = (deg >= 0 ? "+" : "−") + Math.abs(deg).toFixed(1) + "°";
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();

  // ---------- ファイル名テンプレート ----------
  (function templates() {
    const tin = $("#tplIn"), tout = $("#tplOut");
    if (!tin || !tout || reduceMotion) return;
    const examples = [   // 実際の ARW で rawdev name を実行した結果(拡張子は形式に合わせて付く)
      ["{date}_{seq:3}", "20260621_001.jpg"],
      ["{date:yyyy-MM-dd}_{seq:3}", "2026-06-21_001.jpg"],
      ["{date}_{time}_{name}", "20260621_151941_DSC03356.heic"],
      ["{date}_{lens}", "20260621_FE 16-35mm F2.8 GM.jpg"],
      ["{model}_{iso}_{f}", "ILCE-7SM3_80_2.8.tif"],
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % examples.length;
      tin.classList.add("tpl-fade");
      tout.classList.add("tpl-fade");
      setTimeout(() => {
        [tin.textContent, tout.textContent] = examples[i];
        tin.classList.remove("tpl-fade");
        tout.classList.remove("tpl-fade");
      }, 320);
    }, 3200);
  })();

  // ---------- 構図ガイド(アプリの CompositionGuide と同じ計算) ----------
  (function guides() {
    const svg = $("#guideSvg");
    if (!svg) return;
    const W = 1500, H = 1000, ASPECT = W / H;
    const PHI = (1 + Math.sqrt(5)) / 2;
    const NS = "http://www.w3.org/2000/svg";
    const colors = {
      halves: "#ebebeb", thirds: "#ffffff", golden: "#ffcc4d", silver: "#9ed6ff",
      diagonal: "#d9a6ff", triangle: "#a6f07a", spiral: "#ff8c61",
    };
    const grid = (ps, style) => ps.flatMap((p) => [
      { pts: [[p, 0], [p, 1]], style }, { pts: [[0, p], [1, p]], style },
    ]);
    const silver = 1 / (1 + Math.SQRT2);

    function spiral(fh, fv) {
      let x = 0, y = 0, w = PHI, h = 1;
      const pts = [], divs = [];
      const steps = 10, per = 24;
      for (let i = 0; i < steps; i++) {
        let s, c, a0;
        switch (i % 4) {
          case 0: s = h; c = [x + s, y + s]; a0 = Math.PI; divs.push([[x + s, y], [x + s, y + h]]); x += s; w -= s; break;
          case 1: s = w; c = [x, y + s]; a0 = 1.5 * Math.PI; divs.push([[x, y + s], [x + w, y + s]]); y += s; h -= s; break;
          case 2: s = h; c = [x + w - s, y]; a0 = 0; divs.push([[x + w - s, y], [x + w - s, y + h]]); w -= s; break;
          default: s = w; c = [x + w, y + h - s]; a0 = 0.5 * Math.PI; divs.push([[x, y + h - s], [x + w, y + h - s]]); h -= s;
        }
        for (let k = 0; k <= per; k++) {
          if (k === 0 && i > 0) continue;
          const a = a0 + (k / per) * (Math.PI / 2);
          pts.push([c[0] + s * Math.cos(a), c[1] + s * Math.sin(a)]);
        }
      }
      const map = ([px, py]) => {
        let nx = px / PHI, ny = py;
        if (fh) nx = 1 - nx;
        if (fv) ny = 1 - ny;
        return [nx, ny];
      };
      return [
        ...divs.map((d) => ({ pts: d.map(map), style: "fine" })),
        { pts: pts.map(map), style: "solid", draw: true },
      ];
    }

    function triangle() {
      const a = ASPECT, dx = a, dy = 1, len2 = dx * dx + dy * dy;
      const foot = ([px, py]) => { const t = (px * dx + py * dy) / len2; return [t * dx, t * dy]; };
      const map = ([px, py]) => [px / a, py];
      return [
        { pts: [[0, 0], [1, 1]], style: "solid", draw: true },
        { pts: [map([a, 0]), map(foot([a, 0]))], style: "solid", draw: true },
        { pts: [map([0, 1]), map(foot([0, 1]))], style: "solid", draw: true },
      ];
    }

    const defs = {
      halves: () => grid([0.5], "dashed"),
      thirds: () => grid([1 / 3, 2 / 3], "solid"),
      golden: () => grid([1 - 1 / PHI, 1 / PHI], "solid"),
      silver: () => grid([silver, 1 - silver], "solid"),
      diagonal: () => [{ pts: [[0, 0], [1, 1]], style: "solid", draw: true }, { pts: [[1, 0], [0, 1]], style: "solid", draw: true }],
      triangle,
    };

    // 螺旋の向き: アプリと同じく 右下 → 左下 → 左上 → 右上 の順に中心が回る
    const flips = [[false, false], [true, false], [true, true], [false, true]];
    const eyeOf = ([fh, fv]) => spiral(fh, fv).at(-1).pts.at(-1);
    const quadrant = ([x, y]) => (y > 0.5 ? (x > 0.5 ? 0 : 1) : (x > 0.5 ? 3 : 2)); // 0:右下 1:左下 2:左上 3:右上
    const order = flips.slice().sort((p, q) => quadrant(eyeOf(p)) - quadrant(eyeOf(q)));
    let spiralIndex = 1; // 左下が中心(花のテーブルの近く)

    const on = new Set(["spiral"]);
    const groups = {};

    function strokeScale() {
      return W / Math.max(1, svg.getBoundingClientRect().width);
    }
    function pathD(pts) {
      return pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * W).toFixed(1)} ${(y * H).toFixed(1)}`).join(" ");
    }
    function render(id, animate) {
      groups[id]?.remove();
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "g" + (on.has(id) ? "" : " off"));
      const list = id === "spiral" ? spiral(...order[spiralIndex]) : defs[id]();
      const k = strokeScale();
      for (const p of list) {
        const el = document.createElementNS(NS, "path");
        el.setAttribute("d", pathD(p.pts));
        el.setAttribute("stroke", colors[id]);
        const width = p.style === "fine" ? 1.2 : 2.4;
        el.setAttribute("stroke-width", (width * k).toFixed(2));
        el.dataset.w = width;
        el.setAttribute("stroke-opacity", p.style === "fine" ? 0.7 : 1);
        if (p.style === "dashed") el.setAttribute("stroke-dasharray", `${(8 * k).toFixed(1)} ${(6 * k).toFixed(1)}`);
        if (animate && p.draw && !reduceMotion) {
          el.setAttribute("pathLength", "1");
          el.style.setProperty("--len", "1");
          el.classList.add("draw");
        }
        g.appendChild(el);
      }
      svg.appendChild(g);
      groups[id] = g;
    }
    function rescale() {
      const k = strokeScale();
      $$("path", svg).forEach((p) => {
        p.setAttribute("stroke-width", (Number(p.dataset.w) * k).toFixed(2));
        if (p.hasAttribute("stroke-dasharray")) p.setAttribute("stroke-dasharray", `${(8 * k).toFixed(1)} ${(6 * k).toFixed(1)}`);
      });
    }
    addEventListener("resize", rescale);

    Object.keys(colors).forEach((id) => render(id, false));
    // 見えたときに、表示中のガイドを描き始める
    const stage = svg.closest(".fade-up");
    stage && stage.addEventListener("enter", () => on.forEach((id) => render(id, true)));

    $$(".gchip[data-guide]").forEach((b) => {
      b.setAttribute("aria-pressed", on.has(b.dataset.guide));
      b.addEventListener("click", () => {
        const id = b.dataset.guide;
        on.has(id) ? on.delete(id) : on.add(id);
        b.classList.toggle("is-on", on.has(id));
        b.setAttribute("aria-pressed", on.has(id));
        render(id, on.has(id));
      });
    });
    $("#spiralRotate").addEventListener("click", () => {
      spiralIndex = (spiralIndex + 1) % order.length;
      if (!on.has("spiral")) {
        on.add("spiral");
        const b = $('.gchip[data-guide="spiral"]');
        b.classList.add("is-on");
        b.setAttribute("aria-pressed", true);
      }
      render("spiral", true);
    });
  })();

  // ---------- ターミナルの打鍵 ----------
  (function terminal() {
    const box = $(".terminal");
    const body = $("#terminal");
    if (!box || !body || reduceMotion) return;
    const items = $$(".t-line, .t-out", body);
    const texts = items.map((el) => el.innerHTML);
    box.classList.add("typing");
    box.addEventListener("enter", async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (el.classList.contains("t-line") && !el.classList.contains("t-cursor")) {
          const prompt = el.querySelector(".t-prompt").outerHTML;
          const cmd = el.textContent.replace(/^\$\s*/, "");
          el.classList.add("t-shown", "t-cursor");
          for (let n = 0; n <= cmd.length; n++) {
            el.innerHTML = prompt + " " + escapeHTML(cmd.slice(0, n));
            await sleep(18 + Math.random() * 40);
          }
          await sleep(350);
          el.classList.remove("t-cursor");
          el.innerHTML = texts[i];
        } else {
          el.classList.add("t-shown");
          await sleep(el.classList.contains("t-out") ? 450 : 0);
        }
      }
    });
    function escapeHTML(s) {
      return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }
  })();

  // ---------- ギャラリー(途切れずに流れるよう写真を複製) ----------
  (function marquee() {
    const track = $(".marquee-track");
    if (!track) return;
    $$("img", track).forEach((img) => track.appendChild(img.cloneNode()));
  })();

  // ---------- コピー ----------
  (function copy() {
    const btn = $("#copyBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const text = $("#installCode").innerText.trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "コピーしました";
      } catch {
        btn.textContent = "コピーできません";
      }
      setTimeout(() => (btn.textContent = "コピー"), 1800);
    });
  })();
})();
