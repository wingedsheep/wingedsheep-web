import * as THREE from 'three';

/**
 * Renders the scene into a small render target (one texel = one "art pixel") and blows it up
 * with nearest-neighbour sampling. Outlines come from depth discontinuities, drawn on the
 * nearer pixel, like hand-drawn pixel art.
 *
 * The target is one texel larger on each side so the camera can move in whole texels while
 * the final image shifts by the sub-texel remainder: smooth panning without pixel crawl.
 */
export class PixelRenderer {
  readonly target: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh;
  private readonly post: THREE.ShaderMaterial;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  width = 1; // render target size in texels (without margin)
  height = 1;

  constructor(
    readonly renderer: THREE.WebGLRenderer,
    public pixelSize: number,
  ) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uOffset: { value: new THREE.Vector2() },
        uPixel: { value: pixelSize * renderer.getPixelRatio() },
        uNear: { value: 1 },
        uFar: { value: 400 },
        uOutline: { value: new THREE.Color(0x1d1a2c) },
        uOutlineStrength: { value: 0.55 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) }, // saturation, contrast, brightness
      },
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uOffset;
        uniform float uPixel;
        uniform float uNear;
        uniform float uFar;
        uniform vec3 uOutline;
        uniform float uOutlineStrength;
        uniform vec3 uGrade;

        float viewZ(ivec2 p) {
          // orthographic: depth is linear in [near, far]
          return uNear + texelFetch(tDepth, p, 0).r * (uFar - uNear);
        }

        void main() {
          // +1 for the margin, then shift by the camera's sub-texel remainder
          vec2 t = gl_FragCoord.xy / uPixel + vec2(1.0) + uOffset;
          ivec2 p = ivec2(floor(t));
          vec3 col = texelFetch(tColor, p, 0).rgb;

          float z = viewZ(p);
          float dz = 0.0;
          dz = max(dz, viewZ(p + ivec2(1, 0)) - z);
          dz = max(dz, viewZ(p + ivec2(-1, 0)) - z);
          dz = max(dz, viewZ(p + ivec2(0, 1)) - z);
          dz = max(dz, viewZ(p + ivec2(0, -1)) - z);
          // a neighbour much further away: we're on the silhouette of something in front
          float edge = smoothstep(0.35, 0.9, dz) * step(texelFetch(tDepth, p, 0).r, 0.9999);
          col = mix(col, col * uOutline * 2.2, edge * uOutlineStrength);

          // gentle grade: saturation, contrast, brightness
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, uGrade.x);
          col = (col - 0.5) * uGrade.y + 0.5;
          col *= uGrade.z;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);
  }

  get uniforms() {
    return this.post.uniforms;
  }

  /** Size in CSS pixels of the canvas. */
  setSize(cssWidth: number, cssHeight: number) {
    this.width = Math.ceil(cssWidth / this.pixelSize);
    this.height = Math.ceil(cssHeight / this.pixelSize);
    this.target.setSize(this.width + 2, this.height + 2);
    this.post.uniforms.uPixel.value = this.pixelSize * this.renderer.getPixelRatio();
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera, subTexel: THREE.Vector2) {
    this.post.uniforms.uNear.value = camera.near;
    this.post.uniforms.uFar.value = camera.far;
    this.post.uniforms.uOffset.value.copy(subTexel);
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
