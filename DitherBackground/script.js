import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

const waveVertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`;

const waveFragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
uniform float mouseStrength;

// Dither uniforms
uniform float colorNum;
uniform float pixelSize;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

// OCTAVES defined in material
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2)); 
}

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(gl_FragCoord.xy / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  int index = y * 8 + x;
  
  float mapValue = bayerMatrix8x8[index];
  float threshold = mapValue - 0.25;
  
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 aspectUV = uv;
  aspectUV.x *= resolution.x / resolution.y;
  
  float f = pattern(aspectUV);
  
  if (enableMouseInteraction == 1) {
    vec2 mPos = mousePos / resolution;
    vec2 mPosAspect = mPos;
    mPosAspect.x *= resolution.x / resolution.y;
    
    float dist = length(aspectUV - mPosAspect);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= mouseStrength * effect;
  }
  
  vec3 col = mix(vec3(0.0), waveColor, f);
  col = dither(uv, col);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class DitherBackground {
    constructor(container, {
        waveSpeed = 0.05,
        waveFrequency = 3,
        waveAmplitude = 0.3,
        waveColor = [0.5, 0.5, 0.5],
        colorNum = 4,
        pixelSize = 2,
        enableMouseInteraction = true,
        mouseRadius = 1,
        mouseStrength = 0.5,
        quality = 'high'
    } = {}) {
        this.container = container;
        this.params = {
            waveSpeed,
            waveFrequency,
            waveAmplitude,
            waveColor,
            colorNum,
            pixelSize,
            enableMouseInteraction,
            mouseRadius,
            mouseStrength,
            quality
        };

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;

        this.renderer = new THREE.WebGLRenderer({ antialias: this.params.quality === 'high', alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        
        let pixelRatio = window.devicePixelRatio;
        if (this.params.quality === 'medium') pixelRatio = Math.min(pixelRatio, 2);
        if (this.params.quality === 'low') pixelRatio = 1; // Force 1x on low
        
        this.renderer.setPixelRatio(pixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.mouse = new THREE.Vector2(0, 0);

        this.createPlane();
        this.addEventListeners();
        this.animate();
    }

    createPlane() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        const drawingSize = new THREE.Vector2();
        this.renderer.getDrawingBufferSize(drawingSize);

        let octaves = 4;
        if (this.params.quality === 'medium') octaves = 3;
        if (this.params.quality === 'low') octaves = 2;

        this.uniforms = {
            time: { value: 0 },
            resolution: { value: drawingSize },
            waveSpeed: { value: this.params.waveSpeed },
            waveFrequency: { value: this.params.waveFrequency },
            waveAmplitude: { value: this.params.waveAmplitude },
            waveColor: { value: new THREE.Vector3(...this.params.waveColor) },
            mousePos: { value: new THREE.Vector2(0, 0) },
            enableMouseInteraction: { value: this.params.enableMouseInteraction ? 1 : 0 },
            mouseRadius: { value: this.params.mouseRadius },
            mouseStrength: { value: this.params.mouseStrength },
            colorNum: { value: this.params.colorNum },
            pixelSize: { value: this.params.pixelSize }
        };

        this.material = new THREE.ShaderMaterial({
            vertexShader: waveVertexShader,
            fragmentShader: waveFragmentShader,
            uniforms: this.uniforms,
            defines: {
                OCTAVES: octaves
            }
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.renderer.setSize(width, height);
            
            const drawingSize = new THREE.Vector2();
            this.renderer.getDrawingBufferSize(drawingSize);
            this.uniforms.resolution.value.copy(drawingSize);
        });

        // Use window listener instead of container listener for better tracking
        // regardless of elements on top.
        window.addEventListener('mousemove', (e) => {
            // Mouse coordinates relative to viewport (clientX/Y are already viewport relative)
            // But we need to account for the container position if it's not full screen (it is fixed/full screen here)
            // and the GL coordinate system (0,0 at bottom-left).
            
            const x = e.clientX;
            const y = window.innerHeight - e.clientY; 
            
            const pixelRatio = this.renderer.getPixelRatio();
            this.mouse.set(x * pixelRatio, y * pixelRatio);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.uniforms.time.value = this.clock.getElapsedTime();
        if (this.params.enableMouseInteraction) {
            this.uniforms.mousePos.value.copy(this.mouse);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
