/**
 * Back-to-Top button — Crew platform shared script.
 * Creates and manages a fixed scroll-up button on long pages.
 * Styles live in accessibility.css (.back-to-top, .back-to-top.visible).
 *
 * Behaviour:
 *   - Button appears after scrolling 500 px down (rAF-debounced)
 *   - Click / Enter / Space → smooth scroll to top
 *   - Fully keyboard accessible with ARIA label
 *   - Does not conflict with existing page JS (wrapped in IIFE)
 */
(function () {
  'use strict';

  function init() {
    /* ── Create button ─────────────────────────────────────────── */
    var btn = document.createElement('button');
    btn.id        = 'back-to-top';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.setAttribute('title',      'Back to top');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<polyline points="18 15 12 9 6 15"/>' +
      '</svg>';

    document.body.appendChild(btn);

    /* ── Scroll visibility (rAF-debounced for 60 fps) ──────────── */
    var ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          btn.classList.toggle('visible', window.scrollY > 500);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Scroll to top ─────────────────────────────────────────── */
    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    btn.addEventListener('click', scrollToTop);

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToTop();
      }
    });
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
