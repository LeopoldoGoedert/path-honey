const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE_KEY = 'path-honey-v1';
const DEFAULT_WHEEL_DIAMETER_MM = 62.2;

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


const ROBOT_DEFAULTS = {
  widthMm:180,
  lengthMm:180,
  wheelDiameterMm:62.2,
  leftMotorPort:'A',
  rightMotorPort:'B',
  accessoryMotor1:'E',
  accessoryMotor2:'F',
  speedDriveSlow:300,
  speedDriveNormal:800,
  speedDriveFast:1050,
  speedTurnMax:350,
  speedTurnMin:15,
  speedAccessory:500
};
const MOTOR_PORTS=['A','B','C','D','E','F'];
function wheelCircumference(){return Math.PI*(Number(state?.robotConfig?.wheelDiameterMm)||DEFAULT_WHEEL_DIAMETER_MM);}

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
    activeId:'launch-1', mode:'route', zoom:1,
    calibration:{widthMm:2360,heightMm:1143},
    robotConfig:{...ROBOT_DEFAULTS},
    launches: presets.map((p,i)=>({
      id:`launch-${i+1}`,name:p.name,side:p.side,heading:0,points:[],
      actions:p.actions.map(actionFromArray),manualActions:[],autoOverrides:{}
    }))
  };
}
let state;
try{ state=JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState(); }catch{ state=defaultState(); }
if(!state.calibration) state.calibration={widthMm:2360,heightMm:1143};
state.robotConfig ||= {...ROBOT_DEFAULTS,
  widthMm:Number(state.calibration.robotWidthMm)||ROBOT_DEFAULTS.widthMm,
  lengthMm:Number(state.calibration.robotLengthMm)||ROBOT_DEFAULTS.lengthMm
};
state.robotConfig={...ROBOT_DEFAULTS,...state.robotConfig};
delete state.calibration.robotWidthMm;
delete state.calibration.robotLengthMm;
state.zoom = Number(state.zoom)||1;
state.launches ||= [];
state.launches.forEach(l=>{ l.points ||= []; l.actions ||= []; l.manualActions ||= []; l.autoOverrides ||= {}; });

const els={
  launchList:$('#launchList'),launchName:$('#launchName'),startSide:$('#startSide'),startHeading:$('#startHeading'),
  width:$('#fieldWidthMm'),height:$('#fieldHeightMm'),
  robotCfgWidth:$('#robotCfgWidthMm'),robotCfgLength:$('#robotCfgLengthMm'),wheelDiameter:$('#wheelDiameterMm'),wheelCircumferenceReadout:$('#wheelCircumferenceReadout'),
  leftMotorPort:$('#leftMotorPort'),rightMotorPort:$('#rightMotorPort'),accessoryMotor1:$('#accessoryMotor1'),accessoryMotor2:$('#accessoryMotor2'),
  speedDriveSlow:$('#speedDriveSlow'),speedDriveNormal:$('#speedDriveNormal'),speedDriveFast:$('#speedDriveFast'),speedTurnMax:$('#speedTurnMax'),speedTurnMin:$('#speedTurnMin'),speedAccessory:$('#speedAccessory'),
  routeLine:$('#routeLine'),pointLayer:$('#pointLayer'),segmentLayer:$('#segmentLayer'),fieldWrap:$('#fieldWrap'),fieldCanvas:$('#fieldCanvas'),
  robotLayer:$('#robotLayer'),robotBody:$('#robotBody'),manualAnchor:$('#manualAnchorSelect'),
  actionList:$('#actionList'),code:$('#codePreview'),distance:$('#distanceMetric'),actions:$('#actionsMetric'),time:$('#timeMetric'),margin:$('#marginMetric'),
  save:$('#saveState'),coords:$('#cursorCoords'),dialog:$('#actionDialog'),dialogFields:$('#dialogFields'),dialogTitle:$('#dialogTitle'),dialogSubtitle:$('#dialogSubtitle'),
  zoomLabel:$('#zoomLabel'),simulateBtn:$('#simulateBtn')
};
function active(){return state.launches.find(x=>x.id===state.activeId) || state.launches[0];}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));els.save.textContent='salvo localmente';renderAll();}
function dirty(){els.save.textContent='salvando…';clearTimeout(dirty.t);dirty.t=setTimeout(save,120)}
function uid(){return 'launch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function normAngle(d){while(d>180)d-=360;while(d<-180)d+=360;return d;}
function num(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*100)/100):'0'}

function routeSegments(launch=active()){
  const pts=launch.points||[]; const segs=[]; let heading=Number(launch.heading)||0;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    const dx=(b.x-a.x)*state.calibration.widthMm;
    const dy=(b.y-a.y)*state.calibration.heightMm;
    const target=Math.atan2(dy,dx)*180/Math.PI;
    const delta=normAngle(target-heading);
    segs.push({index:i,a,b,dx,dy,mm:Math.hypot(dx,dy),target,delta,headingBefore:heading});
    heading=target;
  }
  return segs;
}
function rawAutoAction(routeSegment,routePart,launch=active()){
  const seg=routeSegments(launch).find(s=>s.index===Number(routeSegment));
  if(!seg) return null;
  if(routePart==='turn') return {type:'turn',deg:Math.round(Math.abs(seg.delta)),side:seg.delta>0?1:-1,vmax:Number(state.robotConfig.speedTurnMax),vmin:Number(state.robotConfig.speedTurnMin),_auto:true,routeSegment:seg.index,routePart:'turn'};
  return {type:'drive',mm:Math.round(seg.mm),velocity:Number(state.robotConfig.speedDriveNormal),_auto:true,routeSegment:seg.index,routePart:'drive'};
}
function calcRouteActions(launch=active()){
  const out=[];
  routeSegments(launch).forEach(seg=>{
    if(Math.abs(seg.delta)>1) out.push(applyAutoOverride(rawAutoAction(seg.index,'turn',launch), launch));
    out.push(applyAutoOverride(rawAutoAction(seg.index,'drive',launch), launch));
  });
  return out;
}
function manualForAnchor(launch,anchor){return (launch.manualActions||[]).filter(a=>(Number(a.afterSegment)||0)===anchor);}
function combinedActions(launch=active()){
  const segs=routeSegments(launch);
  if(!segs.length){
    const legacy=(launch.actions||[]).map((a,i)=>({...a,_legacy:true,_sourceIndex:i}));
    const manual=(launch.manualActions||[]).map((a,i)=>({...a,_manual:true,_sourceIndex:i}));
    return [...legacy,...manual];
  }
  const autos=calcRouteActions(launch); const out=[];
  manualForAnchor(launch,0).forEach(a=>out.push({...a,_manual:true,_sourceIndex:launch.manualActions.indexOf(a)}));
  for(let seg=1;seg<=segs.length;seg++){
    autos.filter(a=>a.routeSegment===seg).forEach(a=>out.push(a));
    manualForAnchor(launch,seg).forEach(a=>out.push({...a,_manual:true,_sourceIndex:launch.manualActions.indexOf(a)}));
  }
  return out;
}


function autoKey(seg,part){return `seg-${seg}-${part}`;}
function applyAutoOverride(base,launch=active()){
  const key=autoKey(base.routeSegment, base.routePart);
  const override=(launch.autoOverrides||{})[key]||{};
  return {...base, ...override, _auto:true, routeSegment:base.routeSegment, routePart:base.routePart};
}

function renderLaunches(){
  els.launchList.innerHTML=state.launches.map(l=>`<div class="launch-item ${l.id===state.activeId?'active':''}" data-id="${l.id}"><strong>${esc(l.name)}</strong><span>${combinedActions(l).length} ações • ${l.points.length} pontos</span></div>`).join('');
  $$('.launch-item').forEach(x=>x.onclick=()=>{state.activeId=x.dataset.id;stopSimulation();renderAll();dirty()});
}
function renderConfig(){
  const l=active();
  els.launchName.value=l.name;els.startSide.value=l.side||'custom';els.startHeading.value=l.heading??0;
  els.width.value=state.calibration.widthMm;els.height.value=state.calibration.heightMm;

}
function pointToSvg(p){return {x:p.x*1000,y:p.y*500};}
function renderRoute(){
  const l=active(); const pts=l.points||[];
  els.routeLine.setAttribute('points',pts.map(p=>{const q=pointToSvg(p);return `${q.x},${q.y}`}).join(' '));
  els.pointLayer.innerHTML=pts.map((p,i)=>{const q=pointToSvg(p);return `<g data-index="${i}"><circle class="${i===0?'start-point':'route-point'}" cx="${q.x}" cy="${q.y}" r="9"></circle><text x="${q.x+12}" y="${q.y-12}">${i+1}</text></g>`}).join('');
  els.segmentLayer.innerHTML=routeSegments(l).map(seg=>{
    const a=pointToSvg(seg.a),b=pointToSvg(seg.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    return `<text class="segment-label" x="${x+8}" y="${y-8}">${seg.index}: ${Math.round(seg.mm)} mm</text>`;
  }).join('');
  if(state.mode==='move') enablePointDragging();
  renderRobotAtStart();
}
function routeDistance(){return routeSegments().reduce((s,x)=>s+x.mm,0)}
function actionTime(a){
  if(a.type==='drive'){const v=Math.max(1,Math.abs(+a.velocity||500));const mmps=v/360*wheelCircumference();return Math.abs(+a.mm||0)/Math.max(1,mmps)*1.12+.08;}
  if(a.type==='turn') return Math.abs(+a.deg||0)*.010+.12;
  if(a.type==='motor'||a.type==='motor_async'){if(a.type==='motor_async') return .10;return Math.abs(+a.deg||0)/Math.max(1,Math.abs(+a.velocity||500))+.10;}
  if(a.type==='wait') return (+a.ms||0)/1000;
  if(a.type==='button') return 0;
  return 0;
}
function totalTime(){return combinedActions().reduce((s,a)=>s+actionTime(a),0)}
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
  const list=combinedActions();
  els.actionList.innerHTML=list.map((a,i)=>{
    const [title,sub]=actionLabel(a); const kind=a._auto?'auto':(a._manual?'manual':'manual');
    const badge=a._auto?'ROTA':(a._legacy?'LEGADO':'MANUAL');
    return `<div class="action-card ${kind}-action" data-index="${i}" data-editable="1"><div class="action-num">${i+1}</div><div class="action-main"><strong>${title}<span class="action-badge ${kind}">${badge}</span></strong><span>${esc(sub)}${a._auto?` • trecho ${a.routeSegment}`:(a._manual?` • após trecho ${a.afterSegment||0}`:'')}</span></div><div class="action-time">~${actionTime(a).toFixed(1)}s</div></div>`;
  }).join('') || '<p class="hint">Nenhuma ação. Desenhe uma rota ou adicione uma ação manual.</p>';
  $$('.action-card[data-editable="1"]').forEach(c=>c.onclick=()=>{
    const a=list[+c.dataset.index];
    if(a._auto) openAutoActionDialog(a);
    else if(a._manual) openManualActionDialog(a._sourceIndex);
    else if(a._legacy) openLegacyActionDialog(a._sourceIndex);
  });
}
function renderManualAnchor(){
  const n=routeSegments().length; let html='';
  if(!n) html='<option value="0">Sequência livre</option>';
  else{
    html='<option value="0">Antes do trecho 1</option>';
    for(let i=1;i<=n;i++) html+=`<option value="${i}">Depois do trecho ${i}</option>`;
  }
  const old=Number(els.manualAnchor.value);
  els.manualAnchor.innerHTML=html;
  els.manualAnchor.value=String(Number.isFinite(old)&&old<=n?old:n);
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
function configuredFunctionLibrary(){
  const r=state.robotConfig;
  const circumference=wheelCircumference().toFixed(9).replace(/0+$/,'').replace(/\.$/,'');
  return functionLibrary
    .replaceAll('port.A','__PATH_HONEY_LEFT__')
    .replaceAll('port.B','__PATH_HONEY_RIGHT__')
    .replaceAll('__PATH_HONEY_LEFT__',`port.${r.leftMotorPort}`)
    .replaceAll('__PATH_HONEY_RIGHT__',`port.${r.rightMotorPort}`)
    .replaceAll('195.407063053',circumference);
}
function generateCode(){const body=combinedActions().map(actionCode).filter(Boolean).join('\n');return `${configuredFunctionLibrary()}\nasync def main():\n${body||'    pass'}\n\nrunloop.run(main())\n`;}
function renderCode(){els.code.textContent=generateCode();}
function renderMetrics(){const d=routeDistance(),t=totalTime(),m=150-t;els.distance.textContent=`${Math.round(d)} mm`;els.actions.textContent=combinedActions().length;els.time.textContent=`${t.toFixed(1)} s`;els.margin.textContent=`${m.toFixed(1)} s`;els.margin.closest('.metric').classList.toggle('warning',m<0)}
function applyZoom(){state.zoom=clamp(Number(state.zoom)||1,.75,2.5);els.fieldCanvas.style.transform=`scale(${state.zoom})`;els.zoomLabel.textContent=`${Math.round(state.zoom*100)}%`;}

function portOptions(select,value){
  select.innerHTML=MOTOR_PORTS.map(p=>`<option value="${p}" ${p===value?'selected':''}>${p}</option>`).join('');
}
function renderRobotConfig(){
  const r=state.robotConfig;
  els.robotCfgWidth.value=r.widthMm;els.robotCfgLength.value=r.lengthMm;els.wheelDiameter.value=r.wheelDiameterMm;
  portOptions(els.leftMotorPort,r.leftMotorPort);portOptions(els.rightMotorPort,r.rightMotorPort);portOptions(els.accessoryMotor1,r.accessoryMotor1);portOptions(els.accessoryMotor2,r.accessoryMotor2);
  els.speedDriveSlow.value=r.speedDriveSlow;els.speedDriveNormal.value=r.speedDriveNormal;els.speedDriveFast.value=r.speedDriveFast;els.speedTurnMax.value=r.speedTurnMax;els.speedTurnMin.value=r.speedTurnMin;els.speedAccessory.value=r.speedAccessory;
  els.wheelCircumferenceReadout.textContent=`${wheelCircumference().toFixed(1)} mm`;
}
function setRobotConfigNumber(key,value,fallback){state.robotConfig[key]=Number(value)||fallback;dirty();}
function bindRobotConfig(){
  els.robotCfgWidth.oninput=e=>setRobotConfigNumber('widthMm',e.target.value,ROBOT_DEFAULTS.widthMm);
  els.robotCfgLength.oninput=e=>setRobotConfigNumber('lengthMm',e.target.value,ROBOT_DEFAULTS.lengthMm);
  els.wheelDiameter.oninput=e=>setRobotConfigNumber('wheelDiameterMm',e.target.value,ROBOT_DEFAULTS.wheelDiameterMm);
  els.leftMotorPort.onchange=e=>{state.robotConfig.leftMotorPort=e.target.value;dirty()};
  els.rightMotorPort.onchange=e=>{state.robotConfig.rightMotorPort=e.target.value;dirty()};
  els.accessoryMotor1.onchange=e=>{state.robotConfig.accessoryMotor1=e.target.value;dirty()};
  els.accessoryMotor2.onchange=e=>{state.robotConfig.accessoryMotor2=e.target.value;dirty()};
  els.speedDriveSlow.oninput=e=>setRobotConfigNumber('speedDriveSlow',e.target.value,ROBOT_DEFAULTS.speedDriveSlow);
  els.speedDriveNormal.oninput=e=>setRobotConfigNumber('speedDriveNormal',e.target.value,ROBOT_DEFAULTS.speedDriveNormal);
  els.speedDriveFast.oninput=e=>setRobotConfigNumber('speedDriveFast',e.target.value,ROBOT_DEFAULTS.speedDriveFast);
  els.speedTurnMax.oninput=e=>setRobotConfigNumber('speedTurnMax',e.target.value,ROBOT_DEFAULTS.speedTurnMax);
  els.speedTurnMin.oninput=e=>setRobotConfigNumber('speedTurnMin',e.target.value,ROBOT_DEFAULTS.speedTurnMin);
  els.speedAccessory.oninput=e=>setRobotConfigNumber('speedAccessory',e.target.value,ROBOT_DEFAULTS.speedAccessory);
  $('#resetRobotConfigBtn').onclick=()=>{if(confirm('Restaurar as configurações padrão do robô?')){state.robotConfig={...ROBOT_DEFAULTS};dirty();toast('Configuração do robô restaurada.')}};
}

function renderAll(){if(!state.launches.length)state=defaultState();renderLaunches();renderConfig();renderRobotConfig();renderRoute();renderManualAnchor();renderActions();renderCode();renderMetrics();setMode(state.mode||'route',false);applyZoom();}

function eventNorm(e){const r=els.fieldCanvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
function nearestSegmentPoint(p){
  const pts=active().points||[]; if(pts.length<2) return null;
  let best=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1],vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y;
    const den=vx*vx+vy*vy||1; const t=clamp((wx*vx+wy*vy)/den,0,1);
    const q={x:a.x+t*vx,y:a.y+t*vy};
    const dx=(p.x-q.x)*state.calibration.widthMm,dy=(p.y-q.y)*state.calibration.heightMm;
    const dist=Math.hypot(dx,dy);
    if(!best||dist<best.dist) best={index:i,point:q,dist};
  }
  return best;
}
els.fieldWrap.addEventListener('pointerdown',e=>{
  if(e.target.closest('circle'))return;
  const p=eventNorm(e);
  if(state.mode==='route'){active().points.push(p);dirty();return;}
  if(state.mode==='insert'){
    const hit=nearestSegmentPoint(p);if(!hit){toast('Crie primeiro uma rota com pelo menos 2 pontos.');return}
    active().points.splice(hit.index+1,0,hit.point);dirty();toast(`Ponto inserido entre ${hit.index+1} e ${hit.index+2}.`);
  }
});
els.fieldWrap.addEventListener('pointermove',e=>{const p=eventNorm(e);els.coords.textContent=`x: ${Math.round(p.x*state.calibration.widthMm)} mm • y: ${Math.round(p.y*state.calibration.heightMm)} mm`});
els.fieldWrap.addEventListener('pointerleave',()=>els.coords.textContent='x: — • y: —');
function enablePointDragging(){
  $$('#pointLayer circle').forEach(c=>c.addEventListener('pointerdown',e=>{
    e.stopPropagation();const idx=+c.parentElement.dataset.index;c.setPointerCapture(e.pointerId);
    const move=ev=>{active().points[idx]=eventNorm(ev);renderRoute();renderManualAnchor();renderActions();renderCode();renderMetrics();};
    const up=()=>{c.removeEventListener('pointermove',move);dirty()};
    c.addEventListener('pointermove',move);c.addEventListener('pointerup',up,{once:true});
  }));
}
function setMode(mode,rerender=true){state.mode=mode;$('#routeModeBtn').classList.toggle('active',mode==='route');$('#moveModeBtn').classList.toggle('active',mode==='move');$('#insertPointBtn').classList.toggle('active',mode==='insert');if(rerender)renderRoute();}
$('#routeModeBtn').onclick=()=>setMode('route');$('#moveModeBtn').onclick=()=>setMode('move');$('#insertPointBtn').onclick=()=>setMode('insert');
$('#undoPointBtn').onclick=()=>{active().points.pop();dirty()};
$('#clearRouteBtn').onclick=()=>{if(confirm('Limpar todos os pontos desta rota?')){active().points=[];dirty()}};

$('#zoomInBtn').onclick=()=>{state.zoom+=.25;applyZoom();dirty()};
$('#zoomOutBtn').onclick=()=>{state.zoom-=.25;applyZoom();dirty()};
$('#zoomResetBtn').onclick=()=>{state.zoom=1;applyZoom();dirty()};
els.fieldWrap.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();state.zoom+=e.deltaY<0?.1:-.1;applyZoom();dirty()},{passive:false});

els.launchName.oninput=e=>{active().name=e.target.value;dirty()};
els.startSide.onchange=e=>{active().side=e.target.value;dirty()};
els.startHeading.oninput=e=>{active().heading=+e.target.value||0;dirty()};
els.width.oninput=e=>{state.calibration.widthMm=+e.target.value||2360;dirty()};
els.height.oninput=e=>{state.calibration.heightMm=+e.target.value||1143;dirty()};
$('#newLaunchBtn').onclick=()=>{const id=uid();state.launches.push({id,name:`Lançamento ${state.launches.length+1}`,side:'custom',heading:0,points:[],actions:[],manualActions:[]});state.activeId=id;dirty()};
$('#duplicateLaunchBtn').onclick=()=>{const l=active();const copy=JSON.parse(JSON.stringify(l));copy.id=uid();copy.name=l.name+' — cópia';state.launches.push(copy);state.activeId=copy.id;dirty()};

function actionDefault(type){
  const r=state.robotConfig;
  const defaults={
    drive:{type:'drive',mm:300,velocity:Number(r.speedDriveNormal)},
    turn:{type:'turn',deg:45,side:1,vmax:Number(r.speedTurnMax),vmin:Number(r.speedTurnMin)},
    motor:{type:'motor',port:r.accessoryMotor1,deg:90,velocity:Number(r.speedAccessory),stop:'BRAKE',accel:200,decel:200},
    motor_async:{type:'motor_async',port:r.accessoryMotor1,deg:90,velocity:Number(r.speedAccessory),stop:'BRAKE',accel:200,decel:200},
    wait:{type:'wait',ms:500},button:{type:'button',button:'RIGHT'}
  };
  return defaults[type];
}
$$('[data-add]').forEach(b=>b.onclick=()=>{
  const a={...actionDefault(b.dataset.add),afterSegment:Number(els.manualAnchor.value)||0};
  active().manualActions.push(a);dirty();openManualActionDialog(active().manualActions.length-1);
});
$('#clearActionsBtn').onclick=()=>{
  if(routeSegments().length){if(confirm('Limpar somente as ações MANUAIS? As ações da rota continuarão sendo geradas pelos pontos.')){active().manualActions=[];dirty()}}
  else if(confirm('Limpar toda a sequência de ações?')){active().actions=[];active().manualActions=[];dirty()}
};

let editKind='manual',editIndex=-1,editAutoMeta=null;
function fieldInput(name,label,value,type='number',extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function selectInput(name,label,value,options){return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${String(o)===String(value)?'selected':''}>${o}</option>`).join('')}</select></label>`}
function dialogFieldsFor(a){
  let html='';
  if(a.type==='drive') html=fieldInput('mm','Distância (mm)',a.mm)+fieldInput('velocity','Velocidade',a.velocity);
  if(a.type==='turn') html=fieldInput('deg','Ângulo (graus)',a.deg)+selectInput('side','Lado',a.side,[1,-1])+fieldInput('vmax','Velocidade máx.',a.vmax)+fieldInput('vmin','Velocidade mín.',a.vmin);
  if(a.type==='motor'||a.type==='motor_async') html=selectInput('port','Porta',a.port,MOTOR_PORTS)+fieldInput('deg','Graus',a.deg)+fieldInput('velocity','Velocidade',a.velocity)+selectInput('stop','Parada',a.stop,['BRAKE','HOLD','COAST'])+fieldInput('accel','Aceleração',a.accel)+fieldInput('decel','Desaceleração',a.decel);
  if(a.type==='wait') html=fieldInput('ms','Tempo (ms)',a.ms);
  if(a.type==='button') html=selectInput('button','Botão',a.button,['LEFT','RIGHT']);
  return html;
}
function openManualActionDialog(i){editKind='manual';editIndex=i;editAutoMeta=null;const a=active().manualActions[i];if(!a)return;const [title,sub]=actionLabel(a);els.dialogTitle.textContent=title+' — MANUAL';els.dialogSubtitle.textContent=sub;els.dialogFields.innerHTML=dialogFieldsFor(a)+selectInput('afterSegment','Inserir depois do trecho',a.afterSegment||0,[...Array(routeSegments().length+1).keys()]);$('#deleteActionBtn').textContent='Excluir';$('#deleteActionBtn').classList.remove('hidden');els.dialog.showModal();}
function openLegacyActionDialog(i){editKind='legacy';editIndex=i;editAutoMeta=null;const a=active().actions[i];if(!a)return;const [title,sub]=actionLabel(a);els.dialogTitle.textContent=title+' — LEGADO';els.dialogSubtitle.textContent=sub;els.dialogFields.innerHTML=dialogFieldsFor(a);$('#deleteActionBtn').textContent='Excluir';$('#deleteActionBtn').classList.remove('hidden');els.dialog.showModal();}
function openAutoActionDialog(a){editKind='auto';editIndex=-1;editAutoMeta={routeSegment:a.routeSegment,routePart:a.routePart,type:a.type};const [title,sub]=actionLabel(a);els.dialogTitle.textContent=title+' — ROTA';els.dialogSubtitle.textContent=sub+' • Você pode editar os parâmetros desta ação sem alterar os pontos do tapete.';els.dialogFields.innerHTML=dialogFieldsFor(a);$('#deleteActionBtn').textContent='Resetar';$('#deleteActionBtn').classList.remove('hidden');els.dialog.showModal();}
$('#actionForm').addEventListener('submit',e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  if(editKind==='auto'){
    const key=autoKey(editAutoMeta.routeSegment, editAutoMeta.routePart);
    const base=rawAutoAction(editAutoMeta.routeSegment, editAutoMeta.routePart, active()) || {type:editAutoMeta.type};
    const override={};
    for(const [k,v] of fd.entries()) override[k]=['port','stop','button'].includes(k)?v:Number(v);
    const cleaned={};
    Object.keys(override).forEach(k=>{ if(String(override[k])!==String(base[k])) cleaned[k]=override[k]; });
    active().autoOverrides ||= {};
    if(Object.keys(cleaned).length) active().autoOverrides[key]=cleaned; else delete active().autoOverrides[key];
  } else {
    const list=editKind==='manual'?active().manualActions:active().actions;
    const a=list[editIndex];
    for(const [k,v] of fd.entries()) a[k]=['port','stop','button'].includes(k)?v:Number(v);
  }
  els.dialog.close();dirty();
});
$('#deleteActionBtn').onclick=()=>{
  if(editKind==='auto'){
    if(editAutoMeta){ const key=autoKey(editAutoMeta.routeSegment, editAutoMeta.routePart); delete (active().autoOverrides||{})[key]; els.dialog.close(); dirty(); }
    return;
  }
  const list=editKind==='manual'?active().manualActions:active().actions;
  if(editIndex>=0){list.splice(editIndex,1);els.dialog.close();dirty()}
};

$$('.tab').forEach(t=>t.onclick=()=>{
  $$('.tab').forEach(x=>x.classList.toggle('active',x===t));
  $('#actionsTab').classList.toggle('active',t.dataset.tab==='actions');
  $('#codeTab').classList.toggle('active',t.dataset.tab==='code');
  $('#robotTab').classList.toggle('active',t.dataset.tab==='robot');
});
$('#copyCodeBtn').onclick=async()=>{await navigator.clipboard.writeText(generateCode());toast('Código copiado.')};
$('#downloadCodeBtn').onclick=()=>{const blob=new Blob([generateCode()],{type:'text/x-python'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(active().name||'path-honey').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')+'.py';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)}

function robotSvgSize(){
  return {w:state.robotConfig.widthMm/state.calibration.widthMm*1000,h:state.robotConfig.lengthMm/state.calibration.heightMm*500};
}
function setRobotPose(p,heading){
  if(!p){els.robotLayer.style.display='none';return}
  els.robotLayer.style.display='';const q=pointToSvg(p),s=robotSvgSize();
  els.robotBody.setAttribute('x',-s.w/2);els.robotBody.setAttribute('y',-s.h/2);els.robotBody.setAttribute('width',s.w);els.robotBody.setAttribute('height',s.h);
  els.robotLayer.setAttribute('transform',`translate(${q.x} ${q.y}) rotate(${heading+90})`);
}
function renderRobotAtStart(){const pts=active().points||[];if(!simulationRunning)setRobotPose(pts[0],Number(active().heading)||0)}
let simulationRunning=false,simulationToken=0;
function rafAnim(ms,fn,token){return new Promise(resolve=>{const st=performance.now();function step(now){if(token!==simulationToken)return resolve(false);const t=clamp((now-st)/Math.max(ms,1),0,1);fn(t);if(t<1)requestAnimationFrame(step);else resolve(true)}requestAnimationFrame(step)})}
function highlightActionBySegment(seg){$$('.action-card').forEach(c=>c.classList.remove('sim-active'));const list=combinedActions();const idx=list.findIndex(a=>a._auto&&a.routeSegment===seg&&a.routePart==='drive');if(idx>=0){const c=$(`.action-card[data-index="${idx}"]`);if(c)c.classList.add('sim-active')}}
async function simulate(){
  const segs=routeSegments();if(!segs.length){toast('Crie uma rota com pelo menos 2 pontos.');return}
  if(simulationRunning){stopSimulation();return}
  simulationRunning=true;simulationToken++;const token=simulationToken;els.fieldWrap.classList.add('simulating');els.simulateBtn.textContent='⏹ Parar';
  let pos=segs[0].a,heading=Number(active().heading)||0;setRobotPose(pos,heading);
  for(const seg of segs){
    if(token!==simulationToken)break;highlightActionBySegment(seg.index);
    const delta=normAngle(seg.target-heading),h0=heading;
    if(Math.abs(delta)>1) await rafAnim(clamp(Math.abs(delta)*8,180,800),t=>setRobotPose(pos,h0+delta*t),token);
    heading=seg.target;const p0=seg.a,p1=seg.b;
    const drive={type:'drive',mm:seg.mm,velocity:800};
    const ok=await rafAnim(clamp(actionTime(drive)*650,350,2200),t=>{pos={x:p0.x+(p1.x-p0.x)*t,y:p0.y+(p1.y-p0.y)*t};setRobotPose(pos,heading)},token);if(!ok)break;
    for(const a of manualForAnchor(active(),seg.index)){
      if(token!==simulationToken)break;
      const ms=a.type==='wait'?clamp(+a.ms||0,100,1500):300;
      await rafAnim(ms,()=>setRobotPose(pos,heading),token);
    }
  }
  if(token===simulationToken){simulationRunning=false;els.fieldWrap.classList.remove('simulating');els.simulateBtn.textContent='▶ Simular';$$('.action-card').forEach(c=>c.classList.remove('sim-active'));toast('Simulação concluída.');}
}
function stopSimulation(){if(!simulationRunning)return;simulationToken++;simulationRunning=false;els.fieldWrap.classList.remove('simulating');els.simulateBtn.textContent='▶ Simular';$$('.action-card').forEach(c=>c.classList.remove('sim-active'));renderRobotAtStart();}
els.simulateBtn.onclick=simulate;

const fieldImage=$('#fieldImage');
fieldImage.addEventListener('error',()=>{if(!fieldImage.dataset.fallback){fieldImage.dataset.fallback='1';fieldImage.src='assets/bioglow-campo-web.jpg';toast('Carregando imagem alternativa do campo…')}else toast('A imagem do campo não pôde ser carregada.')});

let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker' in navigator) window.addEventListener('load',async()=>{
  try{
    const reg=await navigator.serviceWorker.register('sw.js');
    await reg.update();
  }catch{}
});
bindRobotConfig();
renderAll();
