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
        this.render();
        window.addEventListener('resize', () => this.layout());
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
        
        this.items.forEach(item => {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'masonry-item';
            
            const imgContainer = document.createElement('div');
            imgContainer.className = 'masonry-img-container';
            
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.author || 'Fanart';
            img.loading = 'lazy';
            
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
            img.onload = () => this.layout();
        });

        // Initial layout attempt
        this.layout();
    }

    layout() {
        const colCount = this.getColumns();
        const containerWidth = this.container.clientWidth;
        const gap = Math.max(12, Math.min(this.gap, Math.round(containerWidth * 0.04)));
        const colWidth = (containerWidth - (colCount - 1) * gap) / colCount;
        
        const colHeights = new Array(colCount).fill(0);
        
        this.items.forEach((item, i) => {
            if (!item.element) return;
            
            const img = item.element.querySelector('img');
            // If image isn't loaded, assume a default aspect or wait
            // For smoother layout, we might need aspect ratios in data. 
            // Without it, we rely on img.height after load.
            
            const displayHeight = img.height ? (img.height / img.width) * colWidth : 0;
            const itemHeight = displayHeight; // + padding if any

            // Find shortest column
            const minColIndex = colHeights.indexOf(Math.min(...colHeights));
            
            const x = minColIndex * (colWidth + gap);
            const y = colHeights[minColIndex];
            
            item.element.style.width = `${colWidth}px`;
            item.element.style.transform = `translate(${x}px, ${y}px)`;
            item.element.style.opacity = 1;
            
            colHeights[minColIndex] += itemHeight + gap;
        });
        
        this.container.style.height = `${Math.max(...colHeights)}px`;
    }
}
