import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

export class VanillaLanyard {
    constructor(container, options = {}) {
        this.container = container;
        this.imageUrl = options.image;
        this.aspectRatio = options.aspectRatio || 1; // Width / Height
        this.width = options.width || 600; // Display width reference
        this.quality = options.quality || 'high';
        
        this.init();
        this.createPhysics();
        this.createObjects();
        this.bindEvents();
        this.startLoop();
    }

    init() {
        this.scene = new THREE.Scene();
        // this.scene.background = new THREE.Color(0x000000); // Transparent in final
        
        // Camera
        const fov = 35; // Wider FOV for close up
        this.camera = new THREE.PerspectiveCamera(fov, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
        this.camera.position.set(0, 0, 15);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        
        let pixelRatio = window.devicePixelRatio;
        if (this.quality === 'medium') pixelRatio = Math.min(pixelRatio, 2);
        if (this.quality === 'low') pixelRatio = 1;
        this.renderer.setPixelRatio(pixelRatio);
        
        if (this.quality !== 'low') {
            this.renderer.shadowMap.enabled = true;
        }
        this.container.appendChild(this.renderer.domElement);
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        if (this.quality !== 'low') {
            dirLight.castShadow = true;
        }
        this.scene.add(dirLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(-5, 5, 5);
        this.scene.add(pointLight);
    }

    createPhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -20, 0); // Gravity down
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        
        // Physics materials
        this.defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial, 
            this.defaultMaterial, 
            { friction: 0.1, restitution: 0.0 }
        );
        this.world.addContactMaterial(defaultContactMaterial);
    }

    createObjects() {
        // --- Parameters ---
        // Scale physics world to be reasonable. 
        // Increased size for visibility
        const baseSize = 6;
        let cardPhysWidth, cardPhysHeight;
        
        if (this.aspectRatio >= 1) {
            // Horizontal or Square: Width is base
            cardPhysWidth = baseSize;
            cardPhysHeight = baseSize / this.aspectRatio;
        } else {
            // Vertical: Height is base
            cardPhysHeight = baseSize;
            cardPhysWidth = baseSize * this.aspectRatio;
        }

        const cardPhysDepth = 0.1; // Reduced from 2.2 to be more card-like
        
        // 1. The Anchor (Fixed point at top)
        // Positioned high up relative to camera
        const anchorBody = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(0, 15, 2)
        });
        anchorBody.addShape(new CANNON.Sphere(0.1));
        this.world.addBody(anchorBody);
        
        // 2. The Chain (Lanyard Strap)
        const segments = 10;
        const chainLength = 12;
        const segmentLength = chainLength / segments;
        const segmentRadius = 0.15;
        
        let previousBody = anchorBody;
        this.chainBodies = [];
        this.chainMeshes = [];
        
        // Material for strap
        const strapMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const strapGeo = new THREE.CylinderGeometry(segmentRadius, segmentRadius, segmentLength, 8);
        
        for (let i = 0; i < segments; i++) {
            const body = new CANNON.Body({
                mass: 0.5,
                position: new CANNON.Vec3(0, 15 - (i + 1) * segmentLength, 0),
                linearDamping: 0.4,
                angularDamping: 0.4
            });
            // Cylinder shape oriented along Y
            // Cannon cylinders are along Z by default? No, usually Y. 
            // Wait, Cannon Cylinder is Z-aligned? Let's use Particle or Sphere for simplicity of chain if visuals are handled by curve, 
            // but let's stick to rigid bodies connected by constraints for now.
            // Using a Sphere for collision is easier to stabilize.
            const shape = new CANNON.Sphere(segmentRadius * 2);
            body.addShape(shape);
            this.world.addBody(body);
            
            // Constraint
            const constraint = new CANNON.PointToPointConstraint(
                previousBody, 
                new CANNON.Vec3(0, i === 0 ? 0 : -segmentLength/2, 0), // Offset on prev (if it was a long body) - actually sphere
                body,
                new CANNON.Vec3(0, segmentLength/2, 0) // Offset on current
            );
            // Better constraint: DistanceConstraint?
            // PointToPoint is fine for chain.
            // Adjust pivot points. 
            // Previous body (Anchor) -> Pivot at (0,0,0) relative to center.
            // For Spheres, just pivot at center + distance.
            
            // Let's redo constraints simply:
            // Connect center to center with distance constraint? Or PointToPoint at edge.
            const c = new CANNON.PointToPointConstraint(
                previousBody,
                new CANNON.Vec3(0, i===0 ? 0 : -segmentLength, 0), // Anchor is point, others are spheres
                body,
                new CANNON.Vec3(0, 0, 0)
            );
            
            // Actually, best chain is Body --(dist)-- Body.
            // But let's use PointToPoint for flexible "rope".
            // Anchor (0,0,0) -> Body1 (0, dist, 0) relative? No.
            
            // Simplified:
            // Anchor is at (0,8,0).
            // Body 1 at (0, 7.5, 0).
            // Constraint between Anchor(0,0,0) and Body1(0, 0.5, 0)?
            
            // Let's use DistanceConstraint for "rope" behavior (slack possible? No, DistanceConstraint is stiff).
            // PointToPoint is like a ball socket.
            // Let's stick to PointToPoint.
            
            // Re-define connection points properly.
            // Previous Body (if sphere/point): connect at bottom.
            // Current Body (sphere): connect at top.
            
            let pivotA = new CANNON.Vec3(0, -segmentLength/2, 0); 
            if (i === 0) pivotA = new CANNON.Vec3(0, 0, 0); // Anchor
            
            let pivotB = new CANNON.Vec3(0, segmentLength/2, 0);
            
            const p2p = new CANNON.PointToPointConstraint(previousBody, pivotA, body, pivotB);
            this.world.addConstraint(p2p);
            
            previousBody = body;
            this.chainBodies.push(body);
            
            // Visuals (We will render a curve later, but for now debug cylinders)
            // const mesh = new THREE.Mesh(strapGeo, strapMat);
            // this.scene.add(mesh);
            // this.chainMeshes.push(mesh);
        }
        
        // 3. The Card
        // Texture
        const textureLoader = new THREE.TextureLoader();
        const cardTexture = textureLoader.load(this.imageUrl);
        cardTexture.encoding = THREE.sRGBEncoding;
        
        // Geometry
        const cardGeo = new THREE.BoxGeometry(cardPhysWidth, cardPhysHeight, cardPhysDepth);
        
        // Helper to get average color from image edges
        const getAverageColor = (imgUrl, callback) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imgUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Downscale to reasonable size for performance while keeping aspect ratio
                const maxSize = 100;
                let w = img.width;
                let h = img.height;
                
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * (maxSize / w));
                        w = maxSize;
                    } else {
                        w = Math.round(w * (maxSize / h));
                        h = maxSize;
                    }
                }

                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                
                const imageData = ctx.getImageData(0, 0, w, h).data;
                let r = 0, g = 0, b = 0;
                let count = 0;
                
                // Sample Top and Bottom edges
                for (let x = 0; x < w; x++) {
                    // Top
                    let idx = (0 * w + x) * 4;
                    r += imageData[idx];
                    g += imageData[idx + 1];
                    b += imageData[idx + 2];
                    count++;
                    
                    // Bottom
                    idx = ((h - 1) * w + x) * 4;
                    r += imageData[idx];
                    g += imageData[idx + 1];
                    b += imageData[idx + 2];
                    count++;
                }
                
                // Sample Left and Right edges (excluding corners already counted)
                for (let y = 1; y < h - 1; y++) {
                    // Left
                    let idx = (y * w + 0) * 4;
                    r += imageData[idx];
                    g += imageData[idx + 1];
                    b += imageData[idx + 2];
                    count++;
                    
                    // Right
                    idx = (y * w + (w - 1)) * 4;
                    r += imageData[idx];
                    g += imageData[idx + 1];
                    b += imageData[idx + 2];
                    count++;
                }

                if (count > 0) {
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);
                }

                const color = new THREE.Color(`rgb(${r}, ${g}, ${b})`);
                callback(color);
            };
            img.onerror = () => {
                callback(new THREE.Color(0x111111)); // Default fallback
            }
        };

        // Material
        // Front face with image, others dark
        // Start with default, update later
        const matSide = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const matFace = new THREE.MeshStandardMaterial({ 
            map: cardTexture,
            roughness: 0.4,
            metalness: 0.1
        });
        
        // BoxGeometry face order: +x, -x, +y, -y, +z, -z
        // We want +z to be the image.
        const materials = [
            matSide, matSide, matSide, matSide, matFace, matSide
        ];
        
        this.cardMesh = new THREE.Mesh(cardGeo, materials);
        this.scene.add(this.cardMesh);

        // Calculate avg color
        getAverageColor(this.imageUrl, (color) => {
             // Create new material with this color
             const coloredMat = new THREE.MeshStandardMaterial({ 
                 color: color, 
                 roughness: 0.5 
             });
             // Update all sides except face (index 4)
             const newMats = [
                coloredMat, coloredMat, coloredMat, coloredMat, matFace, coloredMat
             ];
             this.cardMesh.material = newMats;
        });
        
        // Physics Body
        // Start higher up (e.g., above the chain end) to let it drop
        const startHeight = 15 - chainLength + 5; 
        this.cardBody = new CANNON.Body({
            mass: 2,
            position: new CANNON.Vec3(0, startHeight, 0),
            linearDamping: 0.5,
            angularDamping: 0.5
        });
        const cardShape = new CANNON.Box(new CANNON.Vec3(cardPhysWidth/2, cardPhysHeight/2, cardPhysDepth/2));
        this.cardBody.addShape(cardShape);
        this.world.addBody(this.cardBody);
        
        // Connect Card to last chain link
        const lastLink = this.chainBodies[this.chainBodies.length - 1];
        // Connect to center top of card mesh. 
        // cardBody is at center of mass.
        // Height is cardPhysHeight.
        // We need to attach to (0, cardPhysHeight/2, 0) relative to body center.
        
        const cardConstraint = new CANNON.PointToPointConstraint(
            lastLink,
            new CANNON.Vec3(0, -segmentLength/2, 0),
            this.cardBody,
            new CANNON.Vec3(0, cardPhysHeight/2, 0) // Top of card
        );
        this.world.addConstraint(cardConstraint);
        
        // 4. Lanyard Curve Visual
        // We'll use a CatmullRomCurve3 to draw a tube/line through the chain points
        this.curve = new THREE.CatmullRomCurve3(
            this.chainBodies.map(b => new THREE.Vector3(b.position.x, b.position.y, b.position.z))
        );
        this.curve.curveType = 'chordal';
        
        if (this.quality === 'low') {
             // Use Line for low quality
             const lineGeo = new THREE.BufferGeometry().setFromPoints(this.curve.getPoints(10));
             const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
             this.strapMesh = new THREE.Line(lineGeo, lineMat);
        } else {
             // Use Tube for medium/high
             const segments = this.quality === 'medium' ? 16 : 32;
             const radial = this.quality === 'medium' ? 3 : 4;
             const tubeGeo = new THREE.TubeGeometry(this.curve, segments, 0.05, radial, false);
             this.strapMesh = new THREE.Mesh(tubeGeo, strapMat);
        }
        this.scene.add(this.strapMesh);
    }

    bindEvents() {
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.isDragging = false;
        
        // Drag Plane (invisible plane at card Z depth to catch mouse)
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        
        this.onMouseMove = (e) => {
            // Normalize mouse coordinates for Raycaster
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            if (this.isDragging) {
                this.handleDrag();
            } else {
                // Hover effect?
                this.checkHover();
            }
        };
        
        this.onMouseDown = (e) => {
            if (this.hovered) {
                this.isDragging = true;
                this.container.style.cursor = 'grabbing';
                // Create a mouse constraint or just push the body
                // We'll use a kinematic body to pull the card
                this.initDrag();
            }
        };
        
        this.onMouseUp = (e) => {
            this.isDragging = false;
            this.container.style.cursor = 'grab';
            this.endDrag();
        };
        
        this.onResize = () => {
            if (!this.container) return;
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        };
        
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('resize', this.onResize);
    }
    
    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.cardMesh);
        if (intersects.length > 0) {
            this.hovered = true;
            this.container.style.cursor = 'grab';
        } else {
            this.hovered = false;
            this.container.style.cursor = 'default';
        }
    }
    
    initDrag() {
        // Create a "mouse body" that follows the mouse
        this.mouseBody = new CANNON.Body({
            mass: 0, // Kinematic/Static
            position: new CANNON.Vec3(this.cardBody.position.x, this.cardBody.position.y, this.cardBody.position.z),
            type: CANNON.Body.KINEMATIC
        });
        this.world.addBody(this.mouseBody);
        
        // Connect mouse body to card body
        this.mouseConstraint = new CANNON.PointToPointConstraint(
            this.mouseBody,
            new CANNON.Vec3(0,0,0),
            this.cardBody,
            new CANNON.Vec3(0,0,0) // Connect to center of card
        );
        this.world.addConstraint(this.mouseConstraint);
    }
    
    handleDrag() {
        if (!this.mouseBody) return;
        
        // Raycast to find point on a virtual plane at the card's depth
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, target);
        
        if (target) {
            // Move mouse body to target
            this.mouseBody.position.set(target.x, target.y, target.z);
        }
    }
    
    endDrag() {
        if (this.mouseConstraint) {
            this.world.removeConstraint(this.mouseConstraint);
            this.mouseConstraint = null;
        }
        if (this.mouseBody) {
            this.world.removeBody(this.mouseBody);
            this.mouseBody = null;
        }
    }

    startLoop() {
        const timeStep = 1 / 60;
        let lastCallTime = performance.now();
        
        this.animate = () => {
            const now = performance.now();
            // const dt = (now - lastCallTime) / 1000;
            lastCallTime = now;
            
            // Step Physics
            this.world.step(timeStep);
            
            // Sync Visuals
            this.cardMesh.position.copy(this.cardBody.position);
            this.cardMesh.quaternion.copy(this.cardBody.quaternion);
            
            // Update Curve/Strap
            // Get connection point on card in world space
            // Connect to top of card (0, height/2, 0)
            const cardHeight = this.cardMesh.geometry.parameters.height;
            const cardTop = new THREE.Vector3(0, cardHeight / 2, 0);
            cardTop.applyQuaternion(this.cardMesh.quaternion);
            cardTop.add(this.cardMesh.position);

            // Update curve points from chain bodies + card connection
            const points = [
                new THREE.Vector3(0, 15, 0), // Anchor matches anchorBody position
                ...this.chainBodies.map(b => new THREE.Vector3(b.position.x, b.position.y, b.position.z)),
                cardTop
            ];
            
            // Update the curve geometry
            const newCurve = new THREE.CatmullRomCurve3(points);
            newCurve.curveType = 'chordal';
            
            if (this.quality === 'low') {
                // Update Line
                this.strapMesh.geometry.setFromPoints(newCurve.getPoints(10));
            } else {
                // Update Tube
                const segments = this.quality === 'medium' ? 16 : 32;
                const radial = this.quality === 'medium' ? 3 : 4;
                
                this.strapMesh.geometry.dispose();
                this.strapMesh.geometry = new THREE.TubeGeometry(newCurve, segments, 0.05, radial, false);
            }
            
            this.renderer.render(this.scene, this.camera);
            this.rafId = requestAnimationFrame(this.animate);
        };
        
        this.animate();
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('resize', this.onResize);
        
        // Cleanup Three.js
        this.container.innerHTML = '';
    }
}

