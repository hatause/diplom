export const PARTS = ['part-cpu','part-gpu','part-mobo','part-ram','part-ssd','part-psu','part-cooler','pc-case'];
export const SLOTS = ['part-psu','part-mobo','part-cpu','part-ram','part-ssd','part-cooler','part-gpu','case-glass-panel'];
export const FAULTS = ['TPM_BYPASS','INTEL_VMD_DRIVER','MBR_TO_GPT_DISKPART','OOBE_BYPASSNRO','INSUFFICIENT_SPACE','BOOT_ORDER'];
export interface Progress {
 inspected_parts:string[]; inspected_parts_count:number; assembly_completed:boolean; assembly_mistakes:number;
 bios_flashed:boolean; windows_installed:boolean; resolved_faults:string[]; system_drive_gb:number;
 total_score:number; revision:number; updated_at:string|null; completed_at:string|null;
 resume:{curriculum_version:1|2;quiz_answers:Record<string,number>;quiz_mistakes:number;diagnostic_mistakes:number;language:string;region:string;keyboard:string;mode:string;installed:string[];win_step:number;edition:string;faults:string[];drivers:string[]};
}
const pick=(value:unknown,allowed:string[])=>Array.isArray(value)?[...new Set(value.filter((x):x is string=>typeof x==='string'&&allowed.includes(x)))]:[];
const integer=(value:unknown,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
export function normalizeProgress(raw:unknown):Progress {
 const d=(raw&&typeof raw==='object'?raw:{}) as Partial<Progress>;
 const r=d.resume||{} as Progress['resume'];
 const inspected=pick(d.inspected_parts,PARTS),faults=pick(d.resolved_faults,FAULTS);
 const version=r.curriculum_version===2||!d.resume?2:1;
 const quizKey:Record<string,number>={backup:1,uefi:2,efi:0,driver:1};
 const answers=Object.fromEntries(Object.keys(quizKey).filter(k=>[0,1,2].includes(r.quiz_answers?.[k])).map(k=>[k,r.quiz_answers[k]]));
 const windowsDone=d.windows_installed===true&&(version===1?FAULTS.slice(0,4):FAULTS).every(f=>faults.includes(f))&&(version===1||Object.entries(quizKey).every(([k,v])=>answers[k]===v));
 const mistakes=integer(d.assembly_mistakes,0,10000,0);
 return {inspected_parts:inspected,inspected_parts_count:inspected.length,assembly_completed:d.assembly_completed===true,
 assembly_mistakes:mistakes,bios_flashed:d.bios_flashed===true,windows_installed:d.windows_installed===true,
 resolved_faults:faults,system_drive_gb:integer(d.system_drive_gb,100,450,200),
 total_score:Math.floor(15*inspected.length/8)+(d.assembly_completed===true?Math.max(15,30-2*mistakes):0)+(d.bios_flashed===true?20:0)+(windowsDone?35:0),
 revision:integer(d.revision,0,2147483647,0),updated_at:d.updated_at||null,completed_at:d.completed_at||null,
 resume:{curriculum_version:version,quiz_answers:answers,quiz_mistakes:integer(r.quiz_mistakes,0,10000,0),diagnostic_mistakes:integer(r.diagnostic_mistakes,0,10000,0),language:r.language==='en-US'?'en-US':'ru-RU',region:r.region==='RU'?'RU':'KZ',keyboard:r.keyboard==='us'?'us':'ru',mode:['partlab','explore','builder','bios','windows'].includes(r.mode)?r.mode:'partlab',installed:pick(r.installed,SLOTS),
 win_step:integer(r.win_step,1,5,1),edition:['Windows 11 Pro (x64)','Windows 11 Education (x64)','Windows 11 Home (x64)'].includes(r.edition)?r.edition:'Windows 11 Pro (x64)',
 faults:Array.isArray(r.faults)?pick(r.faults,FAULTS):[...FAULTS],drivers:pick(r.drivers,['chipset','gpu','network'])}};
}
export function payload(p:Progress) {
 return {revision:p.revision,inspected_parts:p.inspected_parts,assembly_completed:p.assembly_completed,
 assembly_mistakes:p.assembly_mistakes,bios_flashed:p.bios_flashed,windows_installed:p.windows_installed,
 resolved_faults:p.resolved_faults,system_drive_gb:p.system_drive_gb,resume:p.resume};
}
export const cacheKey=(userId?:string)=>'aitutor-pc-lab-v1:'+(userId||'guest');
export function readCache(key:string):{progress:Progress;dirty:boolean}|null {
 try {const item=JSON.parse(localStorage.getItem(key)||'null');return item?{progress:normalizeProgress(item.progress),dirty:item.dirty===true}:null;} catch {return null;}
}
