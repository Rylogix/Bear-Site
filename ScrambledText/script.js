export class VanillaScrambledText {
    constructor(element, options = {}) {
        this.element = element;
        this.chars = options.chars || '!<>-_\\/[]{}—=+*^?#________';
        this.originalText = element.textContent.trim();
        this.radius = options.radius || 100;
        this.element.innerHTML = '';
        this.spans = [];
        this.isHovering = false;
        
        this.init();
    }
    
    init() {
        const text = this.originalText;
        // Keep original styles but ensure position relative
        const computed = window.getComputedStyle(this.element);
        if (computed.position === 'static') {
            this.element.style.position = 'relative';
        }
        
        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.textContent = text[i];
            span.dataset.char = text[i];
            span.dataset.original = text[i];
            span.style.display = 'inline-block';
            span.style.position = 'relative';
            span.style.transition = 'color 0.2s';
            
            // Preserve spaces
            if (text[i] === ' ') {
                span.style.width = '0.3em';
            }
            
            this.element.appendChild(span);
            this.spans.push({
                el: span,
                char: text[i],
                scrambling: false,
                interval: null
            });
        }
        
        document.addEventListener('mousemove', this.handleMove.bind(this));
        
        // Cleanup support
        this.cleanup = () => {
            document.removeEventListener('mousemove', this.handleMove.bind(this));
        };
    }
    
    handleMove(e) {
        if (!document.body.contains(this.element)) return;

        this.spans.forEach(spanData => {
            const rect = spanData.el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
            
            if (dist < this.radius) {
                if (!spanData.scrambling) {
                    this.scramble(spanData);
                }
            }
        });
    }
    
    scramble(spanData) {
        // Don't scramble spaces usually, but can look cool. Let's skip spaces for readability if desired.
        // if (spanData.char === ' ') return; 

        spanData.scrambling = true;
        let counter = 0;
        const max = 15; 
        
        if (spanData.interval) clearInterval(spanData.interval);
        
        spanData.el.style.color = '#888'; // Dim color while scrambling
        
        spanData.interval = setInterval(() => {
            if (counter >= max) {
                clearInterval(spanData.interval);
                spanData.el.textContent = spanData.char;
                spanData.el.style.color = ''; // Reset color
                spanData.scrambling = false;
            } else {
                spanData.el.textContent = this.chars[Math.floor(Math.random() * this.chars.length)];
                counter++;
            }
        }, 30);
    }
}
