export class VanillaCurvedLoop {
    constructor(container, options = {}) {
        this.container = container;
        // Text format: "TEXT ✦"
        this.baseTexts = options.texts || ["TEXT ✦"]; 
        this.currentTextIndex = 0;
        this.scrambleChars = options.scrambleChars || '!<>-_\\/[]{}—=+*^?#________';
        this.intervalTime = options.intervalTime || 2500;
        this.speed = options.speed || 2;
        // Curve amount will now be read from CSS if not provided, or fallback to options/default
        this.curveAmount = options.curveAmount || 300;
        
        // State
        this.offset = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.textWidth = 0;
        this.unitWidth = 0; // Added unitWidth
        this.rafId = null;
        this.cycleInterval = null;
        
        this.initSVG();
        this.measureText();
        this.startLoop();
        this.addInteractions();
        
        // Start text changing cycle
        this.cycleInterval = setInterval(() => this.cycleText(), this.intervalTime);
    }
    
    initSVG() {
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("viewBox", "0 0 1440 400"); 
        this.svg.classList.add("curved-loop-svg");
        
        // Define Path
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const pathId = "curve-path-" + Math.random().toString(36).substr(2, 9);
        path.setAttribute("id", pathId);
        
        // Append first to read styles
        this.container.appendChild(this.svg);
        
        const svgStyle = getComputedStyle(this.svg);
        const spread = parseInt(svgStyle.getPropertyValue('--loop-spread').trim()) || 4000;
        
        // Allow overriding curveAmount from CSS
        const cssCurve = svgStyle.getPropertyValue('--loop-curve-height').trim();
        if (cssCurve) {
            this.curveAmount = parseInt(cssCurve);
        }
        
        // Center of 1440 is 720.
        // Start = 720 - spread/2
        // End = 720 + spread/2
        const startX = 720 - (spread / 2);
        const endX = 720 + (spread / 2);
        
        // Curve downwards/upwards
        path.setAttribute("d", `M${startX},300 Q720,${300 - this.curveAmount} ${endX},300`);
        defs.appendChild(path);
        this.svg.appendChild(defs);
        
        // Text Element
        this.textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        this.textEl.setAttribute("fill", "white");
        
        // Read font settings from CSS variables or fallback
        const fontSize = svgStyle.getPropertyValue('--loop-font-size').trim() || "200px";
        const letterSpacing = svgStyle.getPropertyValue('--loop-text-spacing').trim() || "2px";
        
        this.textEl.style.fontSize = fontSize;
        this.textEl.style.fontWeight = "bold";
        this.textEl.style.textTransform = "uppercase";
        this.textEl.style.letterSpacing = letterSpacing;
        
        this.textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
        this.textPath.setAttribute("href", "#" + pathId);
        this.textPath.setAttribute("startOffset", "0");
        this.textPath.style.dominantBaseline = "middle";
        
        this.textEl.appendChild(this.textPath);
        this.svg.appendChild(this.textEl);
    }
    
    measureText() {
        // Create a temporary text element to measure width of one unit
        const tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        // We need to measure the text PLUS the separator (5 spaces) to get exact unit width for looping
        tempText.textContent = this.baseTexts[0] + "     "; 
        
        const svgStyle = getComputedStyle(this.svg);
        const fontSize = svgStyle.getPropertyValue('--loop-font-size').trim() || "200px";
        const letterSpacing = svgStyle.getPropertyValue('--loop-text-spacing').trim() || "2px";

        tempText.style.fontSize = fontSize; 
        tempText.style.fontWeight = "bold";
        tempText.style.textTransform = "uppercase";
        tempText.style.letterSpacing = letterSpacing;
        tempText.style.visibility = "hidden";
        tempText.style.position = "absolute";
        
        this.svg.appendChild(tempText);
        const bbox = tempText.getBBox();
        this.unitWidth = bbox.width; 
        this.textWidth = bbox.width; 
        this.svg.removeChild(tempText);
        
        // Initial populate
        this.updatePathContent(this.baseTexts[0]);
    }
    
    updatePathContent(text) {
        // Repeat text to fill a generous amount of space
        const svgStyle = getComputedStyle(this.svg);
        const spread = parseInt(svgStyle.getPropertyValue('--loop-spread').trim()) || 4000;
        
        // Calculate number of repeats needed to cover roughly 3x the spread width
        const bufferMultiplier = 3;
        const repeats = Math.ceil((spread * bufferMultiplier) / this.unitWidth) + 2; 
        
        const fullString = Array(repeats).fill(text).join("     "); // 5 spaces gap
        this.textPath.textContent = fullString;
    }
    
    cycleText() {
        this.currentTextIndex = (this.currentTextIndex + 1) % this.baseTexts.length;
        const newText = this.baseTexts[this.currentTextIndex];
        
        // Scramble Effect
        let frame = 0;
        const maxFrames = 15; // 0.5s approx
        
        const scrambleInterval = setInterval(() => {
            if (frame >= maxFrames) {
                clearInterval(scrambleInterval);
                this.updatePathContent(newText);
            } else {
                // Create a scrambled version of the text
                const scrambled = newText.split('').map(c => {
                    if (c === ' ' || c === '✦') return c;
                    return this.scrambleChars[Math.floor(Math.random() * this.scrambleChars.length)];
                }).join('');
                this.updatePathContent(scrambled);
                frame++;
            }
        }, 33);
    }
    
    startLoop() {
        const loop = () => {
            if (!this.isDragging) {
                this.offset -= this.speed;
                
                // Reset logic using exact unit width
                if (this.offset < -this.unitWidth * 5) {
                    this.offset += this.unitWidth * 5;
                }
                
                this.textPath.setAttribute("startOffset", this.offset);
            }
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }
    
    addInteractions() {
        this.svg.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.svg.style.cursor = 'grabbing';
            e.preventDefault(); // Prevent text selection
        });
        
        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const delta = e.clientX - this.lastX;
                this.offset += delta;
                this.textPath.setAttribute("startOffset", this.offset);
                this.lastX = e.clientX;
            }
        });
        
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.svg.style.cursor = 'grab';
        });
        
        // Touch support
        this.svg.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.lastX = e.touches[0].clientX;
            e.preventDefault();
        });
        
        window.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                const delta = e.touches[0].clientX - this.lastX;
                this.offset += delta;
                this.textPath.setAttribute("startOffset", this.offset);
                this.lastX = e.touches[0].clientX;
            }
        });
        
        window.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }
}
