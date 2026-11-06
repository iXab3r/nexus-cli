import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, resolve } from 'node:path';
import { CliError, HttpError, command, Permission, recordView, readResponseBody, diagnosticCause, fetchWithRedirects, type CommandContext } from '@eyeauras/cli-factory';
import { authorization, checked, pathSegment } from './client.js';
const usage = (message:string):never => {throw new CliError(message,{code:'usage',exitCode:2});};
/** Mutate once; a failed transport cannot establish whether Nexus committed. */
async function mutate(c:CommandContext,path:string,method:string,body?:FormData) {
 const raw=c.profile.values.authMode==='anonymous'?undefined:await c.secrets.require('credentials');
 const headers:Record<string,string>={Accept:'application/json'};if(raw) headers.Authorization=authorization(raw);
 let response:Response;
 try {response=await fetchWithRedirects(c.fetch,String(c.profile.values.url).replace(/\/$/,'')+'/service/rest/v1/'+path,{method,headers,body,signal:c.signal});}
 catch(cause){throw new CliError('Nexus mutation outcome is unknown. Remote changes may have occurred.',{code:'nexus.mutation.outcomeUnknown',cause:diagnosticCause(cause,raw?[raw,JSON.parse(raw).password,headers.Authorization!]:[])});}
 void response.body?.cancel();
 if(response.status!==204) throw new HttpError(response.status,'Nexus mutation did not return its expected acknowledgment. Partial changes may exist.');
}
/** Decode one bounded service document without echoing response bodies. */
export async function document(c:CommandContext,path:string):Promise<any>{
 const response=await checked(c,path);
 try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readResponseBody(response,{maxBytes:4194304,signal:c.signal})));}
 catch(cause){throw new CliError('Could not decode Nexus metadata.',{code:'nexus.decodeFailed',cause:diagnosticCause(cause,[],'Invalid or incomplete Nexus response.')});}
}
const view=recordView<any>({fields:['repository','id','observedAssetCount','acknowledged'].map(k=>({label:k,value:r=>r[k]}))});
export function deleteCommand(kind:string){return command('delete <id>','Delete one confirmed record',async ({args,options},c)=>{
 const id=String(args.id); const path=kind+'/'+pathSegment(id);
 if(options.confirmId!==id) usage('Confirmation must exactly match the resource ID.');
 const observed=await document(c,path);
 if(!observed || observed.id!==id || (kind==='components'&&(!Array.isArray(observed.assets)||observed.assets.length>1000))) throw new CliError('Nexus preflight did not identify the requested record.',{code:'nexus.decodeFailed'});
 await mutate(c,path,'DELETE');
 return {id,acknowledged:true,...(kind==='components'?{observedAssetCount:observed.assets.length}:{})};
},{permission:Permission.Update,view,options:[{flags:'--confirm-id <id>',description:'Confirm the exact resource ID',required:true}]});}
export const uploadCommand=command('upload','Publish one file', ['raw','maven'].map(format=>command(format,'Publish one file',async ({options:o},c)=>{
 const required=format==='raw'?['repository','file','directory']:['repository','file','group','artifact','version','extension'];
 for(const k of required) if(typeof o[k]!=='string'||!String(o[k]).trim()) usage('Upload fields must be nonempty.');
 if(format==='maven'&&o.extension!=='jar') usage('Maven upload requires extension jar.');
 const path=resolve(String(o.file)); const filename=String(o.filename??basename(path));
 if(!filename.trim()) usage('Filename must be nonempty.');
 let bytes:Uint8Array;
 try {const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try {const stat=await file.stat();if(!stat.isFile()||stat.size>64*1024*1024) usage('Upload requires a regular file up to 64 MiB.');
 const chunks:Buffer[]=[];let size=0;for await(const chunk of file.createReadStream({autoClose:false})){size+=chunk.length;if(size>64*1024*1024) usage('Upload exceeds 64 MiB.');chunks.push(chunk);}bytes=Buffer.concat(chunks);
 }finally{await file.close();}}catch(cause){if(cause instanceof CliError)throw cause;throw new CliError('Could not read upload file.',{code:'nexus.upload.fileFailed',cause:diagnosticCause(cause)});}
 const form=new FormData(); const prefix=format==='raw'?'raw':'maven2';
 form.set(prefix+'.asset1',new Blob([bytes as Uint8Array<ArrayBuffer>]),filename);
 const fields=format==='raw'?{'raw.directory':String(o.directory),'raw.asset1.filename':filename}:{'maven2.groupId':String(o.group),'maven2.artifactId':String(o.artifact),'maven2.version':String(o.version),'maven2.packaging':'jar','maven2.generate-pom':'true','maven2.asset1.extension':'jar'};
 for(const [key,value] of Object.entries(fields))form.set(key,value!);
 await mutate(c,'components?'+new URLSearchParams({repository:String(o.repository)}),'POST',form);
 return {repository:String(o.repository),acknowledged:true};
},{permission:Permission.Update,view,options:[...['repository','file',...(format==='raw'?['directory']:['group','artifact','version','extension'])].map(k=>({flags:`--${k} <value>`,description:`Set ${k}`,required:true})),...(format==='raw'?[{flags:'--filename <name>',description:'Set the destination filename'}]:[])]})));
export const formatsCommand=command('formats','Inspect format requirements',[command('upload-specs','Inspect upload requirements',[command('get <format>','Inspect one upload specification',({args},c)=>document(c,'formats/upload-specs/'+pathSegment(String(args.format))),{permission:Permission.ReadOnly,view:recordView<any>({fields:[{label:'Format',value:r=>r.format},{label:'Multiple upload',value:r=>r.multipleUpload}],sections:[{title:()=> 'Fields',lines:r=>[...(r.componentFields??[]),...(r.assetFields??[])].map((f:any)=>`${f.name}: ${f.optional?'optional':'required'}`)}]})})])]);
