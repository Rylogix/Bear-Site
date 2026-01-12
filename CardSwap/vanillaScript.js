// Ported from React CardSwap to Vanilla JS
// Original dependency: gsap
// import gsap from '../static/gsap.min.js'; // Rely on global gsap

export class VanillaCardSwap {
    constructor(container, options = {}) {
        this.container = container;
        this.items = options.items || [];
        this.width = options.width || 300; // Default width
        this.height = options.height || 400; // Default height
        this.aspectRatio = options.aspectRatio || (this.width / this.height) || (16 / 9);
        this.responsive = options.responsive !== false;
        this.maxWidth = options.maxWidth || 960;
        this.maxHeight = options.maxHeight || 640;
        this.minWidth = options.minWidth || 240;
        this.minHeight = options.minHeight || 180;
        this.getSize = options.getSize || null;
        this.cardDistance = options.cardDistance || 40;
        this.verticalDistance = options.verticalDistance || 50;
        this.delay = options.delay || 4000;
        this.pauseOnHover = options.pauseOnHover !== false;
        this.skewAmount = options.skewAmount || 4;
        this.frontScale = options.frontScale || 1.1;
        this.scaleStep = options.scaleStep || 0.03;
        this.minScale = options.minScale || 0.2;
        this.globalScale = options.globalScale || 0.75;
        this.depthMultiplier = options.depthMultiplier || 0.6;
        this.quality = options.quality || 'high';
        this.easing = options.easing || (this.quality === 'low' ? 'power2.inOut' : 'elastic');

        // Drag State
        this.isDragging = false;
        this.wasDragging = false;
        this.startX = 0;
        this.currentX = 0;
        this.dragThreshold = 50; // Reduced threshold for better responsiveness
        
        // CUSTOMIZE SPEED HERE
        // Config based on easing - Adjusted for faster speed by default
        if (this.quality === 'low') {
             this.config = { ease: 'power2.inOut', durDrop: 0.4, durMove: 0.4, durReturn: 0.4, promoteOverlap: 0.2, returnDelay: 0.1 };
        } else {
             this.config = this.easing === 'elastic' 
                ? { ease: 'elastic.out(0.6,0.9)', durDrop: 0.6, durMove: 0.5, durReturn: 0.5, promoteOverlap: 0.8, returnDelay: 0.1 }
                : { ease: 'power1.inOut', durDrop: 0.6, durMove: 0.6, durReturn: 0.6, promoteOverlap: 0.45, returnDelay: 0.2 };
        }

        this.cards = [];
        this.order = [];
        this.interval = null;
        this.tl = null;
        this.isPaused = false;
        this.isAnimating = false;
        this.swapId = 0; // Track animation instances

        this.init();
    }

    init() {
        // Create cards from items
        this.container.classList.add('card-swap-container');
        this.applySize(this.responsive ? this.getResponsiveSize() : { width: this.width, height: this.height });
        // Ensure container catches touches if needed, but we bind to container mainly.
        this.container.style.touchAction = 'none'; 

        // Add instructions
        this.addInstructions();

        this.items.forEach((item, i) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.width = '100%';
            card.style.height = '100%';
            card.style.position = 'absolute';
            // Custom content for YouTube
            card.innerHTML = `
                <div class="card-content" style="width:100%; height:100%; position: relative; overflow: hidden; border-radius: 12px; cursor: pointer; background: #000;">
                    <img src="${item.image}" draggable="false" style="width:100%; height:100%; object-fit: cover; user-drag: none; -webkit-user-drag: none;" alt="${item.title}">
                    <div class="card-overlay" style="position: absolute; bottom: 0; left: 0; right: 0; padding: clamp(12px, 3vw, 20px); background: linear-gradient(transparent, rgba(0,0,0,0.9)); color: white;">
                        <div style="display: flex; justify-content: space-between; align-items: end; gap: 12px;">
                            <div>
                                <img src="static/YoutubeIcon.png" draggable="false" style="width: clamp(24px, 4vw, 32px); height: clamp(24px, 4vw, 32px); margin-bottom: 8px; display: block; user-drag: none; -webkit-user-drag: none;" alt="YouTube">
                                <h3 style="margin: 0; font-size: clamp(0.95rem, 1.6vw, 1.2rem); text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${item.title}</h3>
                            </div>
                            <span style="font-size: clamp(0.75rem, 1.2vw, 0.9rem); opacity: 0.9; text-shadow: 0 1px 2px rgba(0,0,0,0.8); white-space: nowrap; margin-left: 10px; margin-bottom: 2px;">${item.views}</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Prevent default drag on the card itself just in case
            card.ondragstart = () => false;

            card.addEventListener('click', (e) => {
                // If we were dragging significantly, don't open link
                if (this.wasDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.wasDragging = false;
                    return;
                }
                window.open(item.url, '_blank');
            });

            this.container.appendChild(card);
            this.cards.push(card);
            this.order.push(i);
        });

        // Initial placement
        this.cards.forEach((card, i) => {
            this.placeNow(card, this.makeSlot(i, this.cardDistance, this.verticalDistance, this.cards.length), this.skewAmount);
        });

        this.startLoop();
        
        if (this.pauseOnHover) {
            this.container.addEventListener('mouseenter', () => this.pause());
            this.container.addEventListener('mouseleave', () => this.resume());
        }

        this.bindDragEvents();

        if (this.responsive) {
            this.onResize = () => {
                this.applySize(this.getResponsiveSize());
            };
            window.addEventListener('resize', this.onResize);
        }
    }

    addInstructions() {
        const leftInst = document.createElement('div');
        leftInst.className = 'swap-instruction left';
        leftInst.innerHTML = `
            <div class="text">Drag Left to Previous</div>
            <div class="arrow">←</div>
        `;

        const rightInst = document.createElement('div');
        rightInst.className = 'swap-instruction right';
        rightInst.innerHTML = `
            <div class="text">Drag Right to Next</div>
            <div class="arrow">→</div>
        `;

        this.container.appendChild(leftInst);
        this.container.appendChild(rightInst);

        // Fade out after 3 seconds
        setTimeout(() => {
            leftInst.classList.add('fade-out');
            rightInst.classList.add('fade-out');
            // Remove from DOM after fade (1s transition)
            setTimeout(() => {
                leftInst.remove();
                rightInst.remove();
            }, 1000);
        }, 3000);
    }

    getResponsiveSize() {
        if (typeof this.getSize === 'function') {
            const size = this.getSize();
            if (size && size.width && size.height) return size;
        }

        const parentRect = this.container.parentElement
            ? this.container.parentElement.getBoundingClientRect()
            : null;
        const availableWidth = parentRect && parentRect.width > 0 ? parentRect.width : window.innerWidth;
        const availableHeight = parentRect && parentRect.height > 0 ? parentRect.height : window.innerHeight;

        const maxWidth = Math.min(availableWidth * 0.95, this.maxWidth);
        const maxHeight = Math.min(availableHeight * 0.7, this.maxHeight);
        const width = Math.max(Math.min(maxWidth, maxHeight * this.aspectRatio), this.minWidth);
        const height = Math.max(Math.round(width / this.aspectRatio), this.minHeight);

        return { width, height };
    }

    applySize(size) {
        if (!size || !size.width || !size.height) return;
        this.width = Math.round(size.width);
        this.height = Math.round(size.height);
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;

        if (this.responsive) {
            this.cardDistance = Math.max(14, Math.round(this.width * 0.045));
            this.verticalDistance = Math.max(10, Math.round(this.height * 0.025));
        }

        this.refreshPositions();
    }

    refreshPositions() {
        if (!this.cards.length) return;
        this.cards.forEach((card, i) => {
            this.placeNow(card, this.makeSlot(i, this.cardDistance, this.verticalDistance, this.cards.length), this.skewAmount);
        });
    }

    bindDragEvents() {
        // We bind to container but check if target is front card
        // Mouse
        this.container.addEventListener('mousedown', this.onDragStart.bind(this));
        window.addEventListener('mousemove', this.onDragMove.bind(this));
        window.addEventListener('mouseup', this.onDragEnd.bind(this));
        
        // Touch
        this.container.addEventListener('touchstart', this.onDragStart.bind(this), { passive: false });
        window.addEventListener('touchmove', this.onDragMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onDragEnd.bind(this));
    }

    onDragStart(e) {
        // Allow interruption even if animating
        // if (this.isAnimating) return; // Removed to allow grab during animation
        
        // Check if we clicked the front card
        const frontIndex = this.order[0];
        const frontCard = this.cards[frontIndex];
        
        // Allow clicking on children of card, but ensure target is inside front card
        if (!frontCard.contains(e.target) && e.target !== frontCard) return;

        // Prevent default to stop text selection/scrolling/image dragging
        // For mouse events we definitely want to prevent default.
        // For touch, we also want to prevent default to stop scrolling (handled by touch-action usually, but safety first).
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.wasDragging = false; // Reset flag
        this.startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        this.currentX = this.startX;
        this.pause(); // Pause auto-swap
        
        // Disable transition during drag
        gsap.killTweensOf(frontCard);
        
        // Visual feedback
        frontCard.style.cursor = 'grabbing';
    }

    onDragMove(e) {
        if (!this.isDragging) return;
        if (e.cancelable) e.preventDefault(); // Stop scroll
        e.stopPropagation();
        
        // For mouse, ensure button is still pressed
        if (e.type === 'mousemove' && e.buttons === 0) {
            this.onDragEnd(e);
            return;
        }
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const deltaX = clientX - this.startX;
        this.currentX = clientX;
        
        const frontIndex = this.order[0];
        const frontCard = this.cards[frontIndex];
        
        // Move card
        // Rotate slightly based on movement
        const rotate = deltaX * 0.05;
        
        gsap.set(frontCard, {
            x: deltaX,
            rotation: rotate,
            cursor: 'grabbing'
        });
    }

    onDragEnd(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const frontIndex = this.order[0];
        const frontCard = this.cards[frontIndex];
        const deltaX = this.currentX - this.startX;
        
        frontCard.style.cursor = 'grab';

        // Set flag for click handler
        if (Math.abs(deltaX) > 5) {
             this.wasDragging = true;
        }

        if (Math.abs(deltaX) > this.dragThreshold) {
            // Trigger Swap
            if (deltaX > 0) {
                // Drag Right -> Throw Front to Back (Next)
                this.swap(true); 
            } else {
                // Drag Left -> Bring Back to Front (Previous/Undo)
                this.swapBack();
            }
        } else {
            // Snap back
            gsap.to(frontCard, {
                x: 0,
                y: 0,
                rotation: 0,
                duration: 0.5,
                ease: 'elastic.out(1, 0.5)'
            });
            this.resume();
        }
    }

    makeSlot(i, distX, distY, total) {
        const baseScale = Math.max(this.minScale, this.frontScale - i * this.scaleStep);
        const scale = baseScale * this.globalScale;

        return {
            x: i * distX,
            y: -i * distY,
            z: -i * distX * this.depthMultiplier,
            scale,
            zIndex: total - i
        };
    }

    placeNow(el, slot, skew) {
        gsap.set(el, {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            scale: slot.scale,
            skewY: this.quality === 'low' ? 0 : skew, // Disable skew on low quality
            zIndex: slot.zIndex,
            xPercent: -50,
            yPercent: -50,
            transformOrigin: 'center center',
            force3D: true
        });
    }

    swap(force = false) {
        if (this.order.length < 2) return;

        // If manually forced (dragged), we interrupt any current animation.
        // Or if auto-swap, we respect isAnimating lock.
        if (!force && (this.isAnimating || (this.isPaused && !this.isDragging && !this.tl?.isActive()))) {
             return;
        }

        // Interrupt existing animation if forced
        if (force && this.isAnimating) {
            // Do not kill the active timeline to avoid snapping.
            // We rely on GSAP overwriting behavior for targets that are shared.
            // We update the order immediately so new interactions target the correct card.
            this.isAnimating = false;
        }
        
        this.isAnimating = true;
        this.swapId = (this.swapId || 0) + 1;
        const currentSwapId = this.swapId;

        const [frontIndex, ...restIndices] = this.order;
        
        // UPDATE ORDER IMMEDIATELY so subsequent interactions target the correct next card
        this.order = [...restIndices, frontIndex];

        const frontCard = this.cards[frontIndex];
        
        const tl = gsap.timeline({
            onComplete: () => {
                // Only unlock if this is the latest swap
                if (this.swapId === currentSwapId) {
                    this.isAnimating = false;
                    if (!this.isDragging) this.resume(); 
                }
            }
        });
        this.tl = tl;

        // Animate off screen
        const currentX = gsap.getProperty(frontCard, "x");
        
        let throwX = 0;
        let effectiveDur = this.config.durDrop; // Default drop duration

        if (Math.abs(currentX) > 50) { // If dragged significantly
            throwX = currentX > 0 ? 500 : -500;
            effectiveDur = 0.4; // Faster throw
        }

        if (throwX !== 0) {
             tl.to(frontCard, {
                x: throwX * 1.5,
                opacity: 0,
                duration: effectiveDur,
                ease: 'power1.out'
            });
        } else {
             tl.to(frontCard, {
                y: '+=500', // Drop down
                duration: effectiveDur,
                ease: this.config.ease
            });
        }

        // Determine labels
        // 'promote' determines when other cards start moving forward.
        // We want this relatively early to fill the gap.
        const promoteTime = effectiveDur * 0.2; // Start filling gap after 20% of throw
        tl.addLabel('promote', promoteTime);

        // 'return' determines when the thrown card starts coming back.
        // We want this near the end of the throw to avoid cutting it short.
        const returnTime = effectiveDur * 0.9; // Start returning at 90% of throw
        tl.addLabel('return', returnTime);

        // Move others forward
        restIndices.forEach((idx, i) => {
            const card = this.cards[idx];
            const slot = this.makeSlot(i, this.cardDistance, this.verticalDistance, this.cards.length);
            
            // Ensure we animate from current state to new state
            tl.set(card, { zIndex: slot.zIndex }, 'promote');
            tl.to(card, {
                x: slot.x,
                y: slot.y,
                z: slot.z,
                scale: slot.scale,
                rotation: 0, // Reset rotation if any
                opacity: 1,
                duration: this.config.durMove,
                ease: this.config.ease
            }, `promote+=${i * 0.1}`); // Stagger slightly
        });

        // Return front card to back
        const backSlot = this.makeSlot(this.cards.length - 1, this.cardDistance, this.verticalDistance, this.cards.length);
        
        tl.call(() => {
            // Set zIndex to back, but keep position/opacity from throw
            gsap.set(frontCard, { zIndex: backSlot.zIndex });
        }, null, 'return');

        // Animate from thrown position (or drop position) to back slot
        // It will slide in from where it was thrown (Right or Down)
        tl.to(frontCard, {
            x: backSlot.x,
            y: backSlot.y,
            z: backSlot.z,
            scale: backSlot.scale,
            rotation: 0,
            opacity: 1, // Fade back in
            duration: this.config.durReturn,
            ease: 'power2.out'
        }, 'return');
    }

    swapBack() {
        if (this.order.length < 2) return;
        
        // Interrupt if animating
        if (this.isAnimating) {
             // Do NOT kill active timeline if possible
             this.isAnimating = false;
        }

        this.isAnimating = true;
        this.swapId = (this.swapId || 0) + 1;
        const currentSwapId = this.swapId;

        // Take LAST card and bring to FRONT
        const lastIndex = this.order[this.order.length - 1];
        const lastCard = this.cards[lastIndex];
        const restIndices = this.order.slice(0, -1); // 0 to length-2

        // UPDATE ORDER IMMEDIATELY
        this.order = [lastIndex, ...restIndices];

        // Slot 0 (Target for last card)
        const frontSlot = this.makeSlot(0, this.cardDistance, this.verticalDistance, this.cards.length);
        
        const tl = gsap.timeline({
            onComplete: () => {
                if (this.swapId === currentSwapId) {
                    this.isAnimating = false;
                    if (!this.isDragging) this.resume();
                }
            }
        });
        this.tl = tl;

        // 1. Move others BACK to make room
        restIndices.forEach((idx, i) => {
            const card = this.cards[idx];
            // New slot is i + 1
            const slot = this.makeSlot(i + 1, this.cardDistance, this.verticalDistance, this.cards.length);
            
            tl.to(card, {
                x: slot.x,
                y: slot.y,
                z: slot.z,
                zIndex: slot.zIndex, 
                scale: slot.scale,
                rotation: 0, // Reset rotation
                duration: this.config.durMove,
                ease: this.config.ease
            }, 0);
        });

        // 2. Animate Last Card to Front
        // User wants Left Throw -> Previous.
        // Left Throw implies dragging Left.
        // So the new card should enter from the Left to fill the space.
        
        tl.set(lastCard, { zIndex: this.cards.length + 1 }, 0);
        
        // Start from Left (-500)
        tl.fromTo(lastCard, 
            { x: -500, y: 0, rotation: -10, opacity: 0 },
            { 
                x: frontSlot.x, 
                y: frontSlot.y, 
                z: frontSlot.z, 
                scale: frontSlot.scale,
                rotation: 0,
                opacity: 1,
                duration: this.config.durReturn,
                ease: 'power2.out'
            }, 0
        );
        
        // Update Order - Already done
        tl.call(() => {
            // Force Z-indices update for safety
            this.order.forEach((idx, i) => {
                const s = this.makeSlot(i, this.cardDistance, this.verticalDistance, this.cards.length);
                this.cards[idx].style.zIndex = s.zIndex;
            });
        });
    }

    startLoop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.swap(), this.delay);
    }

    pause() {
        this.isPaused = true;
        if (this.tl) this.tl.pause();
        clearInterval(this.interval);
    }

    resume() {
        this.isPaused = false;
        if (this.tl) this.tl.play();
        this.startLoop();
    }
}
