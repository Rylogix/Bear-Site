import gsap from 'https://cdn.skypack.dev/gsap';

export class PillNav {
  constructor(container, {
    items = [],
    activeId = 'home',
    onTabChange = () => {}
  } = {}) {
    this.container = container;
    this.items = items;
    this.activeId = activeId;
    this.onTabChange = onTabChange;
    
    this.init();
  }

  init() {
    this.render();
    this.addEventListeners();
    this.updateActiveState(this.activeId, true);
  }

  render() {
    // Create structure
    this.navElement = document.createElement('nav');
    this.navElement.className = 'pill-nav';
    
    // Logo (Static for now, can be parameterized)
    const logoLink = document.createElement('a');
    logoLink.className = 'pill-logo';
    logoLink.href = '#';
    const logoImg = document.createElement('img');
    logoImg.src = '../static/bear.png'; // Assuming a default logo
    logoImg.alt = 'Logo';
    logoLink.appendChild(logoImg);
    this.navElement.appendChild(logoLink);
    
    // Items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'pill-nav-items desktop-only';
    
    const ul = document.createElement('ul');
    ul.className = 'pill-list';
    
    this.items.forEach((item, index) => {
        const li = document.createElement('li');
        
        const link = document.createElement('a');
        link.className = 'pill';
        link.dataset.id = item.id;
        link.href = '#';
        
        const circle = document.createElement('span');
        circle.className = 'hover-circle';
        
        const labelStack = document.createElement('span');
        labelStack.className = 'label-stack';
        
        const label = document.createElement('span');
        label.className = 'pill-label';
        label.textContent = item.label;
        
        const labelHover = document.createElement('span');
        labelHover.className = 'pill-label-hover';
        labelHover.textContent = item.label;
        
        labelStack.appendChild(label);
        labelStack.appendChild(labelHover);
        
        link.appendChild(circle);
        link.appendChild(labelStack);
        li.appendChild(link);
        ul.appendChild(li);
    });
    
    itemsContainer.appendChild(ul);
    this.navElement.appendChild(itemsContainer);

    // Mobile menu button
    const mobileButton = document.createElement('button');
    mobileButton.className = 'mobile-menu-button mobile-only';
    mobileButton.type = 'button';
    mobileButton.setAttribute('aria-label', 'Open navigation');
    mobileButton.setAttribute('aria-expanded', 'false');
    mobileButton.innerHTML = `
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
    `;
    this.navElement.appendChild(mobileButton);

    // Mobile menu popover
    const mobilePopover = document.createElement('div');
    mobilePopover.className = 'mobile-menu-popover mobile-only';
    mobilePopover.id = 'pill-nav-mobile-menu';
    mobileButton.setAttribute('aria-controls', mobilePopover.id);

    const mobileList = document.createElement('ul');
    mobileList.className = 'mobile-menu-list';

    this.items.forEach((item) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'mobile-menu-link';
        link.href = '#';
        link.dataset.id = item.id;
        link.textContent = item.label;
        li.appendChild(link);
        mobileList.appendChild(li);
    });

    mobilePopover.appendChild(mobileList);
    this.navElement.appendChild(mobilePopover);
    
    this.container.appendChild(this.navElement);

    this.mobileMenuButton = mobileButton;
    this.mobileMenuPopover = mobilePopover;
    this.mobileMenuLinks = mobileList.querySelectorAll('.mobile-menu-link');

    // Initial GSAP setup for circles
    requestAnimationFrame(() => this.setupCircleLayout());
    window.addEventListener('resize', () => this.setupCircleLayout());
  }

  setupCircleLayout() {
    const pills = this.navElement.querySelectorAll('.pill');
    pills.forEach(pill => {
        const circle = pill.querySelector('.hover-circle');
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        
        // Geometric calculation for circle size and position to cover pill
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
            xPercent: -50,
            scale: 0,
            transformOrigin: `50% ${originY}px`
        });
    });
  }

  addEventListeners() {
    const pills = this.navElement.querySelectorAll('.pill');
    
    pills.forEach(pill => {
        // Hover effects
        pill.addEventListener('mouseenter', () => this.handleEnter(pill));
        pill.addEventListener('mouseleave', () => this.handleLeave(pill));
        
        // Click effect
        pill.addEventListener('click', (e) => {
            e.preventDefault();
            const id = pill.dataset.id;
            if (id !== this.activeId) {
                this.updateActiveState(id);
            }
        });
    });

    if (this.mobileMenuButton && this.mobileMenuPopover) {
        this.mobileMenuButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMobileMenu();
        });

        this.mobileMenuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.dataset.id;
                if (id && id !== this.activeId) {
                    this.updateActiveState(id);
                }
                this.closeMobileMenu();
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.navElement.contains(e.target)) {
                this.closeMobileMenu();
            }
        });

        window.addEventListener('resize', () => this.closeMobileMenu());
    }
  }

  toggleMobileMenu() {
    if (!this.mobileMenuPopover || !this.mobileMenuButton) return;
    const isOpen = this.mobileMenuPopover.classList.toggle('is-open');
    this.mobileMenuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  closeMobileMenu() {
    if (!this.mobileMenuPopover || !this.mobileMenuButton) return;
    this.mobileMenuPopover.classList.remove('is-open');
    this.mobileMenuButton.setAttribute('aria-expanded', 'false');
  }

  handleEnter(pill) {
    if (pill.classList.contains('is-active')) return;
    
    const circle = pill.querySelector('.hover-circle');
    const label = pill.querySelector('.pill-label');
    const labelHover = pill.querySelector('.pill-label-hover');
    const rect = pill.getBoundingClientRect();
    
    gsap.to(circle, { scale: 1.2, duration: 0.4, ease: 'power2.out' });
    gsap.to(label, { y: -rect.height, duration: 0.4, ease: 'power2.out' });
    
    gsap.set(labelHover, { y: rect.height, opacity: 0 });
    gsap.to(labelHover, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
  }

  handleLeave(pill) {
    if (pill.classList.contains('is-active')) return;

    const circle = pill.querySelector('.hover-circle');
    const label = pill.querySelector('.pill-label');
    const labelHover = pill.querySelector('.pill-label-hover');
    
    gsap.to(circle, { scale: 0, duration: 0.3, ease: 'power2.out' });
    gsap.to(label, { y: 0, duration: 0.3, ease: 'power2.out' });
    gsap.to(labelHover, { y: 20, opacity: 0, duration: 0.3, ease: 'power2.out' });
  }

  updateActiveState(newId, force = false) {
    const oldId = this.activeId;
    this.activeId = newId;
    
    const pills = this.navElement.querySelectorAll('.pill');
    pills.forEach(pill => {
        const isActive = pill.dataset.id === newId;
        if (isActive) {
            pill.classList.add('is-active');
            // Ensure visual state is "hovered" style permanently
            const circle = pill.querySelector('.hover-circle');
            const label = pill.querySelector('.pill-label');
            const labelHover = pill.querySelector('.pill-label-hover');
            
            gsap.to(circle, { scale: 1.2, duration: 0.4, ease: 'power2.out' });
            // For active state, we might want to keep the text white/visible
            // The React component keeps hover state on click? 
            // Let's reset text animations but keep the dot indicator (handled by CSS ::after)
            // Actually, pill-nav typically highlights the pill bg.
            // Let's revert hover animations for active state but keep the 'is-active' class which adds the dot.
            
            // Revert hover state visuals so it looks clean, let CSS handle active indicator
             gsap.to(circle, { scale: 0, duration: 0.3 });
             gsap.to(label, { y: 0, duration: 0.3 });
             gsap.to(labelHover, { y: 20, opacity: 0, duration: 0.3 });
        } else {
            pill.classList.remove('is-active');
             // Ensure reset
            const circle = pill.querySelector('.hover-circle');
            const label = pill.querySelector('.pill-label');
            const labelHover = pill.querySelector('.pill-label-hover');
            
            gsap.to(circle, { scale: 0, duration: 0.3 });
            gsap.to(label, { y: 0, duration: 0.3 });
            gsap.to(labelHover, { y: 20, opacity: 0, duration: 0.3 });
        }
    });

    if (oldId !== newId || force) {
        this.onTabChange(newId);
    }
  }
}
