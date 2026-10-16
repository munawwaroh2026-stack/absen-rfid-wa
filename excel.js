/* ExcelRingkas 1.0 — utilitas OOXML dan CSV asli untuk aplikasi ini.
   Tanpa dependensi, tanpa koneksi CDN. Membaca .xlsx standar (ZIP stored/deflate).
   Menulis .xlsx dengan ID dan nomor telepon sebagai teks. Tidak membaca .xls lama. */
(function(root){
 'use strict';
 const enc=new TextEncoder(),dec=new TextDecoder();
 const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
 const col=n=>{let s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);return s;};
 const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
 function crc(data){let c=0xFFFFFFFF;for(const b of data)c=table[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
 function zip(entries){
   const chunks=[],central=[];let offset=0;
   for(const [name,text]of Object.entries(entries)){
     const n=enc.encode(name),data=enc.encode(text),c=crc(data),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
     v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,c,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,data);
     const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,c,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);ch.set(n,46);central.push(ch);offset+=h.length+data.length;
   }
   const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
   return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 }
 function workbook(sheets){
   const entries={};
   const head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
   entries['[Content_Types].xml']=head+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>';
   entries['_rels/.rels']=head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
   entries['xl/workbook.xml']=head+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
   entries['xl/_rels/workbook.xml.rels']=head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
   entries['xl/styles.xml']=head+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12616A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
   sheets.forEach((s,i)=>{
     const rows=s.rows;
     entries[`xl/worksheets/sheet${i+1}.xml`]=head+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+rows[0].map((_,j)=>`<col min="${j+1}" max="${j+1}" width="${(s.widths||[])[j]||22}" customWidth="1"/>`).join('')+'</cols><sheetData>'+rows.map((row,r)=>`<row r="${r+1}"${r===0?' ht="26" customHeight="1"':''}>`+row.map((value,c)=>typeof value==='number'?`<c r="${col(c)}${r+1}" s="0"><v>${value}</v></c>`:`<c r="${col(c)}${r+1}" t="inlineStr" s="${r===0?2:1}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')+'</row>').join('')+`</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`;
   });
   return zip(entries);
 }
 async function unzip(buffer){
   const bytes=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
   for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
   if(end<0)throw Error('File bukan .xlsx yang valid. Simpan ulang sebagai Excel Workbook (.xlsx).');
   const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true),total=0;const out={};
   if(count>1000)throw Error('Workbook terlalu kompleks. Gunakan template yang disediakan.');
   for(let i=0;i<count;i++){
     if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)throw Error('Struktur ZIP rusak.');
     const method=v.getUint16(pos+10,true),size=v.getUint32(pos+20,true),usize=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true),name=dec.decode(bytes.slice(pos+46,pos+46+nl));
     total+=usize;if(total>30*1024*1024)throw Error('Isi workbook terlalu besar. Maksimal 30 MB setelah dibuka.');
     if(v.getUint16(pos+8,true)&1)throw Error('Workbook berpassword tidak didukung.');
     if(local+30>bytes.length)throw Error('ZIP rusak.');
     const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
     if(start+size>bytes.length)throw Error('ZIP tidak lengkap.');
     if(name.endsWith('.xml')||name.endsWith('.rels')){
       let data=bytes.slice(start,start+size);
       if(method===8){
         if(typeof DecompressionStream==='undefined')throw Error('Gunakan Chrome/Edge terbaru untuk membuka .xlsx.');
         const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
         const chunks=[];let length=0;
         while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>usize||length>30*1024*1024){await reader.cancel();throw Error('Ukuran file terkompresi tidak valid.');}chunks.push(item.value);}
         data=new Uint8Array(length);let n=0;for(const chunk of chunks){data.set(chunk,n);n+=chunk.length;}
       }else if(method!==0)throw Error('Kompresi workbook tidak didukung.');
       if(crc(data)!==v.getUint32(pos+16,true))throw Error('Checksum workbook tidak cocok. Unduh atau simpan ulang file.');
       out[name]=dec.decode(data);
     }
     pos+=46+nl+el+cl;
   }return out;
 }
 function parseXml(s){if(!s||/<!DOCTYPE/i.test(s))throw Error('XML workbook tidak valid.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('XML workbook rusak.');return d;}
 const tags=(n,t)=>Array.from(n.getElementsByTagNameNS('*',t));
 async function readXlsx(buffer){
   const files=await unzip(buffer),book=parseXml(files['xl/workbook.xml']),rels=parseXml(files['xl/_rels/workbook.xml.rels']);
   const sheet=tags(book,'sheet')[0];if(!sheet)throw Error('Workbook tidak memiliki sheet.');
   const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
   const rel=tags(rels,'Relationship').find(x=>x.getAttribute('Id')===rid);
   if(!rel)throw Error('Referensi sheet hilang.');
   let path=rel.getAttribute('Target');path=path.startsWith('/')?path.slice(1):'xl/'+path;
   if(path.includes('..'))throw Error('Jalur sheet tidak didukung. Simpan ulang di Excel.');
   const shared=files['xl/sharedStrings.xml']?tags(parseXml(files['xl/sharedStrings.xml']),'si').map(x=>tags(x,'t').map(t=>t.textContent).join('')):[];
   const rows=[];
   for(const row of tags(parseXml(files[path]),'row')){
     const a=[];
     for(const c of tags(row,'c')){
       const address=c.getAttribute('r')||'',letters=address.match(/^[A-Z]+/i)?.[0];let index=0;
       if(letters){for(const l of letters.toUpperCase())index=index*26+l.charCodeAt(0)-64;index--;}else index=a.length;
       if(index>100)continue;
       const type=c.getAttribute('t'),v=tags(c,'v')[0]?.textContent||'';
       a[index]={v:type==='s'?(shared[Number(v)]||''):type==='inlineStr'?tags(c,'t').map(t=>t.textContent).join(''):v,t:['s','inlineStr','str'].includes(type)?'s':'n',formula:tags(c,'f').length>0};
     }
     if(a.some(c=>c?.v!==''))rows.push(a);
     if(rows.length>5001)throw Error('Maksimal 5.000 siswa per file impor.');
   }return rows;
 }
 function readCsv(text){
   text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
   let rows=[],row=[],value='',quoted=false;
   const push=()=>{row.push({v:value,t:'s'});value='';};
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
     else if(c===sep&&!quoted)push();else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;push();if(row.some(x=>x.v.trim()))rows.push(row);row=[];}else value+=c;}
   if(quoted)throw Error('Tanda kutip CSV tidak berpasangan.');push();if(row.some(x=>x.v.trim()))rows.push(row);return rows;
 }
 async function read(file){if(file.size>5*1024*1024)throw Error('File maksimal 5 MB.');if(/\.csv$/i.test(file.name))return readCsv(await file.text());if(!/\.xlsx$/i.test(file.name))throw Error('Pilih .xlsx atau .csv. Format .xls lama perlu disimpan ulang sebagai .xlsx.');return readXlsx(await file.arrayBuffer());}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
 root.ExcelRingkas={workbook,read,readXlsx,readCsv,download};
})(globalThis);
