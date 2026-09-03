
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
<div class="app">
  <div id="scene" class="scene"></div>
  <section class="hud">
    <div class="title">RAVEN-RX · MOUNTAIN RECOVERY</div>
    <div class="subtitle">Standalone 3D terrain review build</div>
    <div class="banner"><b id="phase">READY</b><span id="message" class="small">Start the deterministic recovery demonstration.</span></div>
    <div class="grid">
      <div class="metric"><span>Vehicle</span><strong id="vehicle">AT START</strong></div>
      <div class="metric"><span>Active route</span><strong id="route">ROUTE A</strong></div>
      <div class="metric"><span>Road alignment</span><strong id="alignment">0.00 m</strong></div>
      <div class="metric"><span>Recovery</span><strong id="recovery">0</strong></div>
      <div class="metric"><span>Decision</span><strong id="decision">INITIAL</strong></div>
      <div class="metric"><span>Risk</span><strong id="risk">18%</strong></div>
    </div>
  </section>
  <div class="controls">
    <button id="start" class="cyan">START 4–5 MIN DEMO</button>
    <button id="jump">JUMP TO RECOVERY</button>
    <button id="pause">PAUSE</button>
    <button id="reset">RESET</button>
  </div>
  <div class="legend">
    <div><i class="dot" style="background:#f2f2f2"></i>Road + white markings</div>
    <div><i class="dot" style="background:#ef5a5a"></i>Forward infeasible section</div>
    <div><i class="dot" style="background:#43d7ff"></i>Active route overlay</div>
    <div><i class="dot" style="background:#e8c45a"></i>Autonomous truck</div>
  </div>
</div>`;

const sceneEl = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080a);
scene.fog = new THREE.Fog(0x06080a, 100, 290);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
camera.position.set(28, 30, 48);

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .48;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xbac6d1, 0x111512, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(55, 75, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1536,1536);
scene.add(sun);

// ---------- TERRAIN ----------
const terrainMat = new THREE.MeshStandardMaterial({color:0x27302b,roughness:1});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240,220,2,2), terrainMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

const mountainMat = new THREE.MeshStandardMaterial({color:0x303632,roughness:1});
const rockMat = new THREE.MeshStandardMaterial({color:0x3c403e,roughness:1});

for(let i=0;i<18;i++){
  const radius = 14 + Math.random()*22;
  const height = 18 + Math.random()*28;
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius,height,7), mountainMat);
  mountain.position.set((Math.random()-.5)*190, height/2-2, (Math.random()-.5)*170);
  mountain.rotation.y = Math.random()*Math.PI;
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  scene.add(mountain);
}

// ---------- ROUTE GRAPH ----------
const V = (x,z) => new THREE.Vector3(x, .35, z);

const routePoints = {
  A: [V(-54,62),V(-42,49),V(-31,34),V(-23,18),V(-17,2),V(-14,-14),V(-12,-27),V(-10,-39),V(-8,-49)],
  B: [V(-14,-14),V(-5,-9),V(6,-2),V(16,7),V(25,19),V(34,32),V(44,43),V(55,51)],
  C: [V(-14,-14),V(-3,-2),V(4,11),V(6,25),V(5,39),V(2,53),V(-1,66)]
};

const curves = {};
for(const [id,pts] of Object.entries(routePoints)){
  curves[id] = new THREE.CatmullRomCurve3(pts,false,'catmullrom',0.28);
}

function nearestPointOnCurve(curve, worldPos, samples=250){
  let bestT=0,bestD=Infinity;
  for(let i=0;i<=samples;i++){
    const t=i/samples, p=curve.getPointAt(t);
    const d=p.distanceTo(worldPos);
    if(d<bestD){bestD=d;bestT=t}
  }
  return {t:bestT,distance:bestD,point:curve.getPointAt(bestT)};
}

// ---------- ROAD BUILDER ----------
function addRoad(id, curve, width=5.8){
  // dark asphalt body
  const road = new THREE.Mesh(
    new THREE.TubeGeometry(curve,240,width/2,8,false),
    new THREE.MeshStandardMaterial({color:0x090a0b,roughness:.9,metalness:.02})
  );
  road.receiveShadow=true;
  scene.add(road);

  // center dashed white stripe
  const centerMat = new THREE.MeshBasicMaterial({color:0xf4f4f4});
  for(let i=0;i<38;i++){
    const a=i/38, b=a+0.012;
    const p1=curve.getPointAt(a), p2=curve.getPointAt(Math.min(1,b));
    const dash = new THREE.Mesh(new THREE.BoxGeometry(.16,.035,Math.max(.25,p1.distanceTo(p2))),centerMat);
    dash.position.copy(p1); dash.position.y=.36;
    dash.lookAt(p2.x,.36,p2.z);
    scene.add(dash);
  }

  // solid white edge lines, slightly offset from center
  for(const side of [-1,1]){
    const points=[];
    for(let i=0;i<=180;i++){
      const t=i/180,p=curve.getPointAt(t),tan=curve.getTangentAt(t).normalize();
      const sideVec=new THREE.Vector3(-tan.z,0,tan.x).multiplyScalar(side*(width/2-.22));
      points.push(new THREE.Vector3(p.x+sideVec.x,.38,p.z+sideVec.z));
    }
    const lineCurve=new THREE.CatmullRomCurve3(points);
    const line=new THREE.Mesh(
      new THREE.TubeGeometry(lineCurve,180,.055,4,false),
      centerMat
    );
    scene.add(line);
  }
}
addRoad('A',curves.A);
addRoad('B',curves.B);
addRoad('C',curves.C);

// Route overlays are intentionally thinner and slightly above the road.
function addOverlay(curve,color,opacity=.35){
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity});
  const line=new THREE.Mesh(new THREE.TubeGeometry(curve,220,.075,5,false),mat);
  line.position.y=.18;
  scene.add(line);
  return line;
}
const overlayA=addOverlay(curves.A,0x43d7ff,.38);
const overlayB=addOverlay(curves.B,0x43d7ff,.15);
const overlayC=addOverlay(curves.C,0x43d7ff,.10);

// ---------- ROAD-AWARE VEGETATION ----------
const treeGroup=new THREE.Group();
scene.add(treeGroup);
const trunkGeo=new THREE.CylinderGeometry(.18,.24,1.2,6);
const crownGeo=new THREE.ConeGeometry(1.15,4.2,7);
const trunkMat=new THREE.MeshStandardMaterial({color:0x43352a});
const crownMat=new THREE.MeshStandardMaterial({color:0x25362c});

function tooCloseToRoad(x,z,clearance=8.5){
  const p=new THREE.Vector3(x,.35,z);
  return Object.values(curves).some(c=>nearestPointOnCurve(c,p,70).distance < clearance);
}
function addTree(x,z,s){
  const g=new THREE.Group();
  const tr=new THREE.Mesh(trunkGeo,trunkMat), cr=new THREE.Mesh(crownGeo,crownMat);
  tr.position.y=.6; cr.position.y=2.8;
  g.add(tr,cr); g.position.set(x,0,z); g.scale.setScalar(s);
  g.rotation.y=Math.random()*Math.PI*2;
  g.traverse(o=>o.castShadow=true);
  treeGroup.add(g);
}

let treeAttempts=0;
while(treeAttempts<1800 && treeGroup.children.length<105){
  treeAttempts++;
  const x=(Math.random()-.5)*190, z=(Math.random()-.5)*170;
  if(tooCloseToRoad(x,z,9.5)) continue;
  const scale=.42+Math.random()*.30;
  addTree(x,z,scale);
}

// sparse rocks, also road-aware
for(let i=0;i<70;i++){
  const x=(Math.random()-.5)*190,z=(Math.random()-.5)*170;
  if(tooCloseToRoad(x,z,7.0)) continue;
  const r=.5+Math.random()*1.5;
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),rockMat);
  rock.position.set(x,r*.65,z);
  rock.rotation.set(Math.random(),Math.random(),Math.random());
  rock.castShadow=true;
  scene.add(rock);
}

// ---------- MARKERS ----------
function marker(x,z,color){
  const m=new THREE.Mesh(
    new THREE.SphereGeometry(1.0,16,12),
    new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25})
  );
  m.position.set(x,1.25,z);
  scene.add(m);
}
marker(-54,62,0x65d58a);
marker(-14,-14,0x43d7ff);
marker(55,51,0x65d58a);

// Infeasible section: physical barrier + rocks around the outside, never across the whole road.
const badT=.82;
const badPoint=curves.A.getPointAt(badT);
const barrier=new THREE.Mesh(
  new THREE.BoxGeometry(4.4,2.2,.45),
  new THREE.MeshStandardMaterial({color:0x9c343b,emissive:0x351014})
);
barrier.position.set(badPoint.x,1.15,badPoint.z);
barrier.lookAt(curves.A.getPointAt(badT+.01).x,1.15,curves.A.getPointAt(badT+.01).z);
scene.add(barrier);

// ---------- TRUCK ----------
const truck=new THREE.Group();
const body=new THREE.Mesh(
  new THREE.BoxGeometry(3.0,1.45,5.0),
  new THREE.MeshStandardMaterial({color:0xb8c0c6,metalness:.25,roughness:.6})
);
body.position.y=1.8;
truck.add(body);

const cab=new THREE.Mesh(
  new THREE.BoxGeometry(2.85,1.65,2.0),
  new THREE.MeshStandardMaterial({color:0x69747c,roughness:.65})
);
cab.position.set(0,2.65,1.35);
truck.add(cab);

const wheelGeo=new THREE.CylinderGeometry(.47,.47,.36,16);
const wheelMat=new THREE.MeshStandardMaterial({color:0x111214,roughness:.9});
for(const x of [-1.48,1.48]) for(const z of [-1.55,1.55]){
  const w=new THREE.Mesh(wheelGeo,wheelMat);
  w.rotation.z=Math.PI/2;
  w.position.set(x,1.0,z);
  truck.add(w);
}
truck.traverse(o=>o.castShadow=true);
scene.add(truck);

const truckState={
  route:'A',
  t:0,
  phase:'READY',
  recoveryCount:0,
  heading:0
};

function setTruckFromCurve(curve,t,reverse=false){
  const p=curve.getPointAt(THREE.MathUtils.clamp(t,0,1));
  const tangent=curve.getTangentAt(THREE.MathUtils.clamp(t,0,1)).normalize();
  const dir=reverse ? tangent.clone().multiplyScalar(-1) : tangent;
  const targetHeading=Math.atan2(dir.x,dir.z);

  // Smooth steering, never snap.
  let diff=THREE.MathUtils.euclideanModulo(targetHeading-truckState.heading+Math.PI,Math.PI*2)-Math.PI;
  truckState.heading += diff*Math.min(1,0.16);
  truck.position.set(p.x,.38,p.z);
  truck.rotation.y=truckState.heading;
}

function alignmentError(curve){
  const q=nearestPointOnCurve(curve,truck.position,180);
  return q.distance;
}

// ---------- DETERMINISTIC 4m40s DEMO ----------
let elapsed=0, running=false, paused=false;
const ui={
  phase:document.querySelector('#phase'),
  message:document.querySelector('#message'),
  vehicle:document.querySelector('#vehicle'),
  route:document.querySelector('#route'),
  alignment:document.querySelector('#alignment'),
  recovery:document.querySelector('#recovery'),
  decision:document.querySelector('#decision'),
  risk:document.querySelector('#risk')
};

function text(phase,msg,vehicle,route,decision,risk){
  ui.phase.textContent=phase;
  ui.message.textContent=msg;
  ui.vehicle.textContent=vehicle;
  ui.route.textContent=route;
  ui.decision.textContent=decision;
  ui.risk.textContent=risk;
}

function simulation(s){
  if(s<25){
    truckState.phase='INITIALIZING';
    setTruckFromCurve(curves.A,0);
    text('INITIALIZING','Terrain, road geometry and vehicle constraints are loading.','AT START','ROUTE A','INITIAL','18%');
  }else if(s<95){
    const t=(s-25)/70*.78;
    truckState.phase='MOVING';truckState.route='A';truckState.t=t;
    setTruckFromCurve(curves.A,t);
    text('MOVING','Truck is centered on the black asphalt road and following the white centerline.','TRAVELLING','ROUTE A','FEASIBLE','18%');
  }else if(s<120){
    truckState.phase='INFEASIBLE';truckState.t=.78;
    setTruckFromCurve(curves.A,.78);
    text('FORWARD PATH INFEASIBLE','Turning-radius constraint detected before the constrained mountain section. Vehicle is stopped.','STOPPED','ROUTE A','REJECT A','>35%');
  }else if(s<205){
    truckState.phase='BACKTRACK';
    const q=(s-120)/85;
    truckState.t=.78-q*.38;
    setTruckFromCurve(curves.A,truckState.t,true);
    truckState.recoveryCount=1;
    text('SAFE BACKTRACK','No safe forward continuation. Reversing along the already-travelled road to the nearest safe junction.','REVERSING','ROUTE A','BACKTRACK','18%');
  }else if(s<225){
    truckState.phase='REPLAN';truckState.t=.40;
    setTruckFromCurve(curves.A,.40,true);
    text('REPLANNING','Recovery node reached. Evaluating Route B and Route C from the safe decision point.','AT JUNCTION','A → B','SELECT ROUTE B','29%');
  }else if(s<280){
    truckState.phase='REROUTE';truckState.route='B';
    const q=(s-225)/55;truckState.t=q;
    setTruckFromCurve(curves.B,q);
    text('PHYSICAL REROUTE','Truck is turning onto the physical Route B road and remains centered.','TURNING','ROUTE B','B ACTIVE','29%');
  }else{
    truckState.phase='COMPLETE';truckState.route='B';
    const q=Math.min(1,(s-280)/40);truckState.t=q;
    setTruckFromCurve(curves.B,q);
    text('MISSION COMPLETE','Destination reached after safe backtracking and route recovery.','ARRIVED','ROUTE B','COMPLETE','29%');
  }
  ui.recovery.textContent=truckState.recoveryCount;
  const active=curves[truckState.route];
  ui.alignment.textContent=alignmentError(active).toFixed(2)+' m';
}

function reset(){
  running=false;paused=false;elapsed=0;
  truckState.route='A';truckState.t=0;truckState.recoveryCount=0;truckState.heading=0;
  setTruckFromCurve(curves.A,0);
  simulation(0);
}
document.querySelector('#start').onclick=()=>{elapsed=0;running=true;paused=false};
document.querySelector('#jump').onclick=()=>{elapsed=95;running=true;paused=false};
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'RESUME':'PAUSE'};
document.querySelector('#reset').onclick=reset;

function resize(){
  const w=sceneEl.clientWidth,h=sceneEl.clientHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
window.addEventListener('resize',resize);resize();

// Camera follows truck broadly but does not force a narrow view.
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,clock.getDelta());
  if(running&&!paused){
    elapsed+=dt;
    simulation(elapsed);
  }
  controls.target.lerp(new THREE.Vector3(truck.position.x,0,truck.position.z),.025);
  controls.update();
  renderer.render(scene,camera);
}
reset();
animate();
