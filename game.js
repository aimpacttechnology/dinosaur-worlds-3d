import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#game');
const setup = document.querySelector('#setup');
const hud = document.querySelector('#hud');
const thumbstick = document.querySelector('#thumbstick');
const knob = document.querySelector('#knob');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, innerWidth/innerHeight, .1, 180);
const clock = new THREE.Clock();
const names = ['Pterodactyl','T-Rex','Velociraptor','Brachiosaurus','Megalodon','Spinosaurus','Livyatan Melvillei','Mosasaurus','Eel'];
const dinos = [
  {name:names[0],biome:'Land',color:0xb78ad3,speed:8,flyer:true},
  {name:names[1],biome:'Land',color:0x719b4a,speed:3.2,heavy:true},
  {name:names[2],biome:'Land',color:0xb98c4e,speed:9},
  {name:names[3],biome:'Land',color:0x78a9a0,speed:4,large:true},
  {name:names[4],biome:'Water',color:0x667e90,speed:8,sea:true},
  {name:names[5],biome:'Water',color:0x9b694c,speed:7,sea:true,sail:true},
  {name:names[6],biome:'Water',color:0x526e80,speed:6,sea:true,whale:true},
  {name:names[7],biome:'Water',color:0x478b80,speed:8,sea:true},
  {name:names[8],biome:'Water',color:0x9eae46,speed:10,sea:true,eel:true}
];
let selected=dinos[0], biome='Land', mode='computer', started=false, yaw=0, pitch=0, fly=false;
let player={x:0,z:0,hp:100,speed:5}, enemies=[], critters=[], keys={}, stick={x:0,y:0};
let attackCooldown=0, attackPose=0, time=0, roomCode='';
const worldSize=150;

function resize(){
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);

function material(color, roughness=.85){return new THREE.MeshStandardMaterial({color,roughness});}
const mats={
  bark:material(0x64462f), leaves:material(0x306c3b), grass:material(0x6da44e),
  rock:material(0x666b69), darkrock:material(0x303b3c), lava:material(0xff6a22),
  coral:[0xe87860,0xe5b35d,0xc979bf,0x68c8bf].map(c=>material(c))
};
function box(parent, mat, size, pos, round=false){
  const mesh=new THREE.Mesh(round?new THREE.SphereGeometry(1,12,9):new THREE.BoxGeometry(...size),mat);
  if(round)mesh.scale.set(...size);
  mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh);return mesh;
}
function cylinder(parent,mat,r1,r2,h,pos,segments=8){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);
  m.position.set(...pos);m.castShadow=true;parent.add(m);return m;
}
function makeDino(d, enemy=false){
  const group=new THREE.Group(), color=material(d.color), dark=material(new THREE.Color(d.color).multiplyScalar(.68)), belly=material(0xd0b88d);
  const parts={legs:[],tail:[],wings:[],mouth:null};
  if(d.eel){
    for(let i=0;i<8;i++){
      const seg=box(group,i%2?dark:color,[.62,.45,.9],[0,.05,1.8+i*.72],true);parts.tail.push(seg);
    }
    box(group,color,[.72,.6,1],[0,.05,1],true);
    const jaw=box(group,belly,[.56,.18,.58],[0,-.24,.45]);parts.mouth=jaw;
    for(let side of [-1,1]) for(let i=0;i<4;i++) cylinder(group,material(0xf5ebcf),.015,.09,.16,[side*(.14+i*.1),-.25,.29+i*.11],5);
  }else{
    const scale=d.large?1.38:d.heavy?1.3:d.whale?1.4:1;
    box(group,color,[1.15*scale,.9*scale,1.8*scale],[0,0,.2],true);
    box(group,belly,[.84*scale,.23,.9*scale],[0,-.38,.05],true);
    const headZ=-.95*scale;
    box(group,color,[.75*scale,.67*scale,.86*scale],[0,.28*scale,headZ],true);
    const snoutLength=d.heavy?.78:d.whale?1.05:.56;
    box(group,color,[d.heavy?.8:1*scale,d.heavy?.38:.38,snoutLength],[0,.05,headZ-snoutLength*.58],true);
    const jaw=box(group,material(0x7d463a),[.78*scale,.14,snoutLength*.96],[0,-.18*scale,headZ-snoutLength*.55]);
    parts.mouth=jaw;
    for(const side of [-1,1]){
      const eye=box(group,material(0xffd66b),[.13,.13,.08],[side*.31*scale,.39*scale,headZ-.18]);
      box(group,material(0x111714),[.05,.08,.04],[side*.32*scale,.4*scale,headZ-.23]);
      if(d.sea){
        const fin=box(group,dark,[.25,.12,.58],[side*.64,-.08,.12],true);fin.rotation.z=side*.3;parts.wings.push(fin);
      }else if(!d.flyer){
        for(let l=0;l<2;l++){
          const leg=box(group,dark,[.3,.62,.34],[side*.38,-.58,.42+l*.43],true);
          parts.legs.push(leg);
        }
        const arm=box(group,color,[.2,.37,.27],[side*.6,-.05,-.42],true);arm.rotation.z=side*.35;
      }else{
        const wing=new THREE.Group();wing.position.set(side*.34,.25,.1);group.add(wing);
        box(wing,dark,[.09,.08,1.65],[side*.22,.12,.38],true);
        box(wing,color,[.15,.08,1.15],[side*.45,.09,.32],true);
        for(let f=0;f<3;f++){const feather=box(wing,material(0xcba5dc),[.08,.045,.58],[side*(.36+f*.23),.08,.75+f*.23],true);parts.tail.push(feather);}
        parts.wings.push(wing);
      }
    }
    const tailCount=d.large?4:3;
    for(let i=0;i<tailCount;i++){
      const seg=box(group,dark,[.58*(1-i*.19),.5*(1-i*.17),.8],[0,-.05* i,1.22+i*.64],true);parts.tail.push(seg);
    }
    if(d.sail){
      const profile=new THREE.Shape();
      profile.moveTo(-1,.35);profile.lineTo(-.78,1.05);profile.lineTo(-.52,.55);
      profile.lineTo(-.26,1.5);profile.lineTo(-.04,.58);profile.lineTo(.22,1.2);
      profile.lineTo(.4,.55);profile.lineTo(.66,1.02);profile.lineTo(.86,.36);profile.closePath();
      const spine=new THREE.Mesh(new THREE.ShapeGeometry(profile),new THREE.MeshStandardMaterial({color:0xd97a4e,side:THREE.DoubleSide,roughness:.8}));
      spine.rotation.y=Math.PI/2;spine.position.set(0,0,0);spine.castShadow=true;group.add(spine);
    }
    if(d.sea){
      for(const side of [-1,1]) for(let j=0;j<2;j++){
        const flipper=box(group,dark,[.18,.12,.56],[side*.35,.05,.38+j*.48],true);flipper.rotation.y=side*.35;parts.wings.push(flipper);
      }
    }
  }
  group.userData={...d,parts,baseY:0,phase:Math.random()*6.2,enemy};
  return group;
}

function clearWorld(){
  for(const child of [...scene.children]) scene.remove(child);
  enemies=[];critters=[];
}
function createWorld(){
  clearWorld();
  scene.background=new THREE.Color(biome==='Water'?0x22a9c5:0x9ecb78);
  scene.fog=new THREE.Fog(biome==='Water'?0x32adc2:0x9ecb78,35,135);
  scene.add(new THREE.HemisphereLight(0xdaf6ff,0x405336,biome==='Water'?2:2.4));
  const sun=new THREE.DirectionalLight(0xfff0cf,3);sun.position.set(-25,40,-18);sun.castShadow=true;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(worldSize,worldSize),material(biome==='Water'?0x168ead:0x578545));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
  if(biome==='Land'){
    for(let i=0;i<36;i++){
      const x=(Math.random()-.5)*125,z=(Math.random()-.5)*125;
      if(Math.hypot(x,z)<12)continue;
      cylinder(scene,mats.bark,.45,.8,4,[x,2,z]);
      const crown=box(scene,mats.leaves,[3+Math.random()*2,3+Math.random()*2,3+Math.random()*2],[x,4.4,z],true);
      crown.geometry=new THREE.IcosahedronGeometry(1.7+Math.random()*.6,1);
      crown.scale.setScalar(1);
    }
    const volcano=cylinder(scene,mats.darkrock,10,14,9,[-28,4,-42],9);
    const crater=cylinder(scene,mats.lava,2.4,4,1,[ -28,8.5,-42],8);
    for(let i=0;i<12;i++){
      const x=35+(Math.random()-.5)*16,z=30+(Math.random()-.5)*12;
      const swamp=box(scene,material(0x426b4b),[2,.18,2],[x,.01,z],true);
      swamp.scale.y=.25;
    }
  }else{
    for(let i=0;i<16;i++){
      const x=(Math.random()-.5)*135,z=(Math.random()-.5)*135;
      const rock=box(scene,mats.rock,[2+Math.random()*3,1+Math.random()*2,2+Math.random()*3],[x,.5,z],true);
      rock.geometry=new THREE.DodecahedronGeometry(1,0);rock.scale.set(2,1.5,2);
      const c=box(scene,mats.darkrock,[5,3,2],[x,1.5,z],true);c.scale.set(1,1,.6);
      const opening=box(scene,material(0x07607b),[2,1.7,.1],[x,1.15,z-1.08],true);
      for(let j=0;j<4;j++){const coral=box(scene,mats.coral[j%4],[.4,1+Math.random(),.4],[x+Math.sin(j)*2,.5,z+Math.cos(j)*2],true);coral.rotation.z=.2;}
    }
    for(let i=0;i<25;i++){
      const f=box(scene,material([0xf5aa4a,0x47d5d0,0xee719b,0xf5df60][i%4]),[.55,.25,.3],[ (Math.random()-.5)*110,Math.random()*10-1,(Math.random()-.5)*110],true);
      f.userData={fish:true,speed:1+Math.random()*3,dir:Math.random()<.5?-1:1,phase:Math.random()*6.2};critters.push(f);
    }
  }
  const playerDino=makeDino(selected);playerDino.visible=false;scene.add(playerDino);
  player.x=0;player.z=0;player.hp=100;player.speed=selected.speed;fly=false;
  const available=dinos.filter(d=>d.biome===biome&&d.name!==selected.name);
  for(let i=0;i<7;i++){
    const d=available[i%available.length],mesh=makeDino(d,true);
    mesh.position.set((Math.random()-.5)*70,0,(Math.random()-.5)*70);scene.add(mesh);
    mesh.userData.hp=100;mesh.userData.walk=Math.random()*.5;enemies.push(mesh);
  }
  camera.position.set(0,selected.sea?2.2:2.4,0);camera.rotation.order='YXZ';
}

function showCards(){
  const grid=document.querySelector('#dinoGrid');grid.innerHTML='';
  dinos.filter(d=>d.biome===document.querySelector('.tab.active').dataset.tab).forEach(d=>{
    const b=document.createElement('button');b.className='dino-card'+(selected.name===d.name?' selected':'');
    b.innerHTML=`<span class="emoji">${d.flyer?'🪽':d.eel?'〰️':d.sea?'🌊':'🦖'}</span><b>${d.name}</b>`;
    b.onclick=()=>{selected=d;showCards();};grid.appendChild(b);
  });
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(a=>a.classList.toggle('active',a===t));
  selected=dinos.find(d=>d.biome===t.dataset.tab);showCards();
});
document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{
  mode=b.dataset.mode;document.querySelector('#modeStep').classList.add('hidden');
  document.querySelector('#selectStep').classList.remove('hidden');showCards();
});
document.querySelector('#playButton').onclick=()=>{
  biome=selected.biome;setup.classList.add('hidden');hud.classList.remove('hidden');
  thumbstick.classList.toggle('hidden',mode!=='mobile');
  document.querySelector('#dinoName').textContent=selected.name;
  document.querySelector('#flyButton').classList.toggle('hidden',!selected.flyer);
  started=true;createWorld();say(`${biome} world!`);if(mode==='computer')canvas.requestPointerLock?.();
};
document.querySelector('#homeButton').onclick=()=>{
  started=false;document.exitPointerLock?.();hud.classList.add('hidden');setup.classList.remove('hidden');
  document.querySelector('#modeStep').classList.add('hidden');document.querySelector('#selectStep').classList.remove('hidden');showCards();
};
document.querySelector('#privateButton').onclick=()=>{
  const code=document.querySelector('#roomCode').value.trim().toUpperCase();
  if(code){say('Private biomes need online multiplayer hosting.');return;}
  roomCode=Math.random().toString(36).slice(2,8).toUpperCase();
  document.querySelector('#roomCode').value=roomCode;
  say(`Room code ${roomCode} — demo only, friends cannot connect yet.`);
};

function say(text){
  const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');
  clearTimeout(say.timer);say.timer=setTimeout(()=>el.classList.remove('show'),2300);
}
function grunt(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ac=grunt.context||(grunt.context=new AC()),osc=ac.createOscillator(),gain=ac.createGain();
  const base=selected.eel?95:selected.sea?130:selected.heavy?70:selected.flyer?220:155;
  osc.type=selected.sea?'sawtooth':'triangle';osc.frequency.setValueAtTime(base,ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(base*.55,ac.currentTime+.2);
  gain.gain.setValueAtTime(.12,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.28);
  osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+.3);
}
function attack(type){
  if(!started||attackCooldown>0)return;
  attackCooldown=.4;attackPose=.3;grunt();
  if(type==='fly'){
    fly=!fly;player.speed=selected.speed;say(fly?'Taking off!':'Landed');return;
  }
  if(type==='jump'){camera.position.y+=.45;return;}
  if(type==='poop'){
    if(!fly){say('Take off first!');return;}
    const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const target=enemies.find(e=>{
      const offset=e.position.clone().sub(camera.position);
      return offset.length()<35&&offset.normalize().dot(forward)>.86&&e.position.y<camera.position.y+2;
    });
    if(target){scene.remove(target);enemies=enemies.filter(e=>e!==target);say('Direct hit!');}
    else say('Poop! Aim at a dinosaur below you.');
    return;
  }
  const target=enemies.find(e=>e.position.distanceTo(camera.position)<7);
  if(target){
    target.userData.hp-=type==='bite'?40:type==='whip'?28:20;
    target.userData.parts.mouth.scale.y=type==='bite'?2:1;
    if(target.userData.hp<=0){scene.remove(target);enemies=enemies.filter(e=>e!==target);player.hp=Math.min(100,player.hp+12);say('Dinosaur defeated! +12 health');}
  }else say(type==='bite'?'Chomp!':type==='whip'?'Tail whip!':'Slap!');
}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>attack(b.dataset.action));
document.querySelector('#flyButton').onclick=()=>attack('fly');
document.querySelector('#poopButton').onclick=()=>attack('poop');
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.code==='Space'){e.preventDefault();attack('jump');}if(e.key.toLowerCase()==='f')attack('fly');});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('click',()=>{if(mode==='computer'&&started&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-1.25,1.25);}});
let touchLook=null;
addEventListener('pointerdown',e=>{
  if(mode==='mobile'&&started&&e.pointerType==='touch'&&!e.target.closest('button,.thumbstick'))touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};
});
addEventListener('pointermove',e=>{
  if(!touchLook||touchLook.id!==e.pointerId)return;
  yaw-=(e.clientX-touchLook.x)*.006;
  pitch=THREE.MathUtils.clamp(pitch-(e.clientY-touchLook.y)*.006,-1.25,1.25);
  touchLook.x=e.clientX;touchLook.y=e.clientY;
});
addEventListener('pointerup',e=>{if(touchLook?.id===e.pointerId)touchLook=null;});
addEventListener('blur',()=>keys={});
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

function animateDino(d,delta){
  const data=d.userData,parts=data.parts;data.phase+=delta*4;
  if(parts.legs)parts.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(data.phase+(i%2)*Math.PI)*.38;});
  parts.tail.forEach((tail,i)=>{tail.rotation.y=Math.sin(data.phase-i*.55)*.17;});
  parts.wings.forEach((wing,i)=>{wing.rotation.z=Math.sin(data.phase*1.5+i)*.3;});
  if(parts.mouth&&attackPose>0)parts.mouth.scale.y=1+Math.sin((attackPose/.3)*Math.PI)*.8;
}
function update(delta){
  time+=delta;if(attackCooldown>0)attackCooldown-=delta;if(attackPose>0)attackPose-=delta;
  const speed=player.speed*(fly?1.45:1);
  let forward=(keys.w?1:0)-(keys.s?1:0)-stick.y;
  let side=(keys.d?1:0)-(keys.a?1:0)+stick.x;
  const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}
  player.x+=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed*delta;
  player.z+=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed*delta;
  player.x=clamp(player.x,-72,72);player.z=clamp(player.z,-72,72);
  if(selected.flyer&&fly)camera.position.y=8+Math.sin(time*5)*.24;
  else camera.position.y=selected.sea?2.1:1.75;
  camera.position.x=player.x;camera.position.z=player.z;
  camera.rotation.set(pitch,yaw,0,'YXZ');
  enemies.forEach(enemy=>{
    const d=enemy.userData,dist=enemy.position.distanceTo(camera.position);
    if(dist>5&&dist<30){
        const dir=camera.position.clone().sub(enemy.position).normalize();
        enemy.position.addScaledVector(dir,delta*enemy.userData.speed*.34);
    }
    if(dist<2.1){player.hp-=delta*(selected.sea||biome==='Land'?14:25);if(player.hp<=0)respawn();}
    animateDino(enemy,delta);
    let bar=enemy.userData.bar;
    if(!bar){
      bar=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.12),material(0x301c1c));
      const fg=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.07),material(0x35de55));fg.position.z=.01;bar.add(bg,fg);enemy.add(bar);bar.position.set(0,1.5,-1.2);enemy.userData.bar=bar;enemy.userData.fill=fg;
    }
    enemy.userData.fill.scale.x=Math.max(0,d.hp/100);enemy.userData.fill.material.color.set(healthColor(d.hp));
    bar.lookAt(camera.position);
  });
  critters.forEach(f=>{f.position.x+=f.userData.dir*f.userData.speed*delta;if(Math.abs(f.position.x)>68)f.userData.dir*=-1;f.position.y=Math.sin(time*2+f.userData.phase)*.4;});
  document.querySelector('#healthBar').style.width=`${player.hp}%`;
  document.querySelector('#healthBar').style.background=healthColor(player.hp);
  document.querySelector('#healthText').textContent=`${Math.ceil(player.hp)} HP`;
}
function healthColor(h){return h>65?'#35de55':h>40?'#e4d842':h>20?'#f08b35':h>0?'#e33d31':'#111';}
function respawn(){
  player.hp=100;player.x=0;player.z=0;fly=false;player.speed=selected.speed;
  say('You were defeated — respawned!');
}
function render(){
  requestAnimationFrame(render);
  const delta=Math.min(clock.getDelta(),.05);
  if(started)update(delta);
  renderer.render(scene,camera);
}
render();

const stickEl=thumbstick;
stickEl.addEventListener('pointerdown',e=>{stickEl.setPointerCapture(e.pointerId);});
stickEl.addEventListener('pointermove',e=>{
  if(!stickEl.hasPointerCapture(e.pointerId))return;
  const r=stickEl.getBoundingClientRect();let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
  const l=Math.hypot(dx,dy),max=42;if(l>max){dx=dx/l*max;dy=dy/l*max;}
  knob.style.transform=`translate(${dx}px,${dy}px)`;stick.x=dx/max;stick.y=dy/max;
});
function releaseStick(){knob.style.transform='';stick.x=0;stick.y=0;}
stickEl.addEventListener('pointerup',releaseStick);stickEl.addEventListener('pointercancel',releaseStick);
