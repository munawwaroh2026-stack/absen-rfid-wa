(function(){
 'use strict';
 const C=AttendanceCore,B=AttendanceBackend,E=ExcelRingkas,$=s=>document.querySelector(s),esc=C.escape;
 const icons={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',students:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9"/><circle cx="9" cy="7" r="4"/><path d="M16 3a4 4 0 0 1 0 8"/>',scan:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M7 12h10M8 8v8M12 8v8M16 8v8"/>',report:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',wa:'<path d="M21 11.5a9 9 0 0 1-9 9 9.5 9.5 0 0 1-4-.9L3 21l1.4-4.8A9 9 0 1 1 21 11.5Z"/><path d="M8 8c1 4 3 6 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>',settings:'<path d="m9 3 1-1h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z" transform="translate(1 0) scale(.92)"/><circle cx="12" cy="12" r="3"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="m5 12 4 4L20 5"/>',absent:'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8m0-8-8 8"/>',class:'<path d="M3 21V7l9-4 9 4v14H3ZM9 21v-6h6v6M7 9h2M15 9h2M7 12h2M15 12h2"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 7M4 12l2 7a7 7 0 0 0 12-2"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',card:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 10h3M6 14h5m5-5c2 2 2 4 0 6m-2-5c1 1 1 3 0 4"/>',volume:'<path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'};
 const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]||icons.report}</svg>`;
 const routes={dashboard:['Dashboard','dashboard'],students:['Data siswa','students'],scan:['Terminal RFID','scan'],report:['Rekap absensi','report'],wa:['WhatsApp','wa'],settings:['Pengaturan','settings']};
 let store,settings={...C.defaults},students=[],records=[],messages=[],loaded=false,busyScan=false,syncing=false;
 let studentPage=1,studentSearch='',studentClass='',showArchived=false,reportRows=[],reportPage=1,reportFilter='',reportClass='';
 let reportFrom=C.parts().date,reportTo=reportFrom,reportLoaded=false,scanMode='auto',simulation='07:10',lastResult=null,lastMinute='';
 const route=()=>Object.keys(routes).includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
 const today=()=>C.parts(new Date(),settings.timezone).date;
 const active=()=>students.filter(s=>C.eligible(s,today()));
 const classes=()=>[...new Set(active().map(s=>s.className))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
 const dateLabel=(d,long=false)=>new Date(d+'T12:00:00Z').toLocaleDateString('id-ID',{weekday:long?'long':undefined,day:'numeric',month:long?'long':'short',year:'numeric',timeZone:'UTC'});
 const initials=name=>name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 function status(s){const cl={Hadir:'good',Terlambat:'warn',Alpa:'bad',Izin:'info',Sakit:'info','Belum absen':'neutral',Libur:'neutral'};return `<span class="pill ${cl[s]||'neutral'}">${esc(s)}</span>`;}
 function toast(text,error=false){const n=document.createElement('div');n.className='toast'+(error?' error':'');n.textContent=text;$('#toasts').append(n);setTimeout(()=>n.remove(),6500);}
 function dialog(title,body,lock=false){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-close').hidden=lock;$('#dialog').dataset.lock=lock?'1':'';if(!$('#dialog').open)$('#dialog').showModal();}
 function close(){if($('#dialog').dataset.lock==='1')return;$('#dialog').close();}
 function errorForm(e){const el=$('#form-error');if(el)el.textContent=B.explain(e);else toast(B.explain(e),true);}
 async function task(button,fn){if(button)button.disabled=true;try{await fn();}catch(e){errorForm(e);}finally{if(button)button.disabled=false;}}
 const field=(label,name,type,value='',extra='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
 const action=(name,label,style='secondary',ico='',attrs='')=>`<button class="btn ${style}" data-action="${name}" ${attrs}>${ico?icon(ico):''}${label}</button>`;
 const head=(title,sub,buttons='')=>`<div class="page-head"><div><div class="eyebrow">Administrasi sekolah</div><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="buttons">${buttons}</div></div>`;
 const empty=(label,sub='')=>`<div class="empty">${icon('students')}<b>${label}</b>${sub}</div>`;
 function applyBrand(){
   document.documentElement.style.setProperty('--accent',settings.color);
   $('#school-side').textContent=settings.schoolName;$('#footer-school').textContent=settings.schoolName;
   $('#brand-short').textContent=settings.schoolName.replace(/^(SMP|MTs|SMA|SMK|SD|MA)\s+/i,'').split(/\s+/)[0].toUpperCase();
   document.title=settings.schoolName+' · Absensi';
   const logo=$('#school-logo');logo.replaceChildren();const img=document.createElement('img');img.src=/^data:image\/(png|jpeg|webp);base64,/.test(settings.logo)?settings.logo:'assets/mark.svg';img.alt='';logo.append(img);
   $('#account-text').textContent=store.demo?'Petugas demo':(store.session?.email||'Masuk');
   $('#side-mode').textContent=store.demo?'Mode demo lokal':loaded?'Firebase tersambung':'Menunggu login';
   $('#mode-badge').textContent=store.demo?'Demo lokal':'Firebase Spark';
   $('#mode-banner').innerHTML=store.demo?' <span><b>MODE DEMO</b> · Data contoh tersimpan di browser ini. Belum tersambung Firebase.</span><a href="PANDUAN.html" target="_blank" rel="noopener">Cara pasang ↗</a>':'';
 }
 function render(){
   $('#page-label').textContent=routes[route()][0];
   $('#nav').innerHTML=Object.entries(routes).map(([key,[label,ico]])=>`<a href="#${key}" class="nav-link ${route()===key?'active':''}" ${route()===key?'aria-current="page"':''}>${icon(ico)}${label}</a>`).join('');
   applyBrand();
   if(!loaded){$('#main').innerHTML=`<div class="locked">${icon('shield')}<h1>Ruang petugas absensi</h1><p class="muted">Masuk dengan akun petugas sekolah untuk membuka data.</p>${action('login','Masuk petugas','','shield')}</div>`;return;}
   ({dashboard:renderDashboard,students:renderStudents,scan:renderScanner,report:renderReport,wa:renderWA,settings:renderSettings}[route()])();
 }
 function renderDashboard(){
   const rows=C.dayRows(students,records,today(),settings),counts={};rows.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
   const list=active(),dayTotal=rows.filter(r=>r.status!=='Libur').length,present=(counts.Hadir||0)+(counts.Terlambat||0),percent=dayTotal?Math.round(present/dayTotal*100):0;
   const stats=[['students','Total siswa',list.length,'Siswa aktif terdaftar'],['check','Hadir tepat waktu',counts.Hadir||0,''+percent+'% total kehadiran'],['clock','Terlambat',counts.Terlambat||0,'Lewat pukul '+settings.lateAfter],['absent','Tidak masuk',counts.Alpa||0,`${counts['Belum absen']||0} siswa belum absen`],['report','Izin',counts.Izin||0,`${counts.Sakit||0} siswa sakit`],['class','Jumlah kelas',classes().length,'Kelas dengan siswa aktif']];
   const cs=classes().map((cl,i)=>{const rs=rows.filter(r=>r.className===cl),n=rs.filter(r=>['Hadir','Terlambat'].includes(r.status)).length,den=rs.filter(r=>r.status!=='Libur').length,p=den?Math.round(n/den*100):0;return `<div class="class-row"><div class="class-top"><b>Kelas ${esc(cl)}</b><span>${n} / ${den||rs.length} siswa hadir <strong>${p}%</strong></span></div><div class="track"><span style="width:${p}%;${i%3===1?'background:#74aaa7':i%3===2?'background:#b3c9b9':''}"></span></div></div>`;}).join('');
   const recent=records.filter(r=>r.date===today()&&r.inTime).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,5);
   $('#main').innerHTML=head('Dashboard',dateLabel(today(),true),action('sync','Perbarui','secondary','refresh'))+`
   <section class="hero"><div><div class="eyebrow">Sistem kehadiran siswa</div><h2>Setiap kehadiran berarti.</h2><p>Pantau kehadiran siswa, kelola kartu RFID, dan kabarkan kedatangannya kepada orang tua.</p><div class="buttons"><a class="btn" href="#scan">${icon('scan')} Buka terminal RFID ${icon('arrow')}</a><span class="chip">Masuk ${settings.inStart}–${settings.inEnd}</span></div></div><div class="hero-art" aria-hidden="true"><div class="rfid-card">${icon('card')}<div class="card-lines"></div></div><span class="wave">${icon('check')}</span></div></section>
   <section class="stats" aria-label="Ringkasan absensi">${stats.map(([ico,label,n,note])=>`<article class="stat"><span class="stat-icon">${icon(ico)}</span><span class="stat-label">${label}</span><b class="stat-value">${n}</b><span class="stat-note">${esc(note)}</span></article>`).join('')}</section>
   <div class="grid-two"><section class="panel"><div class="panel-head"><div><h2>Kehadiran per kelas</h2><p>Hadir dan terlambat ÷ seluruh siswa pada hari ini</p></div><span class="pill neutral">Hari ini</span></div><div class="panel-body">${cs||empty('Belum ada kelas','Tambahkan siswa untuk melihat persentase.')}</div></section>
   <section class="panel"><div class="panel-head"><div><h2>Aktivitas terbaru</h2><p>Lima absen terakhir hari ini</p></div><a href="#report" style="font-size:10px">Lihat rekap ↗</a></div><div class="panel-body">${recent.map(r=>`<div class="activity-row"><span class="avatar ${r.status==='Terlambat'?'gold':''}">${esc(initials(r.name))}</span><div class="activity-name">${esc(r.name)}<small>${esc(r.className)} · ${r.outTime?'Absen pulang':'Absen masuk'}</small></div><div style="text-align:right">${status(r.status)}<div class="activity-time">${esc(r.outTime||r.inTime)}</div></div></div>`).join('')||empty('Belum ada aktivitas','Absen siswa akan muncul di sini.')}</div></section></div>
   <section class="schedule">${icon('clock')}<div><b>Jadwal absensi sekolah</b><p>Zona waktu ${esc(settings.timezone)} · batas tepat waktu ${settings.lateAfter}</p></div><div class="schedule-times"><span>Absen masuk<strong>${settings.inStart} – ${settings.inEnd}</strong></span><span>Absen pulang<strong>${settings.outStart} – ${settings.outEnd}</strong></span></div><a href="#settings" aria-label="Ubah jadwal">${icon('settings')}</a></section>`;
 }
 function filteredStudents(){return students.filter(s=>showArchived?!!s.inactiveOn:!s.inactiveOn).filter(s=>(!studentClass||s.className===studentClass)&&(!studentSearch||[s.name,s.className,s.rfid,s.phone].some(v=>String(v).toLowerCase().includes(studentSearch.toLowerCase())))).sort((a,b)=>a.className.localeCompare(b.className,'id',{numeric:true})||a.name.localeCompare(b.name,'id'));}
 function renderStudents(){
   $('#main').innerHTML=head('Data siswa','Kelola identitas, kartu RFID, dan kontak orang tua.',action('template','Template Excel','secondary','download')+action('import','Impor Excel','secondary','upload')+action('add-student','Tambah siswa','','plus'))+`
   <div class="notice">ID RFID dan nomor WhatsApp disimpan sebagai <b>teks</b>, termasuk angka nol di depan. Nomor WhatsApp boleh dikosongkan.</div>
   <section class="panel"><div class="filter-bar"><div class="field grow"><label for="student-search">Cari siswa</label><input id="student-search" type="search" placeholder="Nama, kelas, atau ID RFID…" value="${esc(studentSearch)}"></div><div class="field"><label for="student-class">Kelas</label><select id="student-class"><option value="">Semua kelas</option>${[...new Set(students.map(s=>s.className))].sort().map(c=>`<option ${studentClass===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><label class="check-line"><input id="archived-toggle" type="checkbox" ${showArchived?'checked':''}> Lihat arsip</label></div><div id="student-table"></div></section>`;
   renderStudentTable();
 }
 function renderStudentTable(){
   const all=filteredStudents(),max=Math.max(1,Math.ceil(all.length/25));studentPage=Math.min(max,studentPage);
   $('#student-table').innerHTML=all.length?`<div class="table-wrap"><table><thead><tr><th>SISWA</th><th>KELAS</th><th>ID RFID</th><th>WHATSAPP ORANG TUA</th><th>AKSI</th></tr></thead><tbody>${all.slice((studentPage-1)*25,studentPage*25).map((s,i)=>`<tr><td><div class="name-cell"><span class="avatar ${i%3===1?'purple':''}">${esc(initials(s.name))}</span><div><b>${esc(s.name)}</b><small>${s.inactiveOn?'Diarsipkan '+dateLabel(s.inactiveOn):'Aktif sejak '+dateLabel(s.enrolledOn)}</small></div></div></td><td>${esc(s.className)}</td><td class="mono">${esc(s.rfid)}</td><td>${s.phone?esc(s.phone)+(!s.waConsent?'<small class="muted"> · tanpa persetujuan</small>':''):'<span class="muted">Tidak diisi</span>'}</td><td><div class="buttons">${action('edit-student','Ubah','secondary tiny','edit',`data-id="${esc(s.id)}"`)}${action(s.inactiveOn?'restore-student':'archive-student',s.inactiveOn?'Aktifkan':'Arsip','secondary tiny','',`data-id="${esc(s.id)}"`)}</div></td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>${all.length} siswa · halaman ${studentPage} / ${max}</span><div class="buttons">${action('student-prev','Sebelumnya','secondary','',studentPage===1?'disabled':'')}${action('student-next','Berikutnya','secondary','',studentPage===max?'disabled':'')}${action('export-students','Ekspor siswa','secondary','download')}</div></div>`:empty(showArchived?'Arsip siswa kosong':'Belum ada siswa yang sesuai','Gunakan Tambah siswa atau Impor Excel.');
 }
 function studentForm(id){
   const s=students.find(x=>x.id===id),editing=!!s;
   dialog(editing?'Ubah data siswa':'Tambah siswa',`<form id="student-form" data-id="${esc(id||'')}"><div class="form-grid">
   <div class="full">${field('Nama lengkap siswa','name','text',s?.name||'','required maxlength="100" autocomplete="off"')}</div>
   ${field('ID RFID (teks)','rfid','text',s?.rfid||'',`required maxlength="64" autocomplete="off" spellcheck="false" ${editing?'readonly':''}`)}
   <div class="field"><label for="className">Kelas</label><input id="className" name="className" list="class-options" value="${esc(s?.className||'')}" required maxlength="30" placeholder="VII A"><datalist id="class-options">${classes().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
   <div class="full">${field('WhatsApp orang tua (opsional)','phone','tel',s?.phone||'','maxlength="24" placeholder="081234567890"')}<small class="muted">Nomor 08… otomatis diubah menjadi 628….</small></div>
   <div class="field full"><label class="check"><input name="waConsent" type="checkbox" ${s?.waConsent?'checked':''}> Orang tua menyetujui penerimaan notifikasi WhatsApp.</label></div>
   <div class="full">${field('Mulai aktif sebagai siswa','enrolledOn','date',s?.enrolledOn||today(),`required max="${today()}" ${editing?'readonly':''}`)}</div></div>
   ${editing?'<p class="subtitle">ID RFID tetap untuk menjaga hubungan dengan rekap. Jika mengganti kartu, arsipkan kartu lama lalu buat data dengan kartu baru.</p>':'<p class="subtitle">Klik kolom ID RFID, lalu tempel kartu ke reader USB. Anda juga bisa mengetik ID secara manual.</p>'}
   <div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions">${action('close','Batal','secondary')}<button class="btn" type="submit">Simpan siswa</button></div></form>`);
   $('#student-form #name').focus();
   $('#student-form #rfid').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#className').focus();}});
 }
 async function saveStudentForm(form){
   const f=new FormData(form),id=form.dataset.id,old=students.find(s=>s.id===id),name=f.get('name').trim(),className=f.get('className').trim().toUpperCase(),rfid=C.rfid(f.get('rfid')),ph=C.phone(f.get('phone')),enrolledOn=f.get('enrolledOn');
   if(!name||!className)throw Error('Nama dan kelas harus diisi.');
   if(!C.validDate(enrolledOn)||enrolledOn>today())throw Error('Tanggal mulai aktif harus valid dan tidak boleh di masa depan.');
   if(students.some(s=>s.rfid===rfid&&s.id!==id))throw Error('ID RFID ini sudah digunakan siswa lain, termasuk dalam arsip.');
   const history=old?.history?[...old.history]:[];
   if(!old||old.name!==name||old.className!==className){const from=old?today():enrolledOn;const pos=history.findIndex(h=>h.from===from);const h={from,name,className};if(pos>=0)history[pos]=h;else history.push(h);}
   const data={id:old?.id||rfid,name,className,rfid,phone:ph,waConsent:!!f.get('waConsent'),enrolledOn,inactiveOn:old?.inactiveOn||'',history,updatedAt:new Date().toISOString()};
   await store.saveStudent(data,!old);students=await store.getStudents();reportLoaded=false;close();render();toast('Data siswa berhasil disimpan.');
 }
 function template(){
   E.download(E.workbook([{name:'Siswa',widths:[32,25,18,28,24,20],rows:[['Nama Siswa','ID RFID','Kelas','WhatsApp Orang Tua','Persetujuan WA','Mulai Aktif'],...Array.from({length:30},()=>['','','','','',''])]}]),'Template_Impor_Siswa_RFID_Teks.xlsx');
 }
 function importDialog(){
   dialog('Impor siswa dari Excel',`<div class="notice">Gunakan template. Kolom wajib: <b>Nama Siswa, ID RFID, Kelas</b>. Kolom WhatsApp boleh kosong. Isi Persetujuan WA dengan YA jika sudah disetujui. ID RFID harus berformat Teks di Excel.</div><input type="file" id="import-file" accept=".xlsx,.csv"><p class="subtitle">.xlsx / .csv · maksimal 5 MB · 5.000 baris · sheet pertama</p><div id="import-preview"></div><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions">${action('close','Batal','secondary')}<button id="import-save" class="btn" disabled>Simpan data siswa</button></div>`);
   let prepared=[];
   $('#import-file').addEventListener('change',async e=>{
     prepared=[];$('#import-save').disabled=true;$('#form-error').textContent='';$('#import-preview').innerHTML='';
     if(!e.target.files[0])return;
     try{
       const rows=await E.read(e.target.files[0]);if(rows.length<2)throw Error('File belum berisi data siswa.');
       const normalize=s=>s.toLowerCase().trim().replace(/[^a-z0-9]/g,'');
       const headers=rows[0].map(c=>normalize(c?.v||''));
       const idx=aliases=>headers.findIndex(h=>aliases.includes(h));
       const ns=idx(['namasiswa','nama']),ir=idx(['idrfid','rfid']),cl=idx(['kelas']),ph=idx(['whatsapporangtua','nomorwhatsapp','nowa','whatsapp','waorangtua']),cons=idx(['persetujuanwa']),start=idx(['mulaiaktif']);
       if([ns,ir,cl].some(n=>n<0))throw Error('Judul kolom harus memuat Nama Siswa, ID RFID, dan Kelas pada baris pertama.');
       const seen=new Set(students.map(s=>s.rfid)),errors=[];
       if(rows.length>5001)throw Error('Maksimal 5.000 siswa per file.');
       rows.slice(1).forEach((row,i)=>{try{
         const get=j=>String(row[j]?.v||'').trim();if(!get(ns)&&!get(ir)&&!get(cl))return;
         if(row[ir]?.t!=='s')throw Error('ID RFID harus Teks. Angka nol mungkin sudah hilang. Ubah kolom ke Teks dan ketik ulang ID.');
         if([ns,ir,cl,ph].some(j=>row[j]?.formula))throw Error('Gunakan nilai biasa, bukan rumus Excel.');
         const name=get(ns),className=get(cl).toUpperCase(),rfid=C.rfid(get(ir)),phone=C.phone(ph<0?'':get(ph));
         if(!name||name.length>100||!className||className.length>30)throw Error('Nama/kelas kosong atau terlalu panjang.');
         if(seen.has(rfid))throw Error('ID RFID duplikat dalam file atau sudah ada dalam data/arsip.');
         const enrolledOn=start>=0&&get(start)?get(start):today();if(!C.validDate(enrolledOn)||enrolledOn>today())throw Error('Mulai Aktif harus tanggal valid berupa teks YYYY-MM-DD, tidak boleh di masa depan.');
         seen.add(rfid);prepared.push({id:rfid,rfid,name,className,phone,waConsent:cons>=0&&['ya','yes','true','1'].includes(get(cons).toLowerCase()),enrolledOn,inactiveOn:'',history:[{from:enrolledOn,name,className}],updatedAt:new Date().toISOString()});
       }catch(err){errors.push(`Baris ${i+2}: ${err.message}`);}});
       $('#import-preview').innerHTML=`<div class="spacer"></div><p><b>${prepared.length} siswa valid</b> · ${errors.length} kesalahan</p><div class="import-list">${errors.slice(0,50).map(e=>`<div class="inline-error">${esc(e)}</div>`).join('')}${prepared.slice(0,15).map(s=>`<div>${esc(s.name)} · ${esc(s.className)} · <span class="mono">${esc(s.rfid)}</span></div>`).join('')}</div><p class="subtitle">${errors.length?'Perbaiki semua kesalahan lalu pilih file kembali.':'Data baru akan ditambahkan; data siswa yang sudah ada tetap disimpan.'}</p>`;
       $('#import-save').disabled=errors.length>0||!prepared.length;
     }catch(err){errorForm(err);}
   });
   $('#import-save').addEventListener('click',e=>task(e.target,async()=>{
     try{await store.saveStudents(prepared);}catch(err){students=await store.getStudents();throw Error('Impor terhenti. Sebagian kelompok data mungkin sudah tersimpan. Tutup, perbarui data, lalu impor hanya ID yang belum ada. '+B.explain(err));}
     students=await store.getStudents();reportLoaded=false;close();render();toast(`${prepared.length} siswa berhasil ditambahkan.`);
   }));
 }
 function renderScanner(){
   const p=C.parts(new Date(),settings.timezone),recent=records.filter(r=>r.date===today()&&r.inTime).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,7);
   $('#main').innerHTML=head('Terminal RFID','Hubungkan reader USB, klik kolom kartu, lalu tempelkan kartu siswa.',action('test-voice','Tes suara','secondary','volume')+action('fullscreen','Layar penuh','secondary','scan'))+`
   ${store.demo?`<div class="notice warning"><b>Simulasi demo.</b> Pilih jam uji; tidak ada pesan WhatsApp yang dikirim.<div class="buttons" style="margin-top:9px"><label for="simulation">Jam simulasi:</label><input type="time" id="simulation" value="${simulation}" style="padding:4px;border:1px solid #d6c79d;border-radius:6px"><button class="btn tiny secondary" data-action="demo-card">Coba kartu siswa belum absen</button></div></div>`:''}
   <div class="terminal-grid"><section class="terminal"><div class="terminal-label"><span class="pill ${store.demo?'neutral':'good'}">${store.demo?'Simulasi lokal':'Petugas masuk'} · RFID USB</span><span class="muted" style="font-size:10px">${esc(settings.timezone)}</span></div>
   <div class="terminal-clock" id="terminal-clock">${p.time}</div><div class="terminal-date">${dateLabel(today(),true)}</div><div class="scan-illustration">${icon('scan')}</div><h2>Tempelkan kartu siswa</h2><p class="subtitle">Satu kartu. Satu catatan kehadiran.</p>
   <div class="segment" role="group" aria-label="Mode absensi">${[['auto','Otomatis'],['in','Masuk'],['out','Pulang']].map(([v,l])=>`<button data-action="scan-mode" data-mode="${v}" class="${scanMode===v?'active':''}" aria-pressed="${scanMode===v}">${l}</button>`).join('')}</div>
   <form id="scan-form" class="scan-form"><input id="scan-input" type="text" placeholder="ID RFID" autocomplete="off" spellcheck="false" maxlength="64" aria-label="ID RFID siswa"><button type="submit" class="btn" aria-label="Catat absensi">${icon('arrow')}</button></form><p class="terminal-hint" id="focus-hint">Klik kolom kartu agar siap menerima input reader. Akhiri dengan Enter.</p>
   <div id="scan-result" class="scan-result" role="status">${icon('shield')}<b>Siap menerima kartu</b><small>Suara berhasil diputar setelah data tersimpan.</small></div></section>
   <div><section class="panel"><div class="panel-head"><div><h2>Absensi hari ini</h2><p>Catatan terakhir dari data yang dimuat</p></div><span class="badge-number">${records.filter(r=>r.date===today()&&r.inTime).length}</span></div><div class="panel-body">${recent.map(r=>`<div class="activity-row"><span class="avatar">${esc(initials(r.name))}</span><div class="activity-name">${esc(r.name)}<small>${esc(r.className)} · ${r.outTime?'Pulang '+r.outTime:'Masuk '+r.inTime}</small></div>${status(r.status)}</div>`).join('')||empty('Menunggu kartu pertama')}</div></section>
   <section class="panel"><div class="panel-head"><h2>Jadwal berlaku</h2>${icon('clock')}</div><div class="panel-body"><div class="class-row"><div class="class-top"><b>Absen masuk</b><span>${settings.inStart}–${settings.inEnd}</span></div></div><div class="class-row"><div class="class-top"><b>Mulai terlambat</b><span>Setelah ${settings.lateAfter}</span></div></div><div class="class-row"><div class="class-top"><b>Absen pulang</b><span>${settings.outStart}–${settings.outEnd}</span></div></div><p class="subtitle">Kartu yang dipindai di luar jadwal akan ditolak. Mode Masuk/Pulang juga mengikuti jadwal.</p></div></section></div></div>`;
   if(lastResult)showScanResult(lastResult);
   $('#scan-input').addEventListener('focus',()=>$('#focus-hint').textContent='Reader siap. Tempelkan kartu sekarang.');
   $('#scan-input').addEventListener('blur',()=>{if($('#focus-hint'))$('#focus-hint').textContent='Fokus kartu terlepas. Klik kolom ID RFID sebelum menempel kartu.';});
   $('#scan-input').focus();
 }
 function showScanResult(result){
   const el=$('#scan-result');if(!el)return;
   el.className='scan-result '+(result.ok?'success':'failure');
   el.innerHTML=result.ok?`${icon('check')}<b>Absen ${result.mode==='in'?'masuk':'pulang'} berhasil</b><span>${esc(result.record.name)} · ${esc(result.record.className)}</span><small>${esc(result.time)} · ${esc(result.record.status)}${result.wa?' · WhatsApp masuk antrean':''}</small>`:`${icon('absent')}<b>Absen belum dicatat</b><small>${esc(result.message)}</small>`;
 }
 function speak(text='absen berhasil'){
   if(!('speechSynthesis'in window)){toast('Browser ini tidak mendukung suara. Gunakan Chrome/Edge.',true);return;}
   const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.95;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('id'));if(voice)u.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(u);
 }
 async function scan(value){
   if(busyScan)return;busyScan=true;const input=$('#scan-input');if(input)input.readOnly=true;const resultBox=$('#scan-result');if(resultBox){resultBox.className='scan-result';resultBox.innerHTML=icon('clock')+'<b>Menyimpan absensi…</b><small>Tunggu sampai nama siswa dan konfirmasi berhasil muncul.</small>';}
   try{
     if(!store.demo&&!navigator.onLine)throw Error('Tidak ada internet. Data belum tersimpan. Sambungkan lalu tempel ulang kartu.');
     const rfid=C.rfid(value),s=students.find(s=>s.rfid===rfid&&!s.inactiveOn);if(!s)throw Error('Kartu belum terdaftar atau siswa diarsipkan. Tambahkan di Data siswa, lalu perbarui data.');
     let now=new Date();if(store.demo){const offset={'Asia/Jakarta':'+07:00','Asia/Makassar':'+08:00','Asia/Jayapura':'+09:00'}[settings.timezone]||'+07:00';now=new Date(today()+'T'+simulation+':00'+offset);}
     const result=await store.scan(s,settings,now,scanMode);records=records.filter(r=>r.id!==result.record.id).concat(result.record);reportLoaded=false;
     lastResult={ok:true,...result,wa:settings.autoWhatsApp&&s.phone&&s.waConsent};if(settings.voice)speak();
   }catch(e){lastResult={ok:false,message:B.explain(e)};}
   finally{busyScan=false;if(route()==='scan'){renderScanner();$('#scan-input').value='';$('#scan-input').focus();}}
 }
 function renderReport(){
   const cls=[...new Set([...classes(),...reportRows.map(r=>r.className)])].sort();
   $('#main').innerHTML=head('Rekap absensi','Semua siswa tercakup, termasuk izin, sakit, dan tanpa keterangan.',action('export-report','Unduh Excel','','download'))+`
   <div class="notice">Siswa yang belum absen menjadi <b>Alpa</b> setelah pukul ${settings.inEnd}. Sebelum itu ditandai <b>Belum absen</b>. Hari libur tidak dihitung sebagai Alpa. Rekap mengikuti tanggal mulai aktif dan arsip siswa.</div>
   <section class="panel"><div class="filter-bar">${field('Dari tanggal','report-from','date',reportFrom,`max="${today()}"`)}${field('Sampai tanggal','report-to','date',reportTo,`max="${today()}"`)}<div class="field"><label for="report-class">Kelas</label><select id="report-class"><option value="">Semua kelas</option>${cls.map(c=>`<option ${reportClass===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label for="report-status">Status</label><select id="report-status"><option value="">Semua status</option>${['Hadir','Terlambat','Izin','Sakit','Alpa','Belum absen'].map(s=>`<option ${reportFilter===s?'selected':''}>${s}</option>`).join('')}</select></div>${action('load-report','Tampilkan','','report')}</div><div id="report-content"></div></section>`;
   renderReportContent();
 }
 function filteredReport(){return reportRows.filter(r=>(!reportClass||r.className===reportClass)&&(!reportFilter||r.status===reportFilter));}
 function renderReportContent(){
   if(!reportLoaded){$('#report-content').innerHTML=empty('Pilih tanggal, lalu klik Tampilkan','Maksimal 31 hari per rekap.');return;}
   const rows=filteredReport(),max=Math.max(1,Math.ceil(rows.length/50));reportPage=Math.min(max,reportPage);
   const counts={};rows.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
   $('#report-content').innerHTML=`<div class="summary-strip" style="padding:18px 20px 0">${['Hadir','Terlambat','Izin','Sakit','Alpa','Belum absen'].map(s=>`<span>${s}: <b>${counts[s]||0}</b></span>`).join('')}</div>`+(rows.length?`<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>SISWA</th><th>KELAS</th><th>STATUS</th><th>MASUK</th><th>PULANG</th><th>KETERANGAN</th><th>AKSI</th></tr></thead><tbody>${rows.slice((reportPage-1)*50,reportPage*50).map(r=>`<tr><td>${dateLabel(r.date)}</td><td><b style="font-weight:550">${esc(r.name)}</b></td><td>${esc(r.className)}</td><td>${status(r.status)}</td><td class="mono">${r.inTime||'—'}</td><td class="mono">${r.outTime||'—'}</td><td>${esc(r.note||'—')}</td><td><div class="buttons">${action('correct-record','Koreksi','secondary tiny','edit',`data-id="${esc(r.studentId)}" data-date="${r.date}"`)}${r.inTime&&r.phone?action('manual-wa','WhatsApp','soft tiny','wa',`data-id="${esc(r.studentId)}" data-date="${r.date}"`):''}</div></td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>${rows.length} baris · halaman ${reportPage} / ${max}</span><div class="buttons">${action('report-prev','Sebelumnya','secondary','',reportPage===1?'disabled':'')}${action('report-next','Berikutnya','secondary','',reportPage===max?'disabled':'')}</div></div>`:empty('Tidak ada data untuk filter ini'));
 }
 async function loadReport(){
   reportFrom=$('#report-from')?.value||reportFrom;reportTo=$('#report-to')?.value||reportTo;
   if(reportTo>today())throw Error('Tanggal rekap tidak boleh di masa depan.');
   const dates=C.dateRange(reportFrom,reportTo),data=await store.getRecords(reportFrom,reportTo);
   reportRows=dates.flatMap(date=>C.dayRows(students,data,date,settings).filter(r=>r.status!=='Libur'));
   reportLoaded=true;reportPage=1;renderReport();
 }
 function correction(id,date){
   const r=reportRows.find(x=>x.studentId===id&&x.date===date);if(!r)return;
   dialog('Koreksi absensi',`<form id="correction-form" data-id="${esc(id)}" data-date="${date}"><p><b>${esc(r.name)}</b> · ${esc(r.className)}</p><p class="subtitle">${dateLabel(date,true)}</p><div class="spacer"></div><div class="form-grid"><div class="field full"><label for="cor-status">Status</label><select name="status" id="cor-status">${['Hadir','Terlambat','Izin','Sakit','Alpa'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></div>${field('Jam masuk','inTime','time',r.inTime.slice(0,5))}${field('Jam pulang','outTime','time',r.outTime.slice(0,5))}<div class="field full"><label for="note">Keterangan koreksi</label><textarea name="note" id="note" rows="3" maxlength="300" required>${esc(r.note)}</textarea><small>Wajib diisi. Koreksi manual tidak membuat notifikasi otomatis baru.</small></div></div><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions">${action('close','Batal','secondary')}<button type="submit" class="btn">Simpan koreksi</button></div></form>`);
 }
 async function saveCorrection(form){
   const f=new FormData(form),id=form.dataset.id,date=form.dataset.date,row=reportRows.find(x=>x.studentId===id&&x.date===date),old=await store.get('attendance/'+date+'_'+id),st=f.get('status');
   const present=['Hadir','Terlambat'].includes(st),inTime=present?f.get('inTime'):'',outTime=present?f.get('outTime'):'';
   if(present&&!inTime)throw Error('Status hadir/terlambat membutuhkan jam masuk.');if(outTime&&outTime<inTime)throw Error('Jam pulang tidak boleh lebih awal dari jam masuk.');
   const note=f.get('note').trim();if(!note)throw Error('Keterangan koreksi wajib diisi.');
   const data={id:date+'_'+id,studentId:id,name:row.name,className:row.className,rfid:row.rfid,date,status:st,inTime:inTime?inTime+':00':'',outTime:outTime?outTime+':00':'',note,source:'Koreksi petugas',updatedAt:new Date().toISOString(),updatedBy:store.session?.email||'demo'};
   await store.saveRecord(data,old);if(date===today())records=await store.getRecords(today());close();await loadReport();toast('Koreksi disimpan.');
 }
 function exportReport(){
   if(!reportLoaded)throw Error('Tampilkan rekap terlebih dahulu.');
   const rows=filteredReport();if(!rows.length)throw Error('Tidak ada data untuk diekspor.');
   const cols=['Tanggal','Nama Siswa','ID RFID','Kelas','Status','Jam Masuk','Jam Pulang','Keterangan'];
   const summary=new Map();for(const r of rows){const key=r.studentId+'|'+r.className;let s=summary.get(key);if(!s){s={name:r.name,rfid:r.rfid,className:r.className,Hadir:0,Terlambat:0,Izin:0,Sakit:0,Alpa:0,'Belum absen':0};summary.set(key,s);}s[r.status]=(s[r.status]||0)+1;}
   const all=[{name:'Rekap Absensi',widths:[16,30,24,15,20,17,17,40],rows:[cols,...rows.map(r=>[r.date,r.name,r.rfid,r.className,r.status,r.inTime,r.outTime,r.note])]},
   {name:'Ringkasan Siswa',widths:[30,24,15,15,15,12,12,12,18],rows:[['Nama Siswa','ID RFID','Kelas','Hadir','Terlambat','Izin','Sakit','Alpa','Belum absen'],...[...summary.values()].map(s=>[s.name,s.rfid,s.className,s.Hadir,s.Terlambat,s.Izin,s.Sakit,s.Alpa,s['Belum absen']])]},
   {name:'Informasi',widths:[27,85],rows:[['Keterangan','Nilai'],['Sekolah',settings.schoolName],['Periode',reportFrom+' s.d. '+reportTo],['Filter kelas',reportClass||'Semua'],['Filter status',reportFilter||'Semua'],['Zona waktu',settings.timezone],['Waktu unduh',new Date().toISOString()],['Definisi Hadir','Hadir dan Terlambat disajikan terpisah. Total kehadiran = Hadir + Terlambat.'],['Ketidakhadiran','Alpa setelah batas masuk; Belum absen sebelum batas masuk. Libur tidak dimasukkan.']]}];
   E.download(E.workbook(all),`Rekap_Absensi_${reportFrom}_${reportTo}.xlsx`);toast('File rekap Excel dibuat.');
 }
 function exportStudents(){const rows=filteredStudents();E.download(E.workbook([{name:'Siswa',widths:[30,24,16,28,22,18],rows:[['Nama Siswa','ID RFID','Kelas','WhatsApp Orang Tua','Persetujuan WA','Mulai Aktif'],...rows.map(s=>[s.name,s.rfid,s.className,s.phone,s.waConsent?'YA':'TIDAK',s.enrolledOn])]}]),'Data_Siswa.xlsx');}
 function renderWA(){
   const c={};messages.forEach(m=>c[m.status]=(c[m.status]||0)+1);
   const labels={pending:['Menunggu','warn'],processing:['Sedang diproses','warn'],accepted:['Diterima API','good'],error:['Gagal','bad'],uncertain:['Perlu dicek','warn'],cancelled:['Dibatalkan','neutral'],demo:['Simulasi','neutral']};
   $('#main').innerHTML=head('Notifikasi WhatsApp','Kabarkan absensi masuk dan pulang kepada orang tua.',action('load-messages','Perbarui status','secondary','refresh'))+`
   <div class="notice ${settings.autoWhatsApp?'':'warning'}"><b>Pengiriman otomatis ${settings.autoWhatsApp?'aktif':'belum aktif'}.</b> Nomor harus diisi dan persetujuan orang tua dicentang. Pengirim Apps Script dan WhatsApp Business Platform harus dipasang mengikuti <a href="PANDUAN.html#whatsapp" target="_blank" rel="noopener">panduan WhatsApp</a>. Biaya Meta dapat berlaku. Status “Diterima API” belum membuktikan pesan diterima HP orang tua.</div>
   <div class="wa-summary">${[['Menunggu',c.pending||0],['Diterima API',c.accepted||0],['Gagal / perlu dicek',(c.error||0)+(c.uncertain||0)],['Tanpa nomor WA',active().filter(s=>!s.phone).length]].map(([l,n])=>`<article class="stat"><span class="stat-label">${l}</span><b class="stat-value">${n}</b></article>`).join('')}</div>
   <section class="panel"><div class="panel-head"><div><h2>Antrean hari ini</h2><p>Hanya dibuat saat scan RFID berhasil dan otomatis aktif</p></div><span class="pill neutral">${dateLabel(today())}</span></div>${messages.length?`<div class="table-wrap"><table><thead><tr><th>SISWA</th><th>WHATSAPP</th><th>ABSEN</th><th>STATUS PENGIRIMAN</th><th>KETERANGAN</th></tr></thead><tbody>${messages.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,500).map(m=>`<tr><td>${esc(m.name)}<small class="muted"> · ${esc(m.className)}</small></td><td class="mono">${esc(m.phone)}</td><td>${esc(m.event)} · ${esc(m.time)}</td><td><span class="pill ${(labels[m.status]||['','neutral'])[1]}">${(labels[m.status]||[esc(m.status)])[0]}</span></td><td style="white-space:normal;max-width:280px">${esc(m.error||m.providerId||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty('Antrean belum dimuat atau masih kosong','Klik Perbarui status. Siswa tanpa nomor tidak dibuatkan antrean.')}</section>
   <section class="panel"><div class="panel-head"><div><h2>Kirim manual melalui WhatsApp</h2><p>Alternatif tanpa API. Petugas menekan Kirim di WhatsApp.</p></div></div><div class="panel-body"><p class="muted" style="font-size:12px">Buka Rekap, tampilkan tanggal yang diperlukan, lalu klik tombol WhatsApp pada siswa yang sudah absen dan mempunyai nomor orang tua. Fitur ini tidak mengirim otomatis.</p><div class="spacer"></div><a class="btn secondary" href="#report">${icon('report')} Buka rekap</a></div></section>`;
 }
 function manualWA(id,date){
   const r=reportRows.find(r=>r.studentId===id&&r.date===date);if(!r?.phone)throw Error('Nomor WhatsApp orang tua belum diisi.');
   const text=`Assalamu’alaikum. Informasi absensi ${settings.schoolName}:\nNama: ${r.name}\nKelas: ${r.className}\nTanggal: ${dateLabel(date)}\nStatus: ${r.status}\nMasuk: ${r.inTime||'-'}\nPulang: ${r.outTime||'-'}\nTerima kasih.`;
   if(store.demo){dialog('Pratinjau pesan (demo)',`<p class="notice">Mode demo tidak membuka atau mengirim pesan ke nomor mana pun.</p><pre style="white-space:pre-wrap;font:13px/1.7 inherit">${esc(text)}</pre><div class="dialog-actions">${action('close','Tutup')}</div>`);return;}
   dialog('Kirim informasi ke orang tua',`<p class="subtitle">Tujuan: ${esc(r.phone)}</p><div class="spacer"></div><p style="white-space:pre-wrap;font-size:12px;line-height:1.8">${esc(text)}</p><div class="dialog-actions">${action('close','Batal')}<a class="btn" href="https://wa.me/${encodeURIComponent(r.phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Buka WhatsApp</a></div>`);
 }
 function renderSettings(){
   $('#main').innerHTML=head('Pengaturan','Sesuaikan identitas sekolah dan aturan absensi.')+`<form id="settings-form"><div class="settings-grid">
   <section class="panel"><div class="panel-head"><h2>Identitas sekolah</h2>${icon('class')}</div><div class="settings-body">${field('Nama sekolah','schoolName','text',settings.schoolName,'required maxlength="100"')}<div class="field"><label for="logo-file">Logo sekolah</label><div class="buttons"><img class="logo-preview" id="logo-preview" alt="Logo" src="${/^data:image\/(png|jpeg|webp);base64,/.test(settings.logo)?settings.logo:'assets/mark.svg'}"><input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp"></div><small>PNG/JPG/WebP. Logo diperkecil otomatis; tanpa Firebase Storage.</small><button type="button" class="btn tiny secondary" data-action="remove-logo" style="align-self:flex-start">Gunakan logo bawaan</button></div>${field('Warna utama','color','color',settings.color)}<div class="field"><label for="timezone">Zona waktu sekolah</label><select id="timezone" name="timezone">${[['Asia/Jakarta','WIB · Jakarta'],['Asia/Makassar','WITA · Makassar'],['Asia/Jayapura','WIT · Jayapura']].map(([v,l])=>`<option value="${v}" ${settings.timezone===v?'selected':''}>${l}</option>`).join('')}</select></div></div></section>
   <section class="panel"><div class="panel-head"><h2>Jam masuk dan pulang</h2>${icon('clock')}</div><div class="settings-body"><div class="form-grid">${field('Mulai masuk','inStart','time',settings.inStart,'required')}${field('Akhir masuk','inEnd','time',settings.inEnd,'required')}<div class="full">${field('Tepat waktu sampai pukul','lateAfter','time',settings.lateAfter,'required')}</div>${field('Mulai pulang','outStart','time',settings.outStart,'required')}${field('Akhir pulang','outEnd','time',settings.outEnd,'required')}</div><p class="subtitle">Jam akhir mencakup seluruh menit tersebut. Contoh: 08.00.59 masih diterima, 08.01 ditolak. Keterlambatan dimulai pada menit setelah batas tepat waktu.</p><div class="spacer"></div><label class="check-line"><input type="checkbox" name="voice" ${settings.voice?'checked':''}> Suara “absen berhasil”</label></div></section>
   <section class="panel"><div class="panel-head"><h2>Hari sekolah dan libur</h2>${icon('report')}</div><div class="settings-body"><p class="subtitle">Hari sekolah</p><div class="weekday">${['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((l,i)=>`<label><input type="checkbox" name="schoolDays" value="${i}" ${settings.schoolDays.includes(i)?'checked':''}>${l}</label>`).join('')}</div><div class="field"><label for="holidays">Tanggal libur (satu tanggal per baris)</label><textarea name="holidays" id="holidays" rows="4" placeholder="2026-12-25">${esc(settings.holidays.join('\n'))}</textarea><small>Gunakan YYYY-MM-DD. Tanggal ini tidak dihitung sebagai Alpa.</small></div></div></section>
   <section class="panel"><div class="panel-head"><h2>WhatsApp dan penyimpanan</h2>${icon('wa')}</div><div class="settings-body"><label class="check-line"><input name="autoWhatsApp" type="checkbox" ${settings.autoWhatsApp?'checked':''}> Buat antrean WhatsApp otomatis</label><p class="subtitle">Aktifkan setelah pengirim Apps Script dan API WhatsApp siap. Memerlukan nomor orang tua serta persetujuannya. Nomor kosong dilewati otomatis.</p><div class="spacer"></div><div class="notice">${store.demo?'Mode demo: perubahan hanya tersimpan di browser.':'Tersambung ke proyek: <b>'+esc(APP_CONFIG.firebase.projectId)+'</b>. Perubahan disimpan ke Firestore.'}</div><a href="PANDUAN.html#whatsapp" target="_blank" rel="noopener" style="font-size:12px">Buka panduan WhatsApp otomatis ↗</a></div></section></div>
   <div id="form-error" class="form-error" role="alert"></div><div class="buttons"><button type="submit" class="btn">${icon('check')} Simpan pengaturan</button>${store.demo?action('reset-demo','Atur ulang data demo','secondary'):''}</div></form>`;
   $('#settings-form').dataset.logo=settings.logo;
 }
 async function saveSettings(form){
   const f=new FormData(form),holidays=f.get('holidays').split(/[\s,]+/).filter(Boolean);
   for(const d of holidays)if(!C.validDate(d))throw Error('Tanggal libur harus valid dengan format YYYY-MM-DD.');
   const data={...settings,schoolName:f.get('schoolName').trim(),color:f.get('color'),timezone:f.get('timezone'),schoolDays:f.getAll('schoolDays').map(Number),holidays:[...new Set(holidays)],voice:!!f.get('voice'),autoWhatsApp:!!f.get('autoWhatsApp'),logo:form.dataset.logo||''};
   ['inStart','inEnd','lateAfter','outStart','outEnd'].forEach(k=>data[k]=f.get(k));C.validateSettings(data);
   await store.put('settings/school',data);settings=data;reportLoaded=false;render();toast('Pengaturan berhasil disimpan.');
 }
 async function uploadLogo(file){
   if(!file)return;if(file.size>5*1024*1024)throw Error('Logo maksimal 5 MB.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Gunakan PNG, JPG, atau WebP.');
   const url=URL.createObjectURL(file);
   try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,160/image.width,160/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);const logo=canvas.toDataURL('image/png');if(logo.length>100000)throw Error('Logo terlalu kompleks. Gunakan gambar lebih sederhana.');$('#settings-form').dataset.logo=logo;$('#logo-preview').src=logo;}finally{URL.revokeObjectURL(url);}
 }
 function loginDialog(){
   if(store.demo){dialog('Hubungkan Firebase',`<div class="notice">Aplikasi sedang berjalan dalam mode demo. Buka <b>app-config.js</b>, isi apiKey dan projectId milik sekolah, unggah ke GitHub, lalu muat ulang.</div><p class="muted">Petunjuk pembuatan database, akun petugas, dan pengaturan UID tersedia di panduan.</p><div class="dialog-actions">${action('close','Tutup','secondary')}<a class="btn" href="PANDUAN.html#firebase" target="_blank" rel="noopener">Buka panduan</a></div>`);return;}
   dialog('Masuk petugas sekolah',`<form id="login-form"><p class="subtitle" style="margin:0 0 20px">Gunakan akun yang dibuat di Firebase Authentication.</p><div class="form-grid"><div class="full">${field('Email petugas','email','email','','required autocomplete="username"')}</div><div class="full">${field('Kata sandi','password','password','','required autocomplete="current-password"')}</div></div><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><button type="submit" class="btn">Masuk dan buka data</button></div></form>`,true);
   $('#email').focus();
 }
 async function sync(){
   if(syncing)return;syncing=true;
   try{const [s,r,c]=await Promise.all([store.getStudents(),store.getRecords(today()),store.get('settings/school')]);students=s;settings={...C.defaults,...(c||{})};delete settings._version;records=r;if(today()!==C.parts().date)records=await store.getRecords(today());loaded=true;reportLoaded=false;render();toast('Data terbaru dimuat.');}
   catch(e){toast(B.explain(e),true);throw e;}finally{syncing=false;}
 }
 async function archiveStudent(id,restore=false){
   const s=students.find(x=>x.id===id);if(!s)return;
   dialog(restore?'Aktifkan siswa':'Arsipkan siswa',`<p>${restore?'Aktifkan kembali':'Arsipkan'} <b>${esc(s.name)}</b> (${esc(s.className)})?</p><p class="subtitle">Data absensi yang sudah tersimpan tetap dapat dibuka.</p><div id="form-error" class="form-error"></div><div class="dialog-actions">${action('close','Batal','secondary')}<button id="archive-confirm" class="btn">${restore?'Aktifkan':'Arsipkan siswa'}</button></div>`);
   $('#archive-confirm').addEventListener('click',e=>task(e.target,async()=>{const d={...s,inactiveOn:restore?'':today()};delete d._version;await store.saveStudent(d);students=await store.getStudents();reportLoaded=false;close();render();toast(restore?'Siswa diaktifkan.':'Siswa diarsipkan.');}));
 }
 $('#dialog-close').addEventListener('click',close);$('#dialog').addEventListener('cancel',e=>{if($('#dialog').dataset.lock==='1')e.preventDefault();});
 $('#mobile-menu').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#mobile-menu').setAttribute('aria-expanded',String(open));});
 $('#account-btn').addEventListener('click',()=>{if(store.demo||!store.session||!loaded)loginDialog();else dialog('Akun petugas',`<p>${esc(store.session.email)}</p><p class="subtitle">UID: <span class="mono">${esc(store.session.uid)}</span></p><div class="dialog-actions">${action('close','Tutup','secondary')}${action('logout','Keluar dari akun','danger')}</div>`);});
 window.addEventListener('hashchange',()=>{$('#sidebar').classList.remove('open');$('#mobile-menu').setAttribute('aria-expanded','false');render();});
 document.addEventListener('click',e=>{
   const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
   const handlers={close,login:loginDialog,sync:()=>sync(),'add-student':()=>studentForm(),'edit-student':()=>studentForm(b.dataset.id),'archive-student':()=>archiveStudent(b.dataset.id),'restore-student':()=>archiveStudent(b.dataset.id,true),template,import:importDialog,'student-prev':()=>{studentPage--;renderStudentTable();},'student-next':()=>{studentPage++;renderStudentTable();},'export-students':exportStudents,'test-voice':()=>speak(),'scan-mode':()=>{scanMode=b.dataset.mode;renderScanner();},fullscreen:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();},'demo-card':()=>{const s=active().find(s=>!records.some(r=>r.studentId===s.id&&r.date===today()));if(!s)throw Error('Semua siswa sudah memiliki catatan. Atur ulang demo di Pengaturan.');awaitScan(s.rfid);},'load-report':loadReport,'export-report':exportReport,'report-prev':()=>{reportPage--;renderReportContent();},'report-next':()=>{reportPage++;renderReportContent();},'correct-record':()=>correction(b.dataset.id,b.dataset.date),'manual-wa':()=>manualWA(b.dataset.id,b.dataset.date),'load-messages':async()=>{messages=await store.getMessages(today());renderWA();},'remove-logo':()=>{$('#settings-form').dataset.logo='';$('#logo-preview').src='assets/mark.svg';},'reset-demo':()=>{dialog('Data demo',`<p>Atur ulang semua siswa, absensi, dan pengaturan demo ke contoh awal?</p><div class="dialog-actions">${action('close','Batal','secondary')}${action('confirm-reset','Atur ulang','danger')}</div>`);},'confirm-reset':async()=>{store.reset();close();await sync();},logout:()=>{store.logout();loaded=false;students=[];records=[];messages=[];reportRows=[];reportLoaded=false;settings={...C.defaults};$('#dialog').close();render();loginDialog();}};
   if(handlers[a]){e.preventDefault();task(b,handlers[a]);}
 });
 function awaitScan(value){return scan(value);}
 document.addEventListener('submit',e=>{
   const f=e.target;if(!['student-form','scan-form','correction-form','settings-form','login-form'].includes(f.id))return;e.preventDefault();
   if(f.id==='scan-form'){scan($('#scan-input').value);return;}
   task(f.querySelector('[type=submit]'),async()=>{
     if($('#form-error'))$('#form-error').textContent='';
     if(f.id==='student-form')await saveStudentForm(f);
     if(f.id==='correction-form')await saveCorrection(f);
     if(f.id==='settings-form')await saveSettings(f);
     if(f.id==='login-form'){
       const d=new FormData(f);await store.login(d.get('email'),d.get('password'));
       try{await sync();$('#dialog').dataset.lock='';$('#dialog').close();}
       catch(e){$('#form-error').textContent=B.explain(e)+'\nUID akun Anda: '+store.session.uid;}
     }
   });
 });
 document.addEventListener('input',e=>{if(e.target.id==='student-search'){studentSearch=e.target.value;studentPage=1;renderStudentTable();}if(e.target.id==='simulation')simulation=e.target.value||'07:10';});
 document.addEventListener('change',e=>{
   if(e.target.id==='student-class'){studentClass=e.target.value;studentPage=1;renderStudentTable();}
   if(e.target.id==='archived-toggle'){showArchived=e.target.checked;studentPage=1;renderStudentTable();}
   if(e.target.id==='report-class'){reportClass=e.target.value;reportPage=1;renderReportContent();}
   if(e.target.id==='report-status'){reportFilter=e.target.value;reportPage=1;renderReportContent();}
   if(e.target.id==='report-from'||e.target.id==='report-to'){reportLoaded=false;reportRows=[];renderReportContent();}
   if(e.target.id==='logo-file')uploadLogo(e.target.files[0]).catch(errorForm);
 });
 setInterval(()=>{const p=C.parts(new Date(),settings.timezone);$('#top-clock').textContent=p.time.slice(0,5)+' '+({ 'Asia/Jakarta':'WIB','Asia/Makassar':'WITA','Asia/Jayapura':'WIT'}[settings.timezone]||'');if($('#terminal-clock'))$('#terminal-clock').textContent=p.time;if(p.date!==reportTo&&!reportLoaded){/* report dates only change when user chooses them */}if(lastMinute!==p.time.slice(0,5)){lastMinute=p.time.slice(0,5);if(loaded&&route()==='dashboard')renderDashboard();}},1000);
 window.addEventListener('offline',()=>toast('Internet terputus. Absen Firebase membutuhkan internet.',true));
 async function boot(){
   const config=APP_CONFIG.firebase,configured=config.apiKey&&!config.apiKey.startsWith('ISI_')&&config.projectId&&!config.projectId.startsWith('ISI_');
   store=configured?new B.FirebaseStore(config):new B.DemoStore();
   if(store.demo){await sync();}
   else if(store.restore()){try{await sync();}catch{render();loginDialog();}}
   else {render();loginDialog();}
 }
 boot().catch(e=>toast(B.explain(e),true));
})();
