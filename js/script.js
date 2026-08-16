/**
 * FORMCOACH AI — VANILLA JAVASCRIPT
 * Sticky navbar, mobile menu, scroll reveal animations, and interactive metrics.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. STICKY NAVBAR ON SCROLL
  const navbar = document.getElementById('navbar');
  const handleScroll = () => {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check

  // 2. MOBILE NAVIGATION MENU
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  const toggleMobileMenu = () => {
    const isOpen = mobileNav.classList.toggle('open');
    mobileMenuBtn.classList.toggle('active', isOpen);
    mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const closeMobileMenu = () => {
    mobileNav.classList.remove('open');
    mobileMenuBtn.classList.remove('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeMobileMenu();
      }
    });
  }

  // 3. SCROLL REVEAL (IntersectionObserver)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealElements = document.querySelectorAll('.reveal-item');

  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // If reduced motion or no IntersectionObserver, display all immediately
    revealElements.forEach(el => el.classList.add('revealed'));
  }

  // 4. PROGRESS BAR ANIMATION (AI FORM ANALYZER)
  const progressFills = document.querySelectorAll('.progress-fill');
  const analyzerSection = document.getElementById('ai-form-analyzer');

  if (analyzerSection && !prefersReducedMotion && 'IntersectionObserver' in window) {
    const analyzerObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          progressFills.forEach(fill => {
            const targetWidth = fill.getAttribute('data-target-width');
            if (targetWidth) {
              fill.style.width = targetWidth;
            }
          });
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2
    });

    analyzerObserver.observe(analyzerSection);
  } else {
    progressFills.forEach(fill => {
      const targetWidth = fill.getAttribute('data-target-width');
      if (targetWidth) {
        fill.style.width = targetWidth;
      }
    });
  }

  // 5. SMOOTH ANCHOR SCROLLING (for older browser fallback)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const navOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
      }
    });
  });

  // 6. VIDEO PLAYBACK FALLBACK HANDLING
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.play().catch(() => {
      // Autoplay was prevented or video source not yet available; poster image displays seamlessly
      console.log('Video autoplay prevented or video pending; poster active.');
    });
  }
});
