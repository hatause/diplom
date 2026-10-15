import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cloud, RotateCcw } from 'lucide-react';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { useAuthStore } from '@/store/auth.store';
import { cacheKey, normalizeProgress, payload, readCache } from './progress';
import './pc-lab.css';

export default function PcLabPage() {
 const user=useAuthStore(s=>s.user);
 const frame=useRef<HTMLIFrameElement>(null);
 const [status,setStatus]=useState('Загрузка прогресса…');
 const [score,setScore]=useState(0),[height,setHeight]=useState(950),[reload,setReload]=useState(0);
 const [conflict,setConflict]=useState(false);
 useEffect(()=>{
  setConflict(false);
  const key=cacheKey(user?.id),cached=readCache(key);
  let current=cached?.progress||normalizeProgress({}),dirty=cached?.dirty||false;
  let disposed=false,ready=false,loaded=false,posting=false,version=0,cloudReady=!user,blocked=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();
  function cache(){try{localStorage.setItem(key,JSON.stringify({progress:current,dirty}));}catch{setStatus('Хранилище браузера недоступно');}}
  function init(force=false){if(ready&&loaded)frame.current?.contentWindow?.postMessage({type:force?'pc-lab:restore':'pc-lab:init',progress:current},location.origin);}
  async function flush(){
   if(disposed||posting||!dirty||blocked)return;
   if(!user){setStatus('Сохранено на этом устройстве · Гость');return;}
   if(!cloudReady){await load();return;}
   posting=true;const sentVersion=version;
   setStatus('Сохранение…');
   try {
    const response=await api.post('/pc-lab/progress',payload(current),{signal:controller.signal});
    if(disposed)return;
    const server=normalizeProgress(response.data.data);
    current=sentVersion===version?server:{...current,revision:server.revision};
    dirty=sentVersion!==version;cache();setScore(current.total_score);setStatus(dirty?'Сохранение…':'Сохранено в профиле');
   } catch(e:any){
    if(disposed)return;
    if(e.response?.status===409){blocked=true;setConflict(true);}
    setStatus(errorText(e)+' Изменения сохранены в браузере.');
   } finally {posting=false;}
   if(dirty&&!blocked&&!disposed)timer=setTimeout(flush,3000);
  }
  async function load(){
   if(posting||disposed)return;
   let restore=false;
   if(user){
    try{
     const response=await api.get('/pc-lab/progress',{signal:controller.signal});
     if(disposed)return;
     const server=normalizeProgress(response.data.data);
     cloudReady=true;
     if(dirty&&current.revision!==server.revision){blocked=true;setConflict(true);setStatus('В другой вкладке сохранена новая версия. Локальный черновик сохранён.');}
     else if(!dirty){restore=loaded&&current.revision!==server.revision;current=server;cache();setStatus('Сохранено в профиле');}
    }catch(e){if(disposed)return;setStatus(errorText(e)+' Работа продолжится с сохранением в браузере.');}
   }else setStatus('Сохранено на этом устройстве · Гость');
   loaded=true;setScore(current.total_score);init(restore);
   if(dirty&&cloudReady&&!blocked)void flush();
  }
  function receive(event:MessageEvent){
   if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
   if(event.data?.type==='pc-lab:height'){const h=event.data.height;if(Number.isFinite(h)&&h>=400&&h<=6000)setHeight(Math.ceil(h));return;}
   if(event.data?.type==='pc-lab:ready'){ready=true;init();return;}
   if(event.data?.type==='pc-lab:progress'&&loaded){
    const next=normalizeProgress({...event.data.progress,revision:current.revision});
    if(JSON.stringify(payload(next))===JSON.stringify(payload(current)))return;
    current=next;dirty=true;version++;cache();setScore(current.total_score);
    clearTimeout(timer);timer=setTimeout(flush,350);
    setStatus(user?'Изменения сохранены в браузере…':'Сохранено на этом устройстве · Гость');
   }
  }
  const reconnect=()=>{void load();};
  window.addEventListener('message',receive);window.addEventListener('online',reconnect);
  void load();
  return ()=>{disposed=true;controller.abort();clearTimeout(timer);window.removeEventListener('message',receive);window.removeEventListener('online',reconnect);};
 },[user?.id,reload]);
 return <main className="pc-lab-page">
  <header className="pc-lab-toolbar"><Link to={user?'/dashboard':'/'}><ArrowLeft size={17}/> Вернуться на главную</Link><h1>3D-практикум · ПК и Windows</h1><div className="pc-lab-sync" data-saved={status==='Сохранено в профиле'} role="status"><Cloud size={17}/><span>{status} · <b>{score} / 100</b></span></div></header>
  <div className="pc-lab-intro"><p>Изучи 8 деталей, собери компьютер, обнови UEFI и установи Windows. Для полного результата отработай все четыре неисправности. Это учебная симуляция; команды выполняются только внутри стенда.</p>{!user&&<Link to="/login">Войти для сохранения в профиле →</Link>}
  {user&&!conflict&&<button className="button secondary" onClick={()=>setReload(n=>n+1)}><RotateCcw size={16}/> Переподключиться</button>}
  {conflict&&<button className="button secondary" title="Заменить локальный черновик сохранённой версией" onClick={()=>{try{localStorage.removeItem(cacheKey(user?.id));}catch{/* Cache can be unavailable in private browsing. */}setConflict(false);setReload(n=>n+1);}}><RotateCcw size={16}/> Загрузить версию с сервера</button>}
  <details><summary>Оценка и особенности учебного образа</summary><p>Разбор деталей — до 15 баллов. Сборка — 30, минус 2 за ошибку (минимум 15). BIOS — 20. Установка Windows с четырьмя решёнными неисправностями — 35. Зачтено от 80 баллов. «Разобрать заново» начинает новую попытку сборки.</p><p>LabConfig и OOBE\BYPASSNRO сохранены как сценарии старого установщика. Их наличие зависит от версии Windows: <a href="https://blogs.windows.com/windows-insider/2025/03/28/announcing-windows-11-insider-preview-build-26200-5516-dev-channel/" target="_blank" rel="noreferrer">Microsoft об удалении bypassnro.cmd</a>. <a href="https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-setup-installing-using-the-mbr-or-gpt-partition-style?view=windows-11" target="_blank" rel="noreferrer">Разметка UEFI/GPT</a>.</p></details></div>
  <iframe key={`${user?.id||'guest'}:${reload}`} ref={frame} onLoad={()=>frame.current?.contentWindow?.postMessage({type:'pc-lab:connect'},location.origin)} src="/pc-lab-assets/index.html" title="Интерактивный стенд сборки ПК и установки Windows" className="pc-lab-frame" style={{height}}/>
 </main>;
}
