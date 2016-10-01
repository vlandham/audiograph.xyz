const createLoop = require('raf-loop');
const createApp = require('./lib/app');
const newArray = require('new-array');
const createScene = require('./lib/createScene');
const getPalette = require('./lib/palette');
const rightNow = require('right-now');
const log = require('./lib/log');

const isMobile = require('./lib/isMobile');
// const showIntro = require('./lib/intro');
const EffectComposer = require('./lib/EffectComposer');
const BloomPass = require('./lib/BloomPass');
const SSAOShader = require('./lib/shader/SSAOShader');
const createAudio = require('./lib/audio');

const white = new THREE.Color('white');
const opt = { antialias: false, alpha: false, stencil: false };
const { updateProjectionMatrix, camera, scene, renderer, canvas } = createApp(opt);

let supportsDepth = true;
if (!renderer.extensions.get('WEBGL_depth_texture')) {
  if (window.ga) window.ga('send', 'event', 'error', 'WEBGL_depth_texture', 0)
  console.warn('Requires WEBGL_depth_texture for certain post-processing effects.');
  supportsDepth = false;
}

renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.gammaFactor = 2.2;

const rt1 = createRenderTarget();
const rt2 = createRenderTarget();
const rtInitial = createRenderTarget();
const composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
const targets = [ rt1, rt2, rtInitial ];

if (supportsDepth) {
  rtInitial.depthTexture = new THREE.DepthTexture();
}

const depthTarget = rtInitial.depthTexture;

let time = 0;
let mesh = null;

const loop = createLoop(render).start();
resize();
window.addEventListener('resize', resize);
window.addEventListener('touchstart', ev => ev.preventDefault());

// ensure we are at top on iPhone in landscape
const isIOS = /(iPhone|iPad)/i.test(navigator.userAgent);
if (isIOS) {
  const fixScroll = () => {
    setTimeout(() => {
      window.scrollTo(0, 1);
    }, 500);
  };

  fixScroll();
  window.addEventListener('orientationchange', () => {
    fixScroll();
  }, false);
}

window.onkeydown = function (e) {
  if (e.keyCode === 32) return false;
};
setupPost();

const supportsMedia = !isIOS;
setupScene({ palettes: getPalette(), supportsMedia });

function setupPost () {
  composer.addPass(new EffectComposer.RenderPass(scene, camera));

  if (supportsDepth) {
    var pass = new EffectComposer.ShaderPass(SSAOShader);
    pass.material.precision = 'highp';
    composer.addPass(pass);
    pass.uniforms.tDepth.value = depthTarget;
    pass.uniforms.cameraNear.value = camera.near;
    pass.uniforms.cameraFar.value = camera.far;
  }

  composer.addPass(new BloomPass(scene, camera));
  composer.passes[composer.passes.length - 1].renderToScreen = true;
}

function createRenderTarget (numAttachments) {
  numAttachments = numAttachments || 0;
  const target = numAttachments > 1
    ? new THREE.WebGLMultiRenderTarget(window.innerWidth, window.innerHeight)
    : new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  target.texture.format = THREE.RGBFormat;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.stencilBuffer = false;
  target.depthBuffer = true;
  if (numAttachments > 1) {
    var gBufferNormalRoughness = target.texture.clone();
    gBufferNormalRoughness.format = THREE.RGBAFormat;
    gBufferNormalRoughness.type = THREE.FloatType;
    target.attachments.push(gBufferNormalRoughness);
  }
  return target;
}

function resize () {
  const dpr = renderer.getPixelRatio();
  const size = renderer.getSize();
  const width = size.width * dpr;
  const height = size.height * dpr;
  targets.forEach(t => {
    t.setSize(width, height);
  });
}

function render (dt) {
  time += Math.min(30, dt) / 1000;
  if (mesh) {
    mesh.position.y = Math.sin(time) * 0.25 + 1;
    mesh.rotation.y += dt * 0.00005;
  }

  updateProjectionMatrix();

  composer.passes.forEach(pass => {
    if (pass.uniforms && pass.uniforms.resolution) {
      pass.uniforms.resolution.value.set(rtInitial.width, rtInitial.height);
    }
  });

  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  if (composer.passes.length > 1) composer.render();
  else renderer.render(scene, camera);
}

function setupScene ({ palettes }) {
  document.querySelector('#canvas').style.display = 'block';

  // console.log('Total palettes', palettes.length);
  const audio = createAudio();
  const onHotspotDown = () => {
    audio.effect = 1;
  };
  const onHotspotUp = () => {
    audio.effect = 0;
  };

  const whitePalette = [ '#fff', '#d3d3d3', '#a5a5a5' ];
  const background = whitePalette.shift();

  const geo = createScene({
    palettes,
    scene,
    whitePalette,
    loop,
    camera,
    renderer,
    onHotspotUp,
    onHotspotDown
  });

  let started = false;

  if (isMobile) {
    audio.skip();
  } else {
    audio.queue();
    audio.once('ready', () => {
      audio.playQueued();
    });
  }

  started = true;
  renderer.setClearColor(new THREE.Color(background), 1);
  document.body.style.background = background;

  loop.on('tick', dt => {
    time += dt;
    if (!started) return;

    audio.update(dt);

    // for (let i = 0; i < audio.beats.length; i++) {
    //   if (readyForGeometry[i] && audio.beats[i]) {
    //     geo.nextGeometry({ type: i });
    //     readyForGeometry[i] = false;
    //   }
    // }
    // if (!interactions.keyDown && readyForPaletteChange && audio.beats[1] && switchPalettes) {
    //   geo.nextPalette();
    //   readyForPaletteChange = false;
    // }
  });
}

function helloWorld () {
  log.intro();
}