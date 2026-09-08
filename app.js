const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'path-honey-v1';
const WHEEL_MM = 195.407063053;

const functionLibrary = `from hub import light_matrix, motion_sensor, port
import hub
import runloop, motor
import motor_pair
motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)
motor.reset_relative_position(port.A,0)
async def giro_1(graus2,lado,vel_max=1050, vel_min=15):
    motion_sensor.reset_yaw(0)
    kp=12.5
    ki=0.02
    kd=1.5
    erro_anterior = graus2
    integral = 0
    dt = 0.01# 10ms, igual ao sleep do loop

    while True:
        angulo_atual = abs(motion_sensor.tilt_angles()[0]) / 10
        erro = graus2 - angulo_atual

        if erro <= 0.5:
            break

        integral += erro * dt
        integral = max(min(integral, 50), -50)# evita windup

        derivada = (erro - erro_anterior) / dt

        saida = (kp * erro) + (ki * integral) + (kd * derivada)
        velocidade = max(min(int(saida), vel_max), vel_min)

        motor_pair.move(motor_pair.PAIR_1, 100 * lado, velocity=velocidade)

        erro_anterior = erro
        await runloop.sleep_ms(10)

    motor_pair.stop(motor_pair.PAIR_1, stop=motor.BRAKE)
    await runloop.sleep_ms(100)

async def andar_1(milimetros, velocidade=90):
    motion_sensor.reset_yaw(0)
    motor.reset_relative_position(port.A, 0)
    await runloop.sleep_ms(50)

    graus_alvo = int(abs(milimetros) * 360 / 195.407063053)
    sentido = 1 if milimetros >= 0 else -1

    vel_cruzeiro = abs(velocidade) * sentido

    # Reduzimos a velocidade mínima extrema. O robô vai estar
    # apenas 'deslizando' no milissegundo final antes do travamento.
    vel_minima = 100 * sentido

    # Aumentamos um pouco a zona de frenagem para a curva ter mais espaço para atuar
    distancia_frenagem = 210
    kp_g = 1.0
    antecipacao = 10

    # Calculamos o espaço real onde a frenagem vai acontecer
    distancia_util = distancia_frenagem - antecipacao

    while True:
        posicao = abs(motor.relative_position(port.A))
        restante = graus_alvo - posicao

        if restante <= antecipacao:
            break

        if restante > distancia_frenagem:
            vel_atual = vel_cruzeiro
        else:
            # 1. Cria um fator de 0.0 a 1.0 baseado APENAS no espaço útil restante
            # Quando 'restante' for igual a 'antecipacao', o fator será exatamente 0.0
            fator_linear = (restante - antecipacao) / distancia_util

            # 2. A MÁGICA DA CURVA: Elevamos o fator a uma potência (ex: 1.5).
            # Isso transforma a reta de frenagem em uma parábola suave. O robô
            # começa a frear suavemente, perde velocidade e "pousa" macio.
            fator_curva = fator_linear ** 1.8

            vel_calculada = vel_cruzeiro * fator_curva

            if sentido > 0:
                vel_atual = max(vel_minima, vel_calculada)
            else:
                vel_atual = min(vel_minima, vel_calculada)

        angulo = motion_sensor.tilt_angles()[0] / 10.0
        erro = 0 - angulo
        correcao = int(erro * kp_g)

        if sentido < 0:
            correcao = -correcao

        correcao = max(-30, min(30, correcao))

        motor_pair.move(motor_pair.PAIR_1, correcao, velocity=int(vel_atual))
        await runloop.sleep_ms(10)

    motor_pair.stop(motor_pair.PAIR_1, stop=motor.HOLD)

async def garra(porta,graus3,velocidade,parar,aceleraçao,desaceleraçao):
    await motor.run_for_degrees(getattr(port,porta),graus3,velocidade,stop=getattr(motor,parar),acceleration=aceleraçao,deceleration=desaceleraçao)
    runloop.sleep_ms(100)

async def garra_1(porta,graus3,velocidade,parar,aceleraçao,desaceleraçao):
    motor.run_for_degrees(getattr(port,porta),graus3,velocidade,stop=getattr(motor,parar),acceleration=aceleraçao,deceleration=desaceleraçao)
    runloop.sleep_ms(100)
`;

const presets = [
  {name:'Lançamento 1', side:'left', actions:[
    ['drive',455,900],['motor_async','E',-295,500,'BRAKE',200,200],['drive',-350,800],['button','RIGHT'],['drive',825,900],['wait',500],['motor','E',50,1050,'HOLD',10000,100000],['motor','E',-50,800,'BRAKE',100,100],['motor','E',150,1050,'BRAKE',10000,100000],['motor_async','F',180,800,'BRAKE',100,100],['drive',-70,600],['turn',38,1,600,15],['drive',80,700],['motor','F',-140,800,'BRAKE',100,100],['turn',42,-1,350,15],['drive',-800,900]
  ]},
  {name:'Lançamento 2', side:'left', actions:[['drive',160,850],['turn',40,-1,500,15],['drive',590,900],['turn',40,1,350,15],['drive',170,300],['motor','E',-80,400,'BRAKE',100,100],['motor','E',80,400,'BRAKE',100,100],['motor','F',400,1000,'BRAKE',100,100]]},
  {name:'Lançamento 3', side:'left', actions:[['drive',430,800],['motor','F',-45,100,'BRAKE',100,100],['drive',-45,800],['motor','F',-70,50,'BRAKE',100,100],['drive',-480,800],['button','RIGHT'],['drive',280,500],['wait',50],['drive',350,500],['turn',30,1,200,15],['drive',100,200],['drive',-20,500],['turn',28,1,200,15],['turn',58,-1,200,15],['drive',-700,800],['button','RIGHT'],['motor_async','E',90,400,'BRAKE',200,200],['drive',970,800],['motor','E',-100,250,'BRAKE',200,200],['turn',70,-1,600,15],['drive',700,800]]},
  {name:'Lançamento 4', side:'right', actions:[['drive',620,500],['wait',1000],['drive',100,700],['turn',45,-1,200,15],['drive',95,200],['motor','F',100,800,'BRAKE',200,200],['motor_async','F',-100,800,'BRAKE',200,200],['turn',39,-1,200,15],['turn',15,1,100,15],['drive',-250,800],['motor_async','E',90,200,'BRAKE',100000,100000],['turn',70,1,200,15],['drive',40,500],['motor','E',-90,1050,'BRAKE',10000,100000],['drive',-50,500],['turn',85,1,150,15],['drive',310,800],['turn',50,1,150,15],['drive',-155,150],['drive',50,500],['turn',93,1,200,15],['drive',760,1050]]},
  {name:'Lançamento 5', side:'right', actions:[['motor','F',-200,500,'BRAKE',200,200],['drive',280,800],['motor','F',300,100,'BRAKE',200,200],['motor','E',-400,1050,'BRAKE',500,500],['turn',10,1,30,15],['motor_async','E',400,1050,'BRAKE',500,500],['drive',-150,600],['turn',20,-1,50,15],['drive',-150,500]]},
  {name:'Lançamento 6', side:'right', actions:[['drive',350,750],['motor','E',-90,100,'BRAKE',100,100],['drive',-130,1000],['drive',40,1000],['motor','E',65,200,'BRAKE',100,100],['drive',-350,850]]},
  {name:'Lançamento 7', side:'right', actions:[['drive',700,600],['motor','E',-500,700,'BRAKE',200,200],['drive',-50,500]]}
];

function actionFromArray(a){
  const t=a[0];
  if(t==='drive') return {type:t, mm:a[1], velocity:a[2]};
  if(t==='turn') return {type:t, deg:a[1], side:a[2], vmax:a[3], vmin:a[4]};
  if(t==='motor'||t==='motor_async') return {type:t, port:a[1], deg:a[2], velocity:a[3], stop:a[4], accel:a[5], decel:a[6]};
  if(t==='wait') return {type:t, ms:a[1]};
  if(t==='button') return {type:t, button:a[1]};
  return {type:'wait',ms:100};
}

function defaultState(){
  return {
    activeId:'launch-1', mode:'route', calibration:{widthMm:2360,heightMm:1143},
    launches: presets.map((p,i)=>({id:`launch-${i+1}`,name:p.name,side:p.side,heading:0,points:[],actions:p.actions.map(actionFromArray)}))
  };
}
let state;
try{ state=JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState(); }catch{ state=defaultState(); }
if(!state.calibration) state.calibration={widthMm:2360,heightMm:1143};

const els={
  launchList:$('#launchList'),launchName:$('#launchName'),startSide:$('#startSide'),startHeading:$('#startHeading'),
  width:$('#fieldWidthMm'),height:$('#fieldHeightMm'),routeLine:$('#routeLine'),pointLayer:$('#pointLayer'),fieldWrap:$('#fieldWrap'),
  actionList:$('#actionList'),code:$('#codePreview'),distance:$('#distanceMetric'),actions:$('#actionsMetric'),time:$('#timeMetric'),margin:$('#marginMetric'),
  save:$('#saveState'),coords:$('#cursorCoords'),dialog:$('#actionDialog'),dialogFields:$('#dialogFields'),dialogTitle:$('#dialogTitle'),dialogSubtitle:$('#dialogSubtitle')
};
function active(){return state.launches.find(x=>x.id===state.activeId) || state.launches[0];}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));els.save.textContent='salvo localmente';renderAll();}
function dirty(){els.save.textContent='salvando…';clearTimeout(dirty.t);dirty.t=setTimeout(save,160)}
function uid(){return 'launch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function normAngle(d){while(d>180)d-=360;while(d<-180)d+=360;return d;}

function renderLaunches(){
  els.launchList.innerHTML=state.launches.map(l=>`<div class="launch-item ${l.id===state.activeId?'active':''}" data-id="${l.id}"><strong>${esc(l.name)}</strong><span>${l.actions.length} ações • ${l.points.length} pontos</span></div>`).join('');
  $$('.launch-item').forEach(x=>x.onclick=()=>{state.activeId=x.dataset.id;renderAll();dirty()});
}
function renderConfig(){const l=active();els.launchName.value=l.name;els.startSide.value=l.side||'custom';els.startHeading.value=l.heading??0;els.width.value=state.calibration.widthMm;els.height.value=state.calibration.heightMm;}
function pointToSvg(p){return {x:p.x*1000,y:p.y*500};}
function renderRoute(){
  const l=active(); const pts=l.points||[];
  els.routeLine.setAttribute('points',pts.map(p=>{const q=pointToSvg(p);return `${q.x},${q.y}`}).join(' '));
  els.pointLayer.innerHTML=pts.map((p,i)=>{const q=pointToSvg(p);return `<g data-index="${i}"><circle class="${i===0?'start-point':'route-point'}" cx="${q.x}" cy="${q.y}" r="9"></circle><text x="${q.x+12}" y="${q.y-12}">${i+1}</text></g>`}).join('');
  if(state.mode==='move') enablePointDragging();
}
function routeDistance(){const pts=active().points||[];let d=0;for(let i=1;i<pts.length;i++){const dx=(pts[i].x-pts[i-1].x)*state.calibration.widthMm;const dy=(pts[i].y-pts[i-1].y)*state.calibration.heightMm;d+=Math.hypot(dx,dy)}return d;}
function actionTime(a){
  if(a.type==='drive'){
    const v=Math.max(1,Math.abs(+a.velocity||500));
    const mmps=v/360*WHEEL_MM;
    return Math.abs(+a.mm||0)/Math.max(1,mmps)*1.12 + .08;
  }
  if(a.type==='turn') return Math.abs(+a.deg||0)*0.010 + .12;
  if(a.type==='motor'||a.type==='motor_async'){
    if(a.type==='motor_async') return .10;
    return Math.abs(+a.deg||0)/Math.max(1,Math.abs(+a.velocity||500)) + .10;
  }
  if(a.type==='wait') return (+a.ms||0)/1000;
  if(a.type==='button') return 0;
  return 0;
}
function totalTime(){return active().actions.reduce((s,a)=>s+actionTime(a),0)}
function actionLabel(a){
  if(a.type==='drive') return ['Andar',`${a.mm} mm • vel ${a.velocity}`];
  if(a.type==='turn') return ['Girar',`${a.deg}° • ${+a.side===1?'direita':'esquerda'} • máx ${a.vmax}`];
  if(a.type==='motor') return ['Garra',`porta ${a.port} • ${a.deg}° • vel ${a.velocity}`];
  if(a.type==='motor_async') return ['Garra simultânea',`porta ${a.port} • ${a.deg}° • vel ${a.velocity}`];
  if(a.type==='wait') return ['Esperar',`${a.ms} ms`];
  if(a.type==='button') return ['Aguardar botão',a.button||'RIGHT'];
  return [a.type,''];
}
function renderActions(){
  const l=active();
  els.actionList.innerHTML=l.actions.map((a,i)=>{const [title,sub]=actionLabel(a);return `<div class="action-card" draggable="true" data-index="${i}"><div class="action-num">${i+1}</div><div class="action-main"><strong>${title}</strong><span>${esc(sub)}</span></div><div class="action-time">~${actionTime(a).toFixed(1)}s</div></div>`}).join('') || '<p class="hint">Nenhuma ação. Adicione manualmente ou desenhe uma rota no campo.</p>';
  $$('.action-card').forEach(c=>{c.onclick=()=>openActionDialog(+c.dataset.index);c.addEventListener('dragstart',()=>{c.classList.add('dragging');window.__dragIndex=+c.dataset.index});c.addEventListener('dragend',()=>c.classList.remove('dragging'));c.addEventListener('dragover',e=>{e.preventDefault();c.classList.add('drag-over')});c.addEventListener('dragleave',()=>c.classList.remove('drag-over'));c.addEventListener('drop',e=>{e.preventDefault();c.classList.remove('drag-over');const from=window.__dragIndex,to=+c.dataset.index;if(from===to)return;const [m]=l.actions.splice(from,1);l.actions.splice(to,0,m);dirty()})});
}
function actionCode(a){
  if(a.type==='drive') return `    await andar_1(${num(a.mm)}, ${num(a.velocity)})`;
  if(a.type==='turn') return `    await giro_1(${num(a.deg)}, ${num(a.side)}, ${num(a.vmax)}, ${num(a.vmin)})`;
  if(a.type==='motor') return `    await garra('${a.port}', ${num(a.deg)}, ${num(a.velocity)}, '${a.stop}', ${num(a.accel)}, ${num(a.decel)})`;
  if(a.type==='motor_async') return `    await garra_1('${a.port}', ${num(a.deg)}, ${num(a.velocity)}, '${a.stop}', ${num(a.accel)}, ${num(a.decel)})`;
  if(a.type==='wait') return `    await runloop.sleep_ms(${num(a.ms)})`;
  if(a.type==='button') return `    while not hub.button.pressed(hub.button.${a.button||'RIGHT'}):\n        pass`;
  return '';
}
function num(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*100)/100):'0'}
function generateCode(){const body=active().actions.map(actionCode).filter(Boolean).join('\n');return `${functionLibrary}\nasync def main():\n${body||'    pass'}\n\nrunloop.run(main())\n`;}
function renderCode(){els.code.textContent=generateCode();}
function renderMetrics(){const d=routeDistance(),t=totalTime(),m=150-t;els.distance.textContent=`${Math.round(d)} mm`;els.actions.textContent=active().actions.length;els.time.textContent=`${t.toFixed(1)} s`;els.margin.textContent=`${m.toFixed(1)} s`;els.margin.closest('.metric').classList.toggle('warning',m<0)}
function renderAll(){if(!state.launches.length){state=defaultState()}renderLaunches();renderConfig();renderRoute();renderActions();renderCode();renderMetrics();setMode(state.mode||'route',false)}

function eventNorm(e){const r=els.fieldWrap.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
els.fieldWrap.addEventListener('pointerdown',e=>{if(state.mode!=='route'||e.target.closest('circle'))return;const p=eventNorm(e);active().points.push(p);dirty()});
els.fieldWrap.addEventListener('pointermove',e=>{const p=eventNorm(e);els.coords.textContent=`x: ${Math.round(p.x*state.calibration.widthMm)} mm • y: ${Math.round(p.y*state.calibration.heightMm)} mm`});
els.fieldWrap.addEventListener('pointerleave',()=>els.coords.textContent='x: — • y: —');
function enablePointDragging(){
  $$('#pointLayer circle').forEach(c=>{c.addEventListener('pointerdown',e=>{e.stopPropagation();const g=c.parentElement,idx=+g.dataset.index;c.setPointerCapture(e.pointerId);const move=ev=>{active().points[idx]=eventNorm(ev);renderRoute();renderMetrics()};const up=()=>{c.removeEventListener('pointermove',move);dirty()};c.addEventListener('pointermove',move);c.addEventListener('pointerup',up,{once:true})})});
}
function setMode(mode,rerender=true){state.mode=mode;$('#routeModeBtn').classList.toggle('active',mode==='route');$('#moveModeBtn').classList.toggle('active',mode==='move');if(rerender)renderRoute()}
$('#routeModeBtn').onclick=()=>setMode('route');$('#moveModeBtn').onclick=()=>setMode('move');
$('#undoPointBtn').onclick=()=>{active().points.pop();dirty()};$('#clearRouteBtn').onclick=()=>{if(confirm('Limpar todos os pontos desta rota?')){active().points=[];dirty()}};

function routeToActions(){
  const l=active(),pts=l.points||[];if(pts.length<2){toast('Crie pelo menos 2 pontos no campo.');return}
  const out=[];let heading=Number(l.heading)||0;
  for(let i=1;i<pts.length;i++){
    const dx=(pts[i].x-pts[i-1].x)*state.calibration.widthMm;
    const dy=(pts[i].y-pts[i-1].y)*state.calibration.heightMm;
    const target=Math.atan2(dy,dx)*180/Math.PI;
    const delta=normAngle(target-heading);
    if(Math.abs(delta)>1){out.push({type:'turn',deg:Math.round(Math.abs(delta)),side:delta>0?1:-1,vmax:350,vmin:15});heading=target}
    out.push({type:'drive',mm:Math.round(Math.hypot(dx,dy)),velocity:800});
  }
  if(l.actions.length && !confirm('Substituir a sequência atual pelas ações calculadas da rota?')) return;
  l.actions=out;dirty();toast('Ações geradas a partir da rota.');
}
$('#routeToActionsBtn').onclick=routeToActions;

els.launchName.oninput=e=>{active().name=e.target.value;dirty()};els.startSide.onchange=e=>{active().side=e.target.value;dirty()};els.startHeading.oninput=e=>{active().heading=+e.target.value||0;dirty()};els.width.oninput=e=>{state.calibration.widthMm=+e.target.value||2360;dirty()};els.height.oninput=e=>{state.calibration.heightMm=+e.target.value||1143;dirty()};
$('#newLaunchBtn').onclick=()=>{const id=uid();state.launches.push({id,name:`Lançamento ${state.launches.length+1}`,side:'custom',heading:0,points:[],actions:[]});state.activeId=id;dirty()};
$('#duplicateLaunchBtn').onclick=()=>{const l=active();const copy=JSON.parse(JSON.stringify(l));copy.id=uid();copy.name=l.name+' — cópia';state.launches.push(copy);state.activeId=copy.id;dirty()};

const defaults={
 drive:{type:'drive',mm:300,velocity:700},turn:{type:'turn',deg:45,side:1,vmax:350,vmin:15},
 motor:{type:'motor',port:'E',deg:90,velocity:500,stop:'BRAKE',accel:200,decel:200},motor_async:{type:'motor_async',port:'E',deg:90,velocity:500,stop:'BRAKE',accel:200,decel:200},
 wait:{type:'wait',ms:500},button:{type:'button',button:'RIGHT'}
};
$$('[data-add]').forEach(b=>b.onclick=()=>{active().actions.push({...defaults[b.dataset.add]});dirty();openActionDialog(active().actions.length-1)});
$('#clearActionsBtn').onclick=()=>{if(confirm('Limpar toda a sequência de ações?')){active().actions=[];dirty()}};

let editIndex=-1;
function fieldInput(name,label,value,type='number',extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function selectInput(name,label,value,options){return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${String(o)===String(value)?'selected':''}>${o}</option>`).join('')}</select></label>`}
function openActionDialog(i){
  editIndex=i;const a=active().actions[i];if(!a)return;const [title,sub]=actionLabel(a);els.dialogTitle.textContent=title;els.dialogSubtitle.textContent=sub;let html='';
  if(a.type==='drive') html=fieldInput('mm','Distância (mm)',a.mm)+fieldInput('velocity','Velocidade',a.velocity);
  if(a.type==='turn') html=fieldInput('deg','Ângulo (graus)',a.deg)+selectInput('side','Lado',a.side,[1,-1])+fieldInput('vmax','Velocidade máx.',a.vmax)+fieldInput('vmin','Velocidade mín.',a.vmin);
  if(a.type==='motor'||a.type==='motor_async') html=selectInput('port','Porta',a.port,['C','D','E','F'])+fieldInput('deg','Graus',a.deg)+fieldInput('velocity','Velocidade',a.velocity)+selectInput('stop','Parada',a.stop,['BRAKE','HOLD','COAST'])+fieldInput('accel','Aceleração',a.accel)+fieldInput('decel','Desaceleração',a.decel);
  if(a.type==='wait') html=fieldInput('ms','Tempo (ms)',a.ms);
  if(a.type==='button') html=selectInput('button','Botão',a.button,['LEFT','RIGHT']);
  els.dialogFields.innerHTML=html;els.dialog.showModal();
}
$('#actionForm').addEventListener('submit',e=>{e.preventDefault();const a=active().actions[editIndex],fd=new FormData(e.target);for(const [k,v] of fd.entries()){a[k]=['port','stop','button'].includes(k)?v:Number(v)}els.dialog.close();dirty()});
$('#deleteActionBtn').onclick=()=>{if(editIndex>=0){active().actions.splice(editIndex,1);els.dialog.close();dirty()}};

$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===t));$('#actionsTab').classList.toggle('active',t.dataset.tab==='actions');$('#codeTab').classList.toggle('active',t.dataset.tab==='code')});
$('#copyCodeBtn').onclick=async()=>{await navigator.clipboard.writeText(generateCode());toast('Código copiado.')};
$('#downloadCodeBtn').onclick=()=>{const blob=new Blob([generateCode()],{type:'text/x-python'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(active().name||'path-honey').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')+'.py';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)}

let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
renderAll();
