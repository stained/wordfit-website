import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit'}); if(build.status)process.exit(build.status);
const dir=path.join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain','.mp3':'audio/mpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.vtt':'text/vtt','.json':'application/json','.zip':'application/zip','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let file=path.resolve(dir,'.'+decodeURIComponent(url.pathname));
 if(file!==dir&&!file.startsWith(dir+path.sep)){res.writeHead(403).end();return;}
 let info=await stat(file);if(info.isDirectory()){if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search}).end();return;}file=path.join(file,'index.html');info=await stat(file);}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
 let start=0,end=info.size-1,status=200;
 if(req.headers.range){
  const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!range||(!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
  if(!range[1])start=Math.max(0,info.size-Number(range[2]));
  else {start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
  if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 }
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);
 if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(path.join(dir,'404.html')));}});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
