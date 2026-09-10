/* ============================================================
   script.js — 나를 소개하는 한 페이지
   테마 토글 · 스크롤 페이드인 · 부드러운 네비게이션
   ============================================================ */

(function () {
  "use strict";

  // ── 테마 토글 ──────────────────────────────────────────────
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  const THEME_KEY = "preferred-theme";

  // 저장된 테마가 있으면 적용, 없으면 시스템 설정 확인
  function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    // 시스템 라이트 모드면 light, 아니면 dark (기본)
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    body.setAttribute("data-theme", theme);
    const icon = themeToggle.querySelector(".theme-toggle__icon");
    icon.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  // 초기 테마 적용
  applyTheme(getInitialTheme());

  themeToggle.addEventListener("click", function () {
    const current = body.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // 시스템 테마 변경 감지
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function (e) {
      // 사용자가 수동으로 전환한 적 없으면 시스템 따라감
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });

  // ── 스크롤 페이드인 (Intersection Observer) ────────────────
  const fadeEls = document.querySelectorAll(".fade-in");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target); // 한 번만 실행
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    fadeEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Intersection Observer 미지원 브라우저 — 바로 표시
    fadeEls.forEach(function (el) {
      el.classList.add("visible");
    });
  }

  // ── 네비게이션 활성 상태 표시 ──────────────────────────────
  const navLinks = document.querySelectorAll(".nav__links a");
  const sections = document.querySelectorAll("main .section");

  if ("IntersectionObserver" in window && sections.length > 0) {
    const navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            navLinks.forEach(function (link) {
              link.classList.toggle(
                "active",
                link.getAttribute("href") === "#" + id
              );
            });
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: "-60px 0px -40% 0px",
      }
    );

    sections.forEach(function (section) {
      navObserver.observe(section);
    });
  }
})();
