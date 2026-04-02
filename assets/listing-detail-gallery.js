// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: photo gallery carousel (autoplay, scroll-snap sync, dots/counter) and photo sorting.
      const GALLERY_AUTO_MS = 3000;
      const GALLERY_AUTO_RESUME_MS = 5000;
      let galleryAutoplayTimer = null;
      let galleryAutoplayResumeTimer = null;
      let galleryScrollRaf = null;
      const galleryReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      function stopGalleryAutoplay() {
        if (galleryAutoplayTimer) {
          clearInterval(galleryAutoplayTimer);
          galleryAutoplayTimer = null;
        }
        if (galleryAutoplayResumeTimer) {
          clearTimeout(galleryAutoplayResumeTimer);
          galleryAutoplayResumeTimer = null;
        }
      }

      function startGalleryAutoplay() {
        stopGalleryAutoplay();
        if (state.photos.length <= 1 || galleryReduceMotion) return;
        galleryAutoplayTimer = window.setInterval(() => {
          scrollGalleryTo((state.photoIdx + 1) % state.photos.length);
        }, GALLERY_AUTO_MS);
      }

      function pauseGalleryAutoplay(resumeAfterMs = GALLERY_AUTO_RESUME_MS) {
        stopGalleryAutoplay();
        if (state.photos.length <= 1 || galleryReduceMotion) return;
        galleryAutoplayResumeTimer = window.setTimeout(startGalleryAutoplay, resumeAfterMs);
      }

      function syncGalleryDots() {
        for (const dot of rootEl.querySelectorAll('[data-gallery-dot]')) {
          const i = Number(dot.getAttribute('data-gallery-dot'));
          dot.setAttribute('aria-current', String(i === state.photoIdx));
        }
      }

      function syncGalleryCounter() {
        const counterEl = rootEl.querySelector('.gallery .counter');
        if (counterEl) counterEl.textContent = `${state.photoIdx + 1} / ${state.photos.length}`;
      }

      function galleryScrollLeftForIndex(track, index) {
        const width = track.clientWidth;
        if (width > 0) return Math.round(width * index);
        const slide = track.querySelector(`[data-gallery-slide="${index}"]`);
        return slide?.offsetLeft ?? 0;
      }

      function scrollGalleryTo(i, { smooth = true, instant = false } = {}) {
        if (state.photos.length === 0) return;
        const n = state.photos.length;
        const nextIdx = ((i % n) + n) % n;
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track?.querySelector(`[data-gallery-slide="${nextIdx}"]`)) return;
        state.photoIdx = nextIdx;
        const left = galleryScrollLeftForIndex(track, nextIdx);
        const useInstant = instant || galleryReduceMotion || !smooth;
        if (useInstant) {
          track.scrollLeft = left;
        } else {
          try {
            track.scrollTo({ left, behavior: 'smooth' });
          } catch {
            track.scrollLeft = left;
          }
        }
        syncGalleryDots();
        syncGalleryCounter();
      }

      function syncGalleryFromScroll() {
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track) return;
        const slides = [...track.querySelectorAll('[data-gallery-slide]')];
        if (slides.length === 0) return;
        const scrollLeft = track.scrollLeft;
        const width = track.clientWidth;
        let best = 0;
        let bestDist = Infinity;
        for (const [index, slide] of slides.entries()) {
          const targetLeft = width > 0 ? width * index : slide.offsetLeft;
          const dist = Math.abs(targetLeft - scrollLeft);
          if (dist < bestDist) {
            bestDist = dist;
            best = index;
          }
        }
        if (best === state.photoIdx) return;
        state.photoIdx = best;
        syncGalleryDots();
        syncGalleryCounter();
      }

      function sortedPhotos(listing) {
        const photos = Array.isArray(listing?.photos) ? [...listing.photos] : [];
        photos.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.photo_order ?? 0) - (b.photo_order ?? 0);
        });
        return photos;
      }
      function buildGalleryHtml() {
        if (state.photos.length === 0) {
          const placeholderSrc = UyDosh.noPhotoPlaceholderImageUrl(state.listing);
          const mainHtml = placeholderSrc
            ? `<img class="gallery-placeholder-img" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="" />`
            : `<div style="display: grid; place-items: center; width: 100%; height: 100%; color: var(--muted); font-weight: 700; letter-spacing: 0.12em;">UyDosh</div>`;
          return `
            <div class="gallery" aria-label="UyDosh">
              <div class="main">
                ${mainHtml}
              </div>
              ${shareButtonHtml()}
              ${favoriteButtonHtml()}
              ${reportButtonHtml()}
            </div>
          `;
        }
        const multi = state.photos.length > 1;
        const counter = multi
          ? `<div class="counter">${state.photoIdx + 1} / ${state.photos.length}</div>` : '';
        const dots = multi ? `
          <div class="gallery-dots" role="tablist" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.dots'))}">
            ${state.photos.map((_, i) => `
              <button
                type="button"
                class="gallery-dot"
                role="tab"
                data-gallery-dot="${i}"
                aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.photo'))} ${i + 1} / ${state.photos.length}"
                aria-current="${i === state.photoIdx ? 'true' : 'false'}"
              ></button>
            `).join('')}
          </div>
        ` : '';

        return `
          <div class="gallery" data-gallery>
            <div class="gallery-viewport">
              <div class="gallery-track" data-gallery-track tabindex="0" aria-roledescription="carousel">
                ${state.photos.map((p, i) => `
                  <div class="gallery-slide" data-gallery-slide="${i}" aria-roledescription="slide" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.photo'))} ${i + 1} / ${state.photos.length}">
                    <img
                      class="gallery-slide-bg"
                      aria-hidden="true"
                      ${i === 0 ? '' : 'loading="lazy" '}
                      src="${UyDosh.escapeHtml(UyDosh.photoUrl(p))}"
                      alt=""
                      draggable="false"
                    />
                    <div class="gallery-slide-scrim" aria-hidden="true"></div>
                    <img
                      class="gallery-slide-fg"
                      ${i === 0 ? '' : 'loading="lazy" '}
                      src="${UyDosh.escapeHtml(UyDosh.photoUrl(p))}"
                      alt="${UyDosh.escapeHtml(state.listing?.title || '')}"
                      draggable="false"
                    />
                  </div>
                `).join('')}
              </div>
              ${counter}
            </div>
            ${shareButtonHtml()}
            ${favoriteButtonHtml()}
            ${reportButtonHtml()}
            ${dots}
          </div>
        `;
      }

      function bindGallery() {
        stopGalleryAutoplay();
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track || state.photos.length <= 1) return;

        // Ignore pause triggers briefly after mount — iOS/Telegram can deliver a
        // ghost tap on the gallery when opening detail from a feed card.
        const pauseAfterMs = Date.now() + 700;
        const maybePauseAutoplay = () => {
          if (Date.now() < pauseAfterMs) return;
          pauseGalleryAutoplay();
        };

        track.addEventListener('scroll', () => {
          if (galleryScrollRaf) return;
          galleryScrollRaf = requestAnimationFrame(() => {
            galleryScrollRaf = null;
            syncGalleryFromScroll();
          });
        }, { passive: true });

        track.addEventListener('pointerdown', maybePauseAutoplay);
        track.addEventListener('touchstart', maybePauseAutoplay, { passive: true });
        track.addEventListener('wheel', maybePauseAutoplay, { passive: true });
        track.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') maybePauseAutoplay();
        });

        for (const dot of rootEl.querySelectorAll('[data-gallery-dot]')) {
          dot.addEventListener('click', () => {
            const i = Number(dot.getAttribute('data-gallery-dot'));
            if (Number.isNaN(i)) return;
            scrollGalleryTo(i);
            pauseGalleryAutoplay();
          });
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollGalleryTo(state.photoIdx, { instant: true });
            startGalleryAutoplay();
          });
        });
      }

      function showPhoto(i) {
        scrollGalleryTo(i);
        pauseGalleryAutoplay();
      }

