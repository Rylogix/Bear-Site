// import gsap from 'https://cdn.skypack.dev/gsap'; // Removed

export class TargetCursor {
  constructor({
    targetSelector = '.cursor-target',
    spinDuration = 2,
    hideDefaultCursor = true,
    hoverDuration = 0.2,
    parallaxOn = true,
    quality = 'high'
  } = {}) {
    this.targetSelector = targetSelector;
    this.spinDuration = spinDuration;
    this.hideDefaultCursor = hideDefaultCursor;
    this.hoverDuration = hoverDuration;
    this.parallaxOn = parallaxOn;
    this.quality = quality;

    this.isMobile = this.checkMobile();
    if (this.isMobile) return;
    
    // Position state for RAF loop
    this.cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    this.init();
  }

  checkMobile() {
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
    return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
  }

  init() {
    if (this.hideDefaultCursor) {
      document.body.style.cursor = 'none';
    }

    this.createCursorElements();
    this.initGSAP();
    
    // Add render loop for cursor movement
    gsap.ticker.add(this.renderCursor);
    
    this.addEventListeners();
    
    this.activeTarget = null;
    this.activeStrength = 0;
    this.constants = { borderWidth: 3, cornerSize: 12 };
  }

  createCursorElements() {
    this.cursorWrapper = document.createElement('div');
    this.cursorWrapper.className = 'target-cursor-wrapper';
    
    this.dot = document.createElement('div');
    this.dot.className = 'target-cursor-dot';
    
    this.corners = [];
    const positions = ['tl', 'tr', 'br', 'bl'];
    
    positions.forEach(pos => {
      const corner = document.createElement('div');
      corner.className = `target-cursor-corner corner-${pos}`;
      this.cursorWrapper.appendChild(corner);
      this.corners.push(corner);
    });
    
    this.cursorWrapper.appendChild(this.dot);
    document.body.appendChild(this.cursorWrapper);
  }

  initGSAP() {
    gsap.set(this.cursorWrapper, {
      xPercent: -50,
      yPercent: -50,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });

    this.spinTl = gsap.timeline({ repeat: -1 })
      .to(this.cursorWrapper, { rotation: '+=360', duration: this.spinDuration, ease: 'none' });
  }

  addEventListeners() {
    this.moveHandler = (e) => this.moveCursor(e.clientX, e.clientY);
    window.addEventListener('mousemove', this.moveHandler);

    this.enterHandler = (e) => this.handleEnter(e);
    window.addEventListener('mouseover', this.enterHandler, { passive: true });

    // Scroll handler to check if we're still over target
    this.scrollHandler = () => {
      // Optimization: On low quality, avoid expensive elementFromPoint checks during scroll
      // Or throttle it. For now, just skip if low.
      if (this.quality === 'low') return;

      if (!this.activeTarget) return;
      const mouseX = gsap.getProperty(this.cursorWrapper, 'x');
      const mouseY = gsap.getProperty(this.cursorWrapper, 'y');
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
      
      const isStillOverTarget = elementUnderMouse && 
        (elementUnderMouse === this.activeTarget || elementUnderMouse.closest(this.targetSelector) === this.activeTarget);
        
      if (!isStillOverTarget) {
        this.handleLeave();
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Click effects
    window.addEventListener('mousedown', () => {
        gsap.to(this.dot, { scale: 0.7, duration: 0.3 });
        gsap.to(this.cursorWrapper, { scale: 0.9, duration: 0.2 });
    });
    
    window.addEventListener('mouseup', () => {
        gsap.to(this.dot, { scale: 1, duration: 0.3 });
        gsap.to(this.cursorWrapper, { scale: 1, duration: 0.2 });
    });
  }

  moveCursor(x, y) {
    this.mousePos.x = x;
    this.mousePos.y = y;
  }

  renderCursor = () => {
    // Lerp cursor position for smoothness
    const dt = 1.0 - Math.pow(0.1, gsap.ticker.deltaRatio());
    // Adjust lerp speed based on frame time? 0.2 is good general smoothness
    // Simple lerp: current + (target - current) * factor
    
    // Increased factor for snappier feel (0.2 -> 0.5)
    // On high refresh rates, deltaRatio is small, so we might want even more.
    const factor = 0.5; 
    
    this.cursorPos.x += (this.mousePos.x - this.cursorPos.x) * factor;
    this.cursorPos.y += (this.mousePos.y - this.cursorPos.y) * factor;
    
    // If very close, snap
    if (Math.abs(this.mousePos.x - this.cursorPos.x) < 0.1) this.cursorPos.x = this.mousePos.x;
    if (Math.abs(this.mousePos.y - this.cursorPos.y) < 0.1) this.cursorPos.y = this.mousePos.y;

    gsap.set(this.cursorWrapper, {
      x: this.cursorPos.x,
      y: this.cursorPos.y
    });
  }

  handleEnter(e) {
    let target = e.target;
    // Walk up the tree to find matching selector
    while (target && target !== document.body) {
      if (target.matches(this.targetSelector)) {
        break;
      }
      target = target.parentElement;
    }

    if (!target || target === document.body || !target.matches(this.targetSelector)) return;
    if (this.activeTarget === target) return;

    if (this.activeTarget) {
      this.handleLeave();
    }

    this.activeTarget = target;
    
    // Stop spin and reset rotation
    this.spinTl.pause();
    gsap.killTweensOf(this.cursorWrapper, 'rotation');
    gsap.set(this.cursorWrapper, { rotation: 0 });

    const rect = target.getBoundingClientRect();
    const { borderWidth, cornerSize } = this.constants;
    
    // Calculate target positions for corners relative to cursor
    // But since cursor is moving, we need to update this in a ticker
    this.targetRect = rect;
    
    this.isActive = true;
    
    // Animate strength up
    gsap.to(this, {
        activeStrength: 1,
        duration: this.hoverDuration,
        ease: 'power2.out'
    });

    // Start ticker
    gsap.ticker.add(this.ticker);
    
    target.addEventListener('mouseleave', () => this.handleLeave(), { once: true });
  }

  handleLeave() {
    if (!this.activeTarget) return;
    
    this.isActive = false;
    this.activeTarget = null;
    
    gsap.ticker.remove(this.ticker);
    
    // Animate strength down
    this.activeStrength = 0;

    // Reset corners
    const { cornerSize } = this.constants;
    const positions = [
        { x: -cornerSize * 1.5, y: -cornerSize * 1.5 }, // tl
        { x: cornerSize * 0.5, y: -cornerSize * 1.5 },  // tr
        { x: cornerSize * 0.5, y: cornerSize * 0.5 },   // br
        { x: -cornerSize * 1.5, y: cornerSize * 0.5 }   // bl
    ];

    this.corners.forEach((corner, i) => {
        gsap.to(corner, {
            x: positions[i].x,
            y: positions[i].y,
            duration: 0.3,
            ease: 'power3.out'
        });
    });

    // Resume spin
    // Calculate nearest 360 to smooth out
    const currentRotation = gsap.getProperty(this.cursorWrapper, 'rotation');
    const normalizedRotation = currentRotation % 360;
    
    this.spinTl.kill();
    this.spinTl = gsap.timeline({ repeat: -1 })
        .to(this.cursorWrapper, { rotation: '+=360', duration: this.spinDuration, ease: 'none' });
        
    gsap.to(this.cursorWrapper, {
        rotation: normalizedRotation + 360,
        duration: this.spinDuration * (1 - normalizedRotation / 360),
        ease: 'none',
        onComplete: () => {
            this.spinTl.restart();
        }
    });
  }

  ticker = () => {
    if (!this.activeTarget) return;
    
    const strength = this.activeStrength;
    if (strength === 0) return;

    const cursorX = gsap.getProperty(this.cursorWrapper, 'x');
    const cursorY = gsap.getProperty(this.cursorWrapper, 'y');
    
    // Update rect in case of scroll/resize (optional, but good for accuracy)
    const rect = this.activeTarget.getBoundingClientRect();
    const { borderWidth, cornerSize } = this.constants;

    const targetPositions = [
        { x: rect.left - borderWidth, y: rect.top - borderWidth },
        { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
        { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
        { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize }
    ];

    this.corners.forEach((corner, i) => {
        const currentX = gsap.getProperty(corner, 'x');
        const currentY = gsap.getProperty(corner, 'y');

        // Target position relative to cursor center
        const targetX = targetPositions[i].x - cursorX;
        const targetY = targetPositions[i].y - cursorY;

        const finalX = currentX + (targetX - currentX) * strength;
        const finalY = currentY + (targetY - currentY) * strength;

        // Snappiness depends on strength
        const duration = strength >= 0.99 ? (this.parallaxOn ? 0.2 : 0) : 0.05;

        gsap.to(corner, {
            x: finalX,
            y: finalY,
            duration: duration,
            ease: duration === 0 ? 'none' : 'power1.out',
            overwrite: 'auto'
        });
    });
  }
}
