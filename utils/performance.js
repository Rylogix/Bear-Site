
/**
 * Detects device performance tier based on WebGL renderer and hardware concurrency.
 * Returns: 'high', 'medium', 'low'
 */
export function getPerformanceTier() {
    let tier = 'high';
    let reasons = [];

    // 1. Check Hardware Concurrency
    const cores = navigator.hardwareConcurrency || 4;
    if (cores <= 2) {
        tier = 'low';
        reasons.push('low_cores');
    } else if (cores <= 4) {
        tier = 'medium';
    }

    // 2. Check WebGL Renderer for Software Rendering (Graphics Acceleration Off)
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).toLowerCase();
                
                reasons.push(`renderer:${renderer}`);

                // Detect Software Renderers
                if (renderer.includes('llvmpipe') || 
                    renderer.includes('software') || 
                    renderer.includes('swiftshader') ||
                    renderer.includes('microsoft basic render')) {
                    tier = 'low';
                    reasons.push('software_renderer');
                }
            }
        } else {
            tier = 'low';
            reasons.push('no_webgl');
        }
    } catch (e) {
        console.warn('WebGL detection failed', e);
        tier = 'low';
    }

    // 3. Mobile detection (rough)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && tier === 'high') {
        tier = 'medium'; // Downgrade mobile by default to be safe
    }

    console.log(`[Performance] Tier: ${tier}`, reasons);
    return tier;
}
