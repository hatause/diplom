import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, ArrowUpRight } from 'lucide-react';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { normalizeProgress, Progress } from './progress';
import './pc-lab.css';
export function PcLabCard({preview=false}:{preview?:boolean}) {
 const user=useAuthStore(s=>s.user);
 const [progress,setProgress]=useState<Progress|null>(null),[error,setError]=useState(false);
 useEffect(()=>{if(!user||preview)return;const controller=new AbortController();api.get('/pc-lab/progress',{signal:controller.signal}).then(r=>setProgress(normalizeProgress(r.data.data))).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[user?.id,preview]);
 return <section className="pc-lab-card"><div className="pc-lab-card-art" aria-hidden="true"><Monitor size={54}/><span>ПК → UEFI → ОС</span></div><div className="pc-lab-card-content"><span className="eyebrow">ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ</span><h2>{preview?'Собери компьютер. Запусти Windows.':'Результаты 3D-практикума: Архитектура ПК и ОС'}</h2><p>Послойные модели 8 узлов, сборка ПК, прошивка UEFI BIOS и установка Windows 11 с диагностикой ошибок.</p>
 {progress&&<><div className="pc-lab-score"><strong>{progress.total_score} / 100 баллов</strong><span>{progress.total_score>=80?'Зачтено':'В процессе'}</span></div><progress max={100} value={progress.total_score} aria-label="Результат практикума"/><ul><li>{progress.inspected_parts_count===8?'✓':'○'} Разбор узлов: {progress.inspected_parts_count} / 8</li><li>{progress.assembly_completed?'✓':'○'} Сборка ПК · ошибок: {progress.assembly_mistakes}</li><li>{progress.bios_flashed?'✓':'○'} BIOS v2.40</li><li>{progress.windows_installed?'✓':'○'} Windows · решено TPM/VMD/GPT/OOBE: {progress.resolved_faults.length} / 4</li></ul></>}
 {error&&<p role="status">Не удалось загрузить результат. Открой практикум для повторного подключения.</p>}
 <Link className="button primary" to="/pc-lab">{progress&&progress.total_score>0?'Продолжить / улучшить результат':'Открыть 3D-тренажёр ПК и ОС'}<ArrowUpRight size={17}/></Link></div></section>;
}
