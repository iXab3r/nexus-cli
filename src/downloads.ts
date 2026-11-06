import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { CliError, FilePublicationError, HttpError, Permission, command, diagnosticCause, fetchWithRedirects, publishFile, readResponseBody, recordView, type CommandContext } from '@eyeauras/cli-factory';
import { authorization, checked, pathSegment } from './client.js';
/** Nexus owns transport trust and integrity; Core owns exclusive file publication. */
async function download(c: CommandContext, id: string | undefined, o: Record<string, unknown>) {
 const installation=new URL(String(c.profile.values.url));
 const eligible=(u:URL)=>u.origin===installation.origin || (installation.protocol==='http:' && u.protocol==='https:' && u.hostname===installation.hostname);
 let previous=installation;
 const transport: typeof c.fetch=async(input,init)=>{
  const u=new URL(input instanceof Request?input.url:String(input));
  if(u.username || u.password || (u.protocol!=='https:' && !(u.protocol==='http:' && installation.protocol==='http:' && u.origin===installation.origin)) || (previous.protocol==='https:' && u.protocol==='http:')) throw new Error('Unsafe download target.');
  previous=u;
  return c.fetch(input,init);
 };
 let url:string; let name:string;
 if(id!==undefined) {
  const r=await checked(c,'assets/'+pathSegment(id));
  const asset=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readResponseBody(r,{maxBytes:4194304,signal:c.signal})));
  if(typeof asset.downloadUrl!=='string' || typeof asset.path!=='string') throw new CliError('Invalid asset download metadata.',{code:'nexus.decodeFailed'});
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
  if(id===undefined) {
   searchResponse=await fetchWithRedirects(transport,url,{headers,signal:c.signal});
   if(searchResponse.status!==200) {void searchResponse.body?.cancel(); throw new HttpError(searchResponse.status,'Nexus search download was refused.');}
   name=decodeURIComponent(previous.pathname.split('/').at(-1)??'');
  }
  const saved=await publishFile({cwd:c.cwd,name,output:o.output as string|undefined,maxBytes:Number(o.maxBytes??1073741824),signal:c.signal,
   openResponse:()=>searchResponse?Promise.resolve(searchResponse):fetchWithRedirects(transport,url,{headers,signal:c.signal}),
   inspectResponse(r){
    if(r.status!==200) throw new HttpError(r.status,'Nexus download was refused.');
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
  throw new CliError('Could not publish Nexus download.',{code:httpCause?.code??'nexus.downloadFailed',exitCode:1,result:{published:cause instanceof FilePublicationError && cause.published,cleanupFailed:cause instanceof FilePublicationError && cause.cleanupFailed},cause:diagnosticCause(cause,raw?[raw,JSON.parse(raw).password,authorization(raw)]:[])});
 }
}
export function downloadCommand(search=false){return command(search?'download':'download <id>','Download an artifact safely',({args,options},c)=>download(c,search?undefined:String(args.id),options),{permission:Permission.ReadOnly,
 view:recordView<any>({fields:['path','bytes','sha256','verified','published','cleanupFailed'].map(k=>({label:k,value:r=>r[k]}))}),
 options:[{flags:'--output <path>',description:'Choose the destination file'}, {flags:'--sha256 <digest>',description:'Verify the expected SHA256',parse:v=>{if(!/^[a-fA-F0-9]{64}$/.test(v)) throw new CliError('Expected SHA256 must contain 64 hexadecimal characters.',{code:'usage',exitCode:2});return v;}}, {flags:'--max-bytes <number>',description:'Limit downloaded bytes',parse:v=>{if(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<1)throw new CliError('Byte limit must be a positive integer.',{code:'usage',exitCode:2});return Number(v);}}, ...(search?['repository','name','artifact-version','group','format','q','maven-extension','maven-classifier'].map(k=>({flags:`--${k} <value>`,description:'Filter matching artifacts'})):[])]});}
