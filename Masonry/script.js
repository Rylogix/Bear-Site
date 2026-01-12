// import gsap from 'https://cdn.skypack.dev/gsap'; // Removed

export class Masonry {
    constructor(container, {
        items = [],
        columns = 3,
        gap = 20
    } = {}) {
        this.container = container;
        this.items = items;
        this.baseColumns = columns;
        this.gap = gap;
        
        this.init();
    }

    init() {
        this.layoutRaf = null;
        this.observer = 'IntersectionObserver' in window
            ? new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const img = entry.target;
                    const dataSrc = img.dataset.src;
                    if (dataSrc) {
                        img.src = dataSrc;
                        img.removeAttribute('data-src');
                    }
                    this.observer.unobserve(img);
                });
            }, { rootMargin: '200px 0px' })
            : null;
        this.render();
        window.addEventListener('resize', () => this.scheduleLayout());
    }

    getColumns() {
        const width = this.container.clientWidth || window.innerWidth;
        if (width >= 1920) return 6;
        if (width >= 1440) return 5;
        if (width >= 1024) return 4;
        if (width >= 768) return 3;
        if (width >= 480) return 2;
        return 1;
    }

    render() {
        this.container.classList.add('masonry-grid');
        this.container.innerHTML = '';
        const eagerCount = 6;
        
        this.items.forEach((item, index) => {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'masonry-item';
            
            const imgContainer = document.createElement('div');
            imgContainer.className = 'masonry-img-container';
            imgContainer.classList.add('is-loading');
            
            const img = document.createElement('img');
            img.decoding = 'async';
            img.loading = index < eagerCount ? 'eager' : 'lazy';
            img.fetchPriority = index < eagerCount ? 'high' : 'low';
            img.style.aspectRatio = '4 / 3';
            img.dataset.ratio = '0.75';
            if (index < eagerCount) {
                img.src = item.url;
            } else {
                img.dataset.src = item.url;
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                if (this.observer) {
                    this.observer.observe(img);
                } else {
                    img.src = item.url;
                    img.removeAttribute('data-src');
                }
            }
            img.alt = item.author || 'Fanart';
            
            // Metadata overlay (Author)
            const overlay = document.createElement('div');
            overlay.className = 'masonry-overlay';
            
            const author = document.createElement('span');
            author.className = 'masonry-author';
            author.textContent = item.author || 'Unknown';
            
            overlay.appendChild(author);
            imgContainer.appendChild(img);
            imgContainer.appendChild(overlay);
            itemWrapper.appendChild(imgContainer);
            
            this.container.appendChild(itemWrapper);
            
            // Store reference for layout
            item.element = itemWrapper;
            
            // Image load handler to trigger relayout
            const handleLoad = () => {
                if (img.dataset.src) {
                    return;
                }
                if (img.naturalWidth && img.naturalHeight) {
                    img.dataset.ratio = (img.naturalHeight / img.naturalWidth).toFixed(4);
                }
                imgContainer.classList.remove('is-loading');
                imgContainer.classList.add('is-loaded');
                this.scheduleLayout();
            };

            img.addEventListener('load', handleLoad);
            if (img.complete && !img.dataset.src) {
                handleLoad();
            }
        });

        // Initial layout attempt
        this.scheduleLayout();
    }

    scheduleLayout() {
        if (this.layoutRaf) return;
        this.layoutRaf = requestAnimationFrame(() => {
            this.layoutRaf = null;
            this.layout();
        });
    }

    layout() {
        const colCount = this.getColumns();
        const containerWidth = this.container.clientWidth;
        if (!containerWidth) {
            return;
        }
        const gap = Math.max(12, Math.min(this.gap, Math.round(containerWidth * 0.04)));
        const colWidth = (containerWidth - (colCount - 1) * gap) / colCount;
        if (!isFinite(colWidth) || colWidth <= 0) {
            return;
        }
        
        const colHeights = new Array(colCount).fill(0);
        
        this.items.forEach((item, i) => {
            if (!item.element) return;
            
            const img = item.element.querySelector('img');
            // If image isn't loaded, assume a default aspect or wait
            // For smoother layout, we might need aspect ratios in data. 
            // Without it, we rely on img.height after load.
            
            const ratio = img.naturalWidth && img.naturalHeight
                ? (img.naturalHeight / img.naturalWidth)
                : parseFloat(img.dataset.ratio || '0.75');
            const displayHeight = ratio * colWidth;
            const itemHeight = displayHeight; // + padding if any

            // Find shortest column
            const minColIndex = colHeights.indexOf(Math.min(...colHeights));
            
            const x = minColIndex * (colWidth + gap);
            const y = colHeights[minColIndex];
            
            item.element.style.width = `${colWidth}px`;
            item.element.style.height = `${itemHeight}px`;
            item.element.style.transform = `translate(${x}px, ${y}px)`;
            item.element.style.opacity = 1;
            
            colHeights[minColIndex] += itemHeight + gap;
        });
        
        this.container.style.height = `${Math.max(...colHeights)}px`;
    }
}
