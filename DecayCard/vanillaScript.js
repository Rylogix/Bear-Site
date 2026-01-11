// import gsap from 'https://cdn.skypack.dev/gsap'; // Removed

export class VanillaDecayCard {
    constructor(container, options = {}) {
        this.container = container;
        this.width = options.width || 600;
        this.height = options.height || 750;
        this.image = options.image || 'https://picsum.photos/300/400?grayscale';
        this.text = options.text || '';
        
        // State
        this.bounds = { width: window.innerWidth, height: window.innerHeight };
        this.cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.cachedCursor = { ...this.cursor };
        this.imgValues = {
            imgTransforms: { x: 0, y: 0, rz: 0 },
            displacementScale: 0
        };
        
        this.init();
        this.bindEvents();
        this.startLoop();
    }

    init() {
        // Create SVG structure
        const svgNS = "http://www.w3.org/2000/svg";
        
        // Dynamic viewBox based on width/height options with some padding for effect
        // 600x750 was default with viewBox -60 -75 720 900
        // Padding is roughly 10-20%
        const padX = this.width * 0.1;
        const padY = this.height * 0.1;
        const vbW = this.width + (padX * 2);
        const vbH = this.height + (padY * 2);
        
        this.svg = document.createElementNS(svgNS, "svg");
        this.svg.setAttribute("viewBox", `-${padX} -${padY} ${vbW} ${vbH}`);
        // Changed to meet so we see full image if container ratio mismatches slightly, 
        // but typically index.html now forces matching ratio.
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); 
        this.svg.classList.add("decay-card-svg");
        this.svg.style.width = "100%";
        this.svg.style.height = "100%";
        this.svg.style.display = "block";
        this.svg.style.willChange = "transform";
        
        // Define Filter
        const defs = document.createElementNS(svgNS, "defs");
        const filter = document.createElementNS(svgNS, "filter");
        this.filterId = "decayFilter-" + Math.random().toString(36).substr(2, 9);
        filter.setAttribute("id", this.filterId);
        
        const feTurbulence = document.createElementNS(svgNS, "feTurbulence");
        feTurbulence.setAttribute("type", "turbulence");
        feTurbulence.setAttribute("baseFrequency", "0.015");
        feTurbulence.setAttribute("numOctaves", "5");
        feTurbulence.setAttribute("seed", "4");
        feTurbulence.setAttribute("stitchTiles", "stitch");
        feTurbulence.setAttribute("result", "turbulence1");
        
        this.feDisplacementMap = document.createElementNS(svgNS, "feDisplacementMap");
        this.feDisplacementMap.setAttribute("in", "SourceGraphic");
        this.feDisplacementMap.setAttribute("in2", "turbulence1");
        this.feDisplacementMap.setAttribute("scale", "0");
        this.feDisplacementMap.setAttribute("xChannelSelector", "R");
        this.feDisplacementMap.setAttribute("yChannelSelector", "B");
        
        filter.appendChild(feTurbulence);
        filter.appendChild(this.feDisplacementMap);
        defs.appendChild(filter);
        this.svg.appendChild(defs);
        
        // Image Group
        this.imgGroup = document.createElementNS(svgNS, "g");
        const image = document.createElementNS(svgNS, "image");
        image.setAttribute("href", this.image);
        image.setAttribute("x", "0");
        image.setAttribute("y", "0");
        image.setAttribute("width", this.width);
        image.setAttribute("height", this.height);
        image.setAttribute("filter", `url(#${this.filterId})`);
        image.setAttribute("preserveAspectRatio", "xMidYMid slice"); // Keep slice inside the image element definition if we want it to fill the defined rect
        // But since we resized the rect to match image aspect ratio, slice/meet doesn't matter much unless there's rounding errors.
        
        this.imgGroup.appendChild(image);
        this.svg.appendChild(this.imgGroup);
        
        this.container.appendChild(this.svg);

        // Add Text Overlay
        if (this.text) {
            const textDiv = document.createElement('div');
            textDiv.className = 'card-text';
            textDiv.innerHTML = this.text;
            // Append to container, not SVG. Container is relative, text absolute.
            // Ensure container has relative position?
            // Yes, user provided styling has .content as relative, but we attach to 'container' which is 'decayContainer' in index.html.
            // decayContainer has no relative class.
            
            // Wait, in vanillaScript we use this.container as the root.
            // We append this.svg to this.container.
            // We append textDiv to this.container.
            // Styles for .card-text rely on parent being relative.
            this.container.style.position = 'relative';
            this.container.appendChild(textDiv);
        }
    }

    bindEvents() {
        this.handleResize = () => {
            this.bounds = { width: window.innerWidth, height: window.innerHeight };
        };
        
        this.handleMouseMove = (e) => {
            this.cursor = { x: e.clientX, y: e.clientY };
        };
        
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('mousemove', this.handleMouseMove);
    }

    startLoop() {
        const lerp = (a, b, n) => (1 - n) * a + n * b;
        const map = (x, a, b, c, d) => ((x - a) * (d - c)) / (b - a) + c;
        const distance = (x1, x2, y1, y2) => Math.hypot(x1 - x2, y1 - y2);

        const render = () => {
            if (!this.svg.isConnected) return; // Stop if removed

            // Calculate targets
            // Map cursor position to small movement range
            // NOTE: Original used window dimensions. Since this is a modal, using window is fine.
            let targetX = lerp(this.imgValues.imgTransforms.x, map(this.cursor.x, 0, this.bounds.width, -120, 120), 0.1);
            let targetY = lerp(this.imgValues.imgTransforms.y, map(this.cursor.y, 0, this.bounds.height, -120, 120), 0.1);
            let targetRz = lerp(this.imgValues.imgTransforms.rz, map(this.cursor.x, 0, this.bounds.width, -10, 10), 0.1);

            const bound = 50;
            // Soft limits
            if (targetX > bound) targetX = bound + (targetX - bound) * 0.2;
            if (targetX < -bound) targetX = -bound + (targetX + bound) * 0.2;
            if (targetY > bound) targetY = bound + (targetY - bound) * 0.2;
            if (targetY < -bound) targetY = -bound + (targetY + bound) * 0.2;

            this.imgValues.imgTransforms.x = targetX;
            this.imgValues.imgTransforms.y = targetY;
            this.imgValues.imgTransforms.rz = targetRz;

            // Apply transforms to the Image Group (not the whole SVG to keep it centered in container)
            // Or better, apply to the SVG if we want the whole card to move.
            // The original applied to `svgRef.current`.
            gsap.set(this.svg, {
                x: this.imgValues.imgTransforms.x,
                y: this.imgValues.imgTransforms.y,
                rotateZ: this.imgValues.imgTransforms.rz
            });

            // Calculate Displacement
            const cursorTravelledDistance = distance(
                this.cachedCursor.x, this.cursor.x,
                this.cachedCursor.y, this.cursor.y
            );
            
            this.imgValues.displacementScale = lerp(
                this.imgValues.displacementScale,
                map(cursorTravelledDistance, 0, 200, 0, 400),
                0.06
            );

            gsap.set(this.feDisplacementMap, { 
                attr: { scale: this.imgValues.displacementScale } 
            });

            this.cachedCursor = { ...this.cursor };
            this.rafId = requestAnimationFrame(render);
        };

        this.rafId = requestAnimationFrame(render);
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.container.innerHTML = '';
    }
}

