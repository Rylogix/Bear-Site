import gsap from 'https://cdn.skypack.dev/gsap';

export class ElasticSlider {
    constructor(container, {
        defaultValue = 50,
        minValue = 0,
        maxValue = 100,
        leftIcon = '🔉',
        rightIcon = '🔊',
        onCheckResponse = null, // Not really used but keeping signature flexible
        onChange = () => {}
    } = {}) {
        this.container = container;
        this.value = defaultValue;
        this.min = minValue;
        this.max = maxValue;
        this.leftIconSymbol = leftIcon;
        this.rightIconSymbol = rightIcon;
        this.onChange = onChange;
        
        this.isDragging = false;
        
        this.init();
    }

    init() {
        this.render();
        this.addEventListeners();
        this.updateVisuals(this.value, false); // Initial set without animation
    }

    render() {
        this.container.classList.add('slider-container');
        
        // Wrapper for hover effects
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'slider-wrapper';
        
        // Left Icon
        this.leftIcon = document.createElement('div');
        this.leftIcon.className = 'icon-wrapper left';
        this.leftIcon.innerHTML = `<span class="slider-icon">${this.leftIconSymbol}</span>`;
        
        // Slider Root (Hit area)
        this.sliderRoot = document.createElement('div');
        this.sliderRoot.className = 'slider-root';
        
        // Track Wrapper (Scalable)
        this.trackWrapper = document.createElement('div');
        this.trackWrapper.className = 'slider-track-wrapper';
        
        // Track
        this.track = document.createElement('div');
        this.track.className = 'slider-track';
        
        // Range (Filled part)
        this.range = document.createElement('div');
        this.range.className = 'slider-range';
        
        // Value Indicator
        this.valueIndicator = document.createElement('p');
        this.valueIndicator.className = 'value-indicator';
        this.valueIndicator.textContent = Math.round(this.value);
        
        // Assembly
        this.track.appendChild(this.range);
        this.trackWrapper.appendChild(this.track);
        this.sliderRoot.appendChild(this.trackWrapper);
        
        // Right Icon
        this.rightIcon = document.createElement('div');
        this.rightIcon.className = 'icon-wrapper right';
        this.rightIcon.innerHTML = `<span class="slider-icon">${this.rightIconSymbol}</span>`;
        
        this.wrapper.appendChild(this.leftIcon);
        this.wrapper.appendChild(this.sliderRoot);
        this.wrapper.appendChild(this.rightIcon);
        
        this.container.appendChild(this.wrapper);
        this.container.appendChild(this.valueIndicator);
    }

    addEventListeners() {
        // Hover animations
        this.wrapper.addEventListener('mouseenter', () => {
            gsap.to(this.wrapper, { scale: 1.2, duration: 0.3, ease: 'power2.out' });
            gsap.to(this.trackWrapper, { height: 12, marginTop: -3, marginBottom: -3, duration: 0.3 });
            gsap.to(this.valueIndicator, { opacity: 1, y: -20, duration: 0.3 }); // Show value on hover
        });

        this.wrapper.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                gsap.to(this.wrapper, { scale: 1, duration: 0.3, ease: 'power2.out' });
                gsap.to(this.trackWrapper, { height: 6, marginTop: 0, marginBottom: 0, duration: 0.3 });
                gsap.to(this.valueIndicator, { opacity: 0, y: 0, duration: 0.3 }); // Hide value
            }
        });

        // Drag Logic
        const startDrag = (e) => {
            this.isDragging = true;
            this.sliderRoot.classList.add('active');
            this.handleMove(e);
            
            // Global listeners for drag
            window.addEventListener('mousemove', this.handleMove);
            window.addEventListener('touchmove', this.handleMove);
            window.addEventListener('mouseup', endDrag);
            window.addEventListener('touchend', endDrag);
        };

        const endDrag = () => {
            this.isDragging = false;
            this.sliderRoot.classList.remove('active');
            
            // Revert hover state if not hovering
            if (!this.wrapper.matches(':hover')) {
                gsap.to(this.wrapper, { scale: 1, duration: 0.3 });
                gsap.to(this.trackWrapper, { height: 6, marginTop: 0, marginBottom: 0, duration: 0.3 });
                gsap.to(this.valueIndicator, { opacity: 0, y: 0, duration: 0.3 });
            }
            
            // Elastic snap back of overflow (simulated by scale reset)
            gsap.to(this.trackWrapper, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
            gsap.to(this.leftIcon, { x: 0, scale: 1, duration: 0.3 });
            gsap.to(this.rightIcon, { x: 0, scale: 1, duration: 0.3 });

            window.removeEventListener('mousemove', this.handleMove);
            window.removeEventListener('touchmove', this.handleMove);
            window.removeEventListener('mouseup', endDrag);
            window.removeEventListener('touchend', endDrag);
        };

        this.sliderRoot.addEventListener('mousedown', startDrag);
        this.sliderRoot.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(e); });
    }

    handleMove = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const rect = this.sliderRoot.getBoundingClientRect();
        const width = rect.width;
        
        let newValue = this.min + ((clientX - rect.left) / width) * (this.max - this.min);
        
        // Elastic/Overflow effect logic
        let overflow = 0;
        if (clientX < rect.left) {
            overflow = rect.left - clientX;
            newValue = this.min;
            // Bulge left
            this.animateOverflow('left', overflow);
        } else if (clientX > rect.right) {
            overflow = clientX - rect.right;
            newValue = this.max;
            // Bulge right
            this.animateOverflow('right', overflow);
        } else {
            // Inside bounds
            gsap.to(this.trackWrapper, { scaleX: 1, scaleY: 1, duration: 0.1 });
            gsap.to([this.leftIcon, this.rightIcon], { x: 0, scale: 1, duration: 0.2 });
        }

        // Clamp value for output
        const clampedValue = Math.min(Math.max(newValue, this.min), this.max);
        
        if (this.value !== clampedValue) {
            this.value = clampedValue;
            this.updateVisuals(this.value);
            this.onChange(this.value);
        }
    }

    animateOverflow(side, amount) {
        const MAX_OVERFLOW = 50;
        const damped = this.decay(amount, MAX_OVERFLOW);
        const scaleFactor = 1 + (damped / 200); // Mild stretch
        
        // Stretch track
        gsap.to(this.trackWrapper, { 
            scaleX: scaleFactor, 
            scaleY: 1 - (damped / 300), // Thin out slightly
            transformOrigin: side === 'left' ? 'right center' : 'left center',
            duration: 0.1 
        });

        // Push icons
        if (side === 'left') {
            gsap.to(this.leftIcon, { x: -damped, scale: 1 + (damped/100), duration: 0.1 });
        } else {
            gsap.to(this.rightIcon, { x: damped, scale: 1 + (damped/100), duration: 0.1 });
        }
    }

    decay(value, max) {
        if (max === 0) return 0;
        const entry = value / max;
        const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
        return sigmoid * max;
    }

    updateVisuals(value) {
        const percentage = ((value - this.min) / (this.max - this.min)) * 100;
        this.range.style.width = `${percentage}%`;
        this.valueIndicator.textContent = Math.round(value);
    }
}
