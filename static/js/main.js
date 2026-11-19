// TMA project page behaviour:
//   - side nav appears once past the hero, with scroll-spy highlighting
//   - hero background video (paused for prefers-reduced-motion)
//   - lazy videos: nothing downloads until a clip nears the viewport; clips play
//     once at 1x, hold their last frame, and flag their outcome near the end
//   - results-chart tooltip, figure lightbox, BibTeX copy button

(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  function initNav() {
    var nav = document.querySelector('.sidenav');
    var hero = document.querySelector('.hero');
    if (!nav || !hero) return;

    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var pending = false;

    function update() {
      pending = false;
      var y = window.scrollY;
      nav.classList.toggle('is-visible', y > hero.offsetHeight * 0.6);

      var checkpoint = y + window.innerHeight * 0.35;
      var active = -1;
      targets.forEach(function (t, i) {
        if (t && t.getBoundingClientRect().top + y <= checkpoint) active = i;
      });
      // At the very bottom, the last section wins even if it is short.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) active = targets.length - 1;

      links.forEach(function (a, i) {
        var on = i === active;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }

    function schedule() {
      if (!pending) { pending = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Hero video                                                          */
  /* ------------------------------------------------------------------ */
  function initHeroVideo() {
    var v = document.querySelector('.hero-video');
    if (!v) return;

    // Portrait screens get the portrait cut, so the grid is not cropped to its seam.
    var portrait = window.matchMedia && window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    var kind = portrait ? 'portrait' : 'landscape';
    v.poster = v.getAttribute('data-poster-' + kind) || '';
    v.muted = true;
    if (reduceMotion) return; // poster only

    v.src = v.getAttribute('data-src-' + kind);
    // If the clip cannot load, fall back to the poster painted behind it.
    v.addEventListener('error', function () { v.style.display = 'none'; });

    function play() { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    play();

    // Pause the background loop while the hero is off screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) play(); else v.pause(); });
      }).observe(v);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Lazy content videos                                                 */
  /* ------------------------------------------------------------------ */
  function isRendered(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function load(video) {
    if (!video.dataset.src || video.dataset.loaded === 'true') return;
    video.src = video.dataset.src;
    video.dataset.loaded = 'true';
  }

  function tryPlay(video) {
    // A finished clip stays parked on its last frame; only pressing play restarts it.
    if (video.ended) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  // Every clip on the page is stated to play at 1x, so hold it there.
  function lockPlaybackRate(video) {
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;
    video.addEventListener('ratechange', function () {
      if (video.playbackRate !== 1) video.playbackRate = 1;
    });
  }

  // Flag the outcome for the final second, then hold it on the last frame.
  var COMPLETE_LEAD = 1;
  function initCompletionState(video) {
    var frame = video.closest('.vframe');
    if (!frame) return;
    function sync() {
      var d = video.duration;
      var known = isFinite(d) && d > 0;
      var threshold = known && d > COMPLETE_LEAD ? d - COMPLETE_LEAD : d;
      frame.classList.toggle('is-complete', (known && video.currentTime >= threshold) || video.ended);
    }
    ['loadedmetadata', 'timeupdate', 'seeking', 'seeked', 'play', 'ended'].forEach(function (name) {
      video.addEventListener(name, sync);
    });
  }

  function initVideos() {
    var videos = Array.prototype.slice.call(document.querySelectorAll('.lazy-video'));
    videos.forEach(lockPlaybackRate);
    videos.forEach(initCompletionState);

    if (!('IntersectionObserver' in window)) {
      videos.filter(isRendered).forEach(load);
      return;
    }

    // Start fetching while a clip is still approaching.
    var preload = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) load(e.target); });
    }, { rootMargin: '300px 0px', threshold: 0 });

    function playObserver(options) {
      return new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting && isRendered(v)) { load(v); tryPlay(v); }
          else if (!e.isIntersecting && v.dataset.loaded === 'true') v.pause();
        });
      }, options);
    }

    // Clips play once, so sections marked data-play-in-view wait until a clip is
    // genuinely on screen rather than starting while it is still below the fold.
    var whenApproaching = playObserver({ rootMargin: '200px 0px', threshold: 0.1 });
    var whenInView = playObserver({ rootMargin: '0px', threshold: 0.5 });

    videos.forEach(function (v) {
      preload.observe(v);
      (v.closest('[data-play-in-view]') ? whenInView : whenApproaching).observe(v);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Results chart tooltip                                               */
  /* ------------------------------------------------------------------ */
  // Values are also printed (TMA labels, legend totals, data table); the tooltip only adds detail.
  function initChart() {
    var frame = document.querySelector('#results-chart .chart-frame');
    if (!frame) return;
    var tip = frame.querySelector('.chart-tooltip');
    var bars = Array.prototype.slice.call(frame.querySelectorAll('.bar'));

    function show(bar) {
      var s = bar.getAttribute('data-s'), g = bar.getAttribute('data-g');
      tip.textContent = '';
      var title = document.createElement('b');
      title.textContent = bar.getAttribute('data-knob') + ' \u00b7 ' + bar.getAttribute('data-method');
      tip.appendChild(title);
      [[s, ' / 10 doors opened'], [g, ' / 10 stable grasps']].forEach(function (row) {
        var line = document.createElement('span');
        line.style.display = 'block';
        var v = document.createElement('strong');
        v.textContent = row[0];
        line.appendChild(v);
        line.appendChild(document.createTextNode(row[1]));
        tip.appendChild(line);
      });
      var fr = frame.getBoundingClientRect(), br = bar.getBoundingClientRect();
      var top = br.bottom - br.height * (Number(g) / 10);   // top of the stacked column
      tip.style.left = (br.left + br.width / 2 - fr.left) + 'px';
      tip.style.top = (Math.min(top, br.bottom - 4) - fr.top) + 'px';
      tip.hidden = false;
    }
    function hide() { tip.hidden = true; }

    bars.forEach(function (bar) {
      bar.addEventListener('pointerenter', function () { show(bar); });
      bar.addEventListener('pointerleave', hide);
      bar.addEventListener('focus', function () { show(bar); });
      bar.addEventListener('blur', hide);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Figure lightbox                                                     */
  /* ------------------------------------------------------------------ */
  function initLightbox() {
    var box = document.getElementById('lightbox');
    if (!box || typeof box.showModal !== 'function') return;
    var img = box.querySelector('img');

    document.querySelectorAll('img.zoomable').forEach(function (fig) {
      fig.setAttribute('tabindex', '0');
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-label', 'Enlarge figure: ' + (fig.alt || ''));
      function open() {
        img.src = fig.currentSrc || fig.src;
        img.alt = fig.alt;
        var ratio = (fig.naturalWidth || 1) / (fig.naturalHeight || 1);
        box.classList.toggle('is-pan', window.innerWidth < 760 && ratio > 1.6);
        box.showModal();
        box.scrollLeft = 0;
      }
      fig.addEventListener('click', open);
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    box.addEventListener('click', function () { box.close(); });
    box.addEventListener('close', function () { img.removeAttribute('src'); });
  }

  /* ------------------------------------------------------------------ */
  /* BibTeX copy                                                         */
  /* ------------------------------------------------------------------ */
  function initCopy() {
    document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = document.getElementById(btn.getAttribute('data-copy-target'));
        if (!src) return;
        var text = src.innerText;
        var done = function () {
          var old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = old; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var range = document.createRange();
          range.selectNodeContents(src);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          try { document.execCommand('copy'); done(); } catch (e) { /* leave text selected */ }
        }
      });
    });
  }

  function init() {
    initNav();
    initHeroVideo();
    initChart();
    initVideos();
    initLightbox();
    initCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
