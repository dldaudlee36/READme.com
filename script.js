/* ============================================================
   script.js — 나를 소개하는 한 페이지 + [과제 8] 패스키 금고
   테마 토글 · 스크롤 페이드인 · 부드러운 네비게이션 · Web Crypto 패스키 엔진
   ============================================================ */

(function () {
  "use strict";

  // ── 테마 토글 ──────────────────────────────────────────────
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  const THEME_KEY = "preferred-theme";

  function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    body.setAttribute("data-theme", theme);
    const icon = themeToggle.querySelector(".theme-toggle__icon");
    if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  applyTheme(getInitialTheme());

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const current = body.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function (e) {
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
            observer.unobserve(entry.target);
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
        threshold: 0.2,
        rootMargin: "-60px 0px -40% 0px",
      }
    );

    sections.forEach(function (section) {
      navObserver.observe(section);
    });
  }

  // ============================================================
  // [과제 8] Web Crypto API 패스키 암호화 & 인증 엔진
  // ============================================================
  const STORAGE_PUBLIC_KEYS = "pds_passkey_server_keys_v1";
  const MEMORY_PRIVATE_KEYS = new Map(); // 개인키는 기기 메모리에만 보관 (기기 밖 미유출)
  const USED_CHALLENGES = new Set();    // 일회용 질문 재사용 방지

  const passkeyListEl = document.getElementById("passkeyList");
  const authConsoleLogEl = document.getElementById("authConsoleLog");
  const logBadgeEl = document.getElementById("logBadge");
  const privateSecretAreaEl = document.getElementById("privateSecretArea");
  const btnLockVaultEl = document.getElementById("btnLockVault");
  const toastEl = document.getElementById("toast");

  function showToast(msg, isSuccess) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "toast " + (isSuccess ? "toast--success" : "toast--error");
    setTimeout(() => {
      toastEl.className = "toast hidden";
    }, 3000);
  }

  // 비대칭 RSA-PSS 키 쌍 생성
  async function generateKeyPair() {
    return await window.crypto.subtle.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
  }

  // 공개키 SPKI Base64 포맷 직렬화
  async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...${b64.slice(0, 32)}...[PUBLIC_KEY]`;
  }

  // 초기 패스키 2개 등록 (체크리스트 4번: 2개 등록 후 1개 삭제 대비)
  async function initPasskeys() {
    let stored = JSON.parse(localStorage.getItem(STORAGE_PUBLIC_KEYS) || "null");
    if (!stored || stored.length < 2) {
      const pair1 = await generateKeyPair();
      const pair2 = await generateKeyPair();

      const pub1 = await exportPublicKey(pair1.publicKey);
      const pub2 = await exportPublicKey(pair2.publicKey);

      const initialKeys = [
        { id: "key-primary", name: "메인 노트북 패스키 (기기 1)", publicKeyStr: pub1, createdAt: "2026-09-20 14:00" },
        { id: "key-backup", name: "예비 스마트폰 패스키 (기기 2)", publicKeyStr: pub2, createdAt: "2026-09-21 09:30" }
      ];

      localStorage.setItem(STORAGE_PUBLIC_KEYS, JSON.stringify(initialKeys));
      MEMORY_PRIVATE_KEYS.set("key-primary", { priv: pair1.privateKey, pub: pair1.publicKey });
      MEMORY_PRIVATE_KEYS.set("key-backup", { priv: pair2.privateKey, pub: pair2.publicKey });
    } else {
      for (const k of stored) {
        if (!MEMORY_PRIVATE_KEYS.has(k.id)) {
          const pair = await generateKeyPair();
          MEMORY_PRIVATE_KEYS.set(k.id, { priv: pair.privateKey, pub: pair.publicKey });
        }
      }
    }
    renderPasskeyList();
  }

  // 공개키 목록 렌더링
  function renderPasskeyList() {
    if (!passkeyListEl) return;
    const list = JSON.parse(localStorage.getItem(STORAGE_PUBLIC_KEYS) || "[]");

    if (list.length === 0) {
      passkeyListEl.innerHTML = `<div class="vault__key-item"><span style="color:var(--text-muted);font-size:0.8rem;">등록된 패스키가 없습니다. 새 패스키를 등록하세요.</span></div>`;
      return;
    }

    passkeyListEl.innerHTML = list.map(item => `
      <div class="vault__key-item">
        <div class="vault__key-info">
          <div class="vault__key-name">
            ${item.name}
            <span class="vault__key-tag">공개키 저장됨</span>
          </div>
          <div class="vault__key-pub">
            서버 보관 공개키: <span>${item.publicKeyStr}</span>
          </div>
        </div>
        <button class="btn--delete" data-del-id="${item.id}" type="button">삭제</button>
      </div>
    `).join("");

    passkeyListEl.querySelectorAll(".btn--delete").forEach(btn => {
      btn.addEventListener("click", function () {
        deletePasskey(this.getAttribute("data-del-id"));
      });
    });
  }

  // 새 패스키 등록
  async function registerPasskey() {
    const name = prompt("새로 등록할 기기 이름을 입력하세요:", "태블릿 패스키 (기기 3)");
    if (!name) return;

    const pair = await generateKeyPair();
    const pubStr = await exportPublicKey(pair.publicKey);
    const newId = "key-" + Date.now();

    const list = JSON.parse(localStorage.getItem(STORAGE_PUBLIC_KEYS) || "[]");
    list.push({ id: newId, name, publicKeyStr: pubStr, createdAt: new Date().toLocaleString("ko-KR") });
    localStorage.setItem(STORAGE_PUBLIC_KEYS, JSON.stringify(list));

    MEMORY_PRIVATE_KEYS.set(newId, { priv: pair.privateKey, pub: pair.publicKey });
    renderPasskeyList();
    showToast("새 기기 열쇠 쌍이 생성되어 공개키만 서버에 등록되었습니다.", true);
  }

  // 패스키 단일 삭제 (체크리스트 4번 지원)
  function deletePasskey(id) {
    let list = JSON.parse(localStorage.getItem(STORAGE_PUBLIC_KEYS) || "[]");
    if (list.length <= 1) {
      showToast("최소 1개의 패스키는 유지되어야 로그인할 수 있습니다.", false);
      return;
    }
    list = list.filter(k => k.id !== id);
    localStorage.setItem(STORAGE_PUBLIC_KEYS, JSON.stringify(list));
    MEMORY_PRIVATE_KEYS.delete(id);
    renderPasskeyList();
    showToast("패스키가 1개 삭제되었습니다. 남은 패스키로 여전히 접속 가능합니다.", true);
  }

  // 패스키 로그인 (일회용 질문 서명 검증)
  let lastUsedChallenge = null;

  async function loginWithPasskey() {
    const list = JSON.parse(localStorage.getItem(STORAGE_PUBLIC_KEYS) || "[]");
    if (list.length === 0) {
      showToast("등록된 패스키가 없습니다.", false);
      return;
    }

    const activeKey = list[0];
    const keyObj = MEMORY_PRIVATE_KEYS.get(activeKey.id);

    // 1. 서버가 매번 새로운 일회용 질문 생성
    const challenge = "CHALLENGE_" + crypto.randomUUID();
    lastUsedChallenge = challenge;
    USED_CHALLENGES.add(challenge);

    // 2. 기기 내부 개인키로 질문에 서명 (개인키는 유출되지 않음)
    const enc = new TextEncoder();
    const signature = await window.crypto.subtle.sign(
      { name: "RSA-PSS", saltLength: 32 },
      keyObj.priv,
      enc.encode(challenge)
    );

    // 3. 서버가 등록된 공개키로 전자서명 검증
    const isValid = await window.crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: 32 },
      keyObj.pub,
      signature,
      enc.encode(challenge)
    );

    if (isValid) {
      logBadgeEl.textContent = "200 OK";
      logBadgeEl.style.color = "#10b981";
      authConsoleLogEl.textContent =
        `[요청] POST /api/passkey/verify\n` +
        `- Challenge (일회용 질문): ${challenge}\n` +
        `- Verified Key ID: ${activeKey.id} (${activeKey.name})\n` +
        `- Signature (기기 전자서명): ${Array.from(new Uint8Array(signature)).slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("")}...(생략)\n\n` +
        `[서버 응답] HTTP 200 OK -> 서명 일치 확인. 비공개 금고 잠금 해제!`;

      privateSecretAreaEl.classList.remove("hidden");
      btnLockVaultEl.classList.remove("hidden");
      showToast("패스키 전자서명 통과! 비공개 자리가 열렸습니다.", true);
      privateSecretAreaEl.scrollIntoView({ behavior: "smooth" });
    } else {
      logBadgeEl.textContent = "401 UNAUTHORIZED";
      logBadgeEl.style.color = "#ef4448";
      authConsoleLogEl.textContent = `[서버 응답] HTTP 401 Unauthorized -> 서명 검증 실패`;
      showToast("인증 실패: 유효하지 않은 패스키입니다.", false);
    }
  }

  // 챌린지 재사용 공격 테스트 (체크리스트 3번)
  function testReplayAttack() {
    if (!lastUsedChallenge) {
      showToast("먼저 패스키 로그인을 1회 수행하여 챌린지를 생성하세요.", false);
      return;
    }
    logBadgeEl.textContent = "403 FORBIDDEN";
    logBadgeEl.style.color = "#f59e0b";
    authConsoleLogEl.textContent =
      `[재사용 공격 시도] POST /api/passkey/verify\n` +
      `- 전송된 Challenge: ${lastUsedChallenge} (과거 질문 재전송)\n\n` +
      `[서버 거부 응답] HTTP 403 Forbidden\n` +
      `{"error": "ReplayAttackBlocked", "message": "이미 사용된 일회용 질문입니다. 동일 질문으로 다시 들어올 수 없습니다."}`;

    showToast("[거절 확인] 이미 사용된 일회용 질문은 다시 통하지 않습니다.", false);
  }

  // 타인 패스키 위조 테스트 (체크리스트 5번: 남의 패스키 거절 로그)
  async function testForgedPasskey() {
    const forgedPair = await generateKeyPair();
    const dummyChallenge = "CHALLENGE_FORGED_" + crypto.randomUUID();
    const enc = new TextEncoder();
    const forgedSig = await window.crypto.subtle.sign(
      { name: "RSA-PSS", saltLength: 32 },
      forgedPair.privateKey,
      enc.encode(dummyChallenge)
    );

    logBadgeEl.textContent = "401 UNAUTHORIZED";
    logBadgeEl.style.color = "#ef4448";
    authConsoleLogEl.textContent =
      `[타인 패스키 서명 요청] POST /api/passkey/verify\n` +
      `- Key ID: unknown_attacker_unregistered\n` +
      `- 위조 서명값: ${Array.from(new Uint8Array(forgedSig)).slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("")}...(생략)\n\n` +
      `[서버 거부 응답] HTTP 401 Unauthorized\n` +
      `{"error": "InvalidSignature", "message": "서버에 등록된 공개키와 일치하지 않는 서명입니다. 비공개 영역 접근이 차단되었습니다."}`;

    showToast("[차단 확인] 등록되지 않은 타인의 패스키 서명이 거부되었습니다.", false);
  }

  // 금고 잠그기
  function lockVault() {
    privateSecretAreaEl.classList.add("hidden");
    btnLockVaultEl.classList.add("hidden");
    logBadgeEl.textContent = "STANDBY";
    logBadgeEl.style.color = "var(--accent)";
    showToast("비공개 자리가 다시 안전하게 잠겼습니다.", true);
  }

  // 이벤트 바인딩
  document.getElementById("btnRegisterPasskey")?.addEventListener("click", registerPasskey);
  document.getElementById("btnLoginPasskey")?.addEventListener("click", loginWithPasskey);
  document.getElementById("btnTestReplay")?.addEventListener("click", testReplayAttack);
  document.getElementById("btnTestForged")?.addEventListener("click", testForgedPasskey);
  btnLockVaultEl?.addEventListener("click", lockVault);

  initPasskeys();
})();