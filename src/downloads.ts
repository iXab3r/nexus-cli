import { operationContext, resourceRedactions, statusMessage } from "./diagnostics.js";
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { CliError, FilePublicationError, HttpError, Permission, command, diagnosticCause, fetchWithRedirects, publishFile, recordView, type CommandContext } from '@eyeauras/cli-factory';
import { authorization, pathSegment } from './client.js';
import { document } from './mutations.js';
/** Nexus owns transport trust and integrity; Core owns exclusive file publication. */
async function download(c: CommandContext, id: string | undefined, o: Record<string, unknown>, content=false) {
 const diagnostic=operationContext('Download Nexus artifact', typeof o.repository==='string'?o.repository:undefined);
 const installation=new URL(String(c.profile.values.url));
 const eligible=(u:URL)=>u.origin===installation.origin || (installation.protocol==='http:' && u.protocol==='https:' && u.hostname===installation.hostname);
 let previous=installation;
 const requestUrls: string[] = [];
 const transport: typeof c.fetch=async(input,init)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  requestUrls.push(u.href);
  if(u.username || u.password || (u.protocol!=='https:' && !(u.protocol==='http:' && installation.protocol==='http:' && u.origin===installation.origin)) || (previous.protocol==='https:' && u.protocol==='http:')) throw new Error('Unsafe download target.');
  previous=u;
  return c.fetch(input,init);
 };
 let url:string; let name:string;
 if(content) {
  const path=o.path;
  const repository=o.repository;
  if(typeof path!=='string' || /[\\%\x00-\x1f\x7f-\x9f]/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.split('/').some(segment=>!segment || segment==='.' || segment==='..'))
   throw new CliError('Content path must use relative segments without navigation, controls, backslashes or percent signs.',{code:'usage',exitCode:2});
  if(typeof repository!=='string' || !repository || /[\x00-\x1f\x7f-\x9f]/.test(repository)) throw new CliError('Repository name is required and must contain no controls.',{code:'usage',exitCode:2});
  url=String(c.profile.values.url).replace(/\/$/,'')+'/repository/'+pathSegment(repository)+'/'+path.split('/').map(pathSegment).join('/');
  name=path.split('/').at(-1)!;
 } else if(id!==undefined) {
  const asset=await document(c,'assets/'+pathSegment(id));
  if(!asset || typeof asset!=='object' || Array.isArray(asset) || typeof asset.downloadUrl!=='string' || typeof asset.path!=='string') throw new CliError('Invalid asset download metadata.',{code:'nexus.decodeFailed'});
  try { new URL(asset.downloadUrl); } catch(cause) {
   throw new CliError('Invalid asset download URL.',{code:'nexus.decodeFailed',cause:diagnosticCause(cause,[],'Invalid Nexus download URL.')});
  }
  url=asset.downloadUrl; name=asset.path.split('/').at(-1)!;
 } else {
  const q=new URLSearchParams();
  for(const [k,v] of Object.entries({repository:'repository',name:'name',artifactVersion:'version',group:'group',format:'format',q:'q',mavenExtension:'maven.extension',mavenClassifier:'maven.classifier'})) if(o[k]!==undefined) q.set(v,String(o[k]));
  url=String(c.profile.values.url).replace(/\/$/,'')+'/service/rest/v1/search/assets/download?'+q;
  name=typeof o.name==='string'?o.name:'download';
 }
 const raw=c.profile.values.authMode==='anonymous'?undefined:await c.secrets.require('credentials');
 const headers:Record<string,string>={};
 if(raw && eligible(new URL(url))) headers.Authorization=authorization(raw);
 let length:number|undefined;
 let searchResponse:Response|undefined;
 try {
  if(id===undefined && !content) {
   searchResponse=await fetchWithRedirects(transport,url,{headers,signal:c.signal});
   if(searchResponse.status!==200) {void searchResponse.body?.cancel(); throw new HttpError(searchResponse.status,statusMessage(searchResponse.status,diagnostic));}
   name=decodeURIComponent(previous.pathname.split('/').at(-1)??'');
  }
  const saved=await publishFile({cwd:c.cwd,name,output:o.output as string|undefined,maxBytes:Number(o.maxBytes??1073741824),signal:c.signal,
   openResponse:()=>searchResponse?Promise.resolve(searchResponse):fetchWithRedirects(transport,url,{headers,signal:c.signal}),
   inspectResponse(r){
    if(r.status!==200) throw new HttpError(r.status,statusMessage(r.status,diagnostic));
    if(!r.body) throw new FilePublicationError('Download response has no body.');
    const n=r.headers.get('content-length');
    if(n!==null && !r.headers.get('content-encoding')) {if(!/^\d+$/.test(n)||!Number.isSafeInteger(Number(n))) throw new FilePublicationError('Invalid download length.'); length=Number(n);}
   },
   async validateFile(file){
    if(length!==undefined && length!==file.bytes) throw new FilePublicationError('Download length does not match.');
    if(o.sha256!==undefined){const hash=createHash('sha256'); for await(const chunk of createReadStream(file.path,{signal:c.signal})) hash.update(chunk); if(hash.digest('hex')!==String(o.sha256).toLowerCase()) throw new FilePublicationError('Download checksum does not match.');}
   }});
  return {...saved,verified:o.sha256!==undefined};
 } catch(cause) {
  void searchResponse?.body?.cancel().catch(()=>undefined);
  if(cause instanceof HttpError) throw cause;
  const httpCause=cause instanceof FilePublicationError && cause.cause instanceof HttpError ? cause.cause : undefined;
  throw new CliError(diagnostic+': could not publish Nexus download.',{code:httpCause?.code??'nexus.downloadFailed',exitCode:1,result:{published:cause instanceof FilePublicationError && cause.published,cleanupFailed:cause instanceof FilePublicationError && cause.cleanupFailed},cause:diagnosticCause(cause,[...resourceRedactions(url,...requestUrls,typeof o.repository==='string'?o.repository:undefined),...(raw?[raw,JSON.parse(raw).password,authorization(raw)]:[])])});
 }
}
export function downloadCommand(search=false, content=false){return command(search||content?'download':'download <id>','Download an artifact safely',({args,options},c)=>download(c,search||content?undefined:String(args.id),options,content),{permission:Permission.ReadOnly,
 view:recordView<any>({fields:['path','bytes','sha256','verified','published','cleanupFailed'].map(k=>({label:k,value:r=>r[k]}))}),
 options:[...(content?[{flags:'--repository <name>',description:'Choose the repository'},{flags:'--path <path>',description:'Choose the repository content path'}]:[]),{flags:'--output <path>',description:'Choose the destination file'}, {flags:'--sha256 <digest>',description:'Verify the expected SHA256',parse:v=>{if(!/^[a-fA-F0-9]{64}$/.test(v)) throw new CliError('Expected SHA256 must contain 64 hexadecimal characters.',{code:'usage',exitCode:2});return v;}}, {flags:'--max-bytes <number>',description:'Limit downloaded bytes',parse:v=>{if(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<1)throw new CliError('Byte limit must be a positive integer.',{code:'usage',exitCode:2});return Number(v);}}, ...(search?['repository','name','artifact-version','group','format','q','maven-extension','maven-classifier'].map(k=>({flags:`--${k} <value>`,description:'Filter matching artifacts'})):[])]});}
