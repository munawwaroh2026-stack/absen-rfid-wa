/**
 * Pengirim antrean absensi melalui WhatsApp Cloud API resmi.
 * Tidak perlu Firebase Blaze / Firebase Functions / deployment Web App.
 * Rahasia hanya di Project Settings > Script properties. Lihat PANDUAN.html.
 * Status accepted berarti diterima API, bukan bukti diterima HP.
 */
function konfigurasi_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  ['FIREBASE_API_KEY','FIREBASE_PROJECT_ID','FIREBASE_SENDER_EMAIL',
   'FIREBASE_SENDER_PASSWORD','META_ACCESS_TOKEN','META_PHONE_NUMBER_ID',
   'META_API_VERSION','META_TEMPLATE_NAME','META_TEMPLATE_LANGUAGE'].forEach(function(k) {
    if (!p[k] || /^ISI_|^GANTI_/.test(p[k])) throw new Error('Isi Script Property: ' + k);
  });
  if (!/^v\d+\.\d+$/.test(p.META_API_VERSION)) throw new Error('META_API_VERSION harus seperti v24.0; salin versi yang aktif dari contoh request di Meta.');
  if (!/^\d+$/.test(p.META_PHONE_NUMBER_ID)) throw new Error('META_PHONE_NUMBER_ID harus ID pengirim dari Meta, bukan nomor WhatsApp.');
  p.db = 'projects/' + p.FIREBASE_PROJECT_ID + '/databases/(default)/documents';
  return p;
}

function tokenFirebase_(p) {
  const cache = CacheService.getScriptCache();
  const key = 'id-token-' + p.FIREBASE_PROJECT_ID + '-' + p.FIREBASE_SENDER_EMAIL;
  const cached = cache.get(key); if (cached) return cached;
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(p.FIREBASE_API_KEY), {
    method:'post', contentType:'application/json', muteHttpExceptions:true,
    payload: JSON.stringify({email:p.FIREBASE_SENDER_EMAIL,password:p.FIREBASE_SENDER_PASSWORD,returnSecureToken:true})
  });
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200 || !j.idToken) throw new Error('Login pengirim Firebase gagal. Periksa API key, akun Email/Password pengirim, dan pembatasan API key.');
  cache.put(key,j.idToken,3000); return j.idToken;
}

function firestore_(p,token,path,body) {
  const r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/' + p.db + path, {
    method: body === undefined ? 'get' : 'post', contentType:'application/json',
    headers:{Authorization:'Bearer ' + token}, muteHttpExceptions:true,
    ...(body === undefined ? {} : {payload:JSON.stringify(body)})
  });
  const code = r.getResponseCode();
  if (code < 200 || code >= 300) {
    const detail = code === 404 ? 'Buat Firestore Standard dengan ID (default); periksa projectId.' :
      code === 403 ? 'Periksa UID akun pengirim di fungsi sender() pada Firestore Rules.' :
      code === 429 ? 'Kuota atau batas permintaan Firestore tercapai.' : 'Periksa eksekusi, koneksi, dan konfigurasi.';
    throw new Error('Firestore HTTP ' + code + '. ' + detail);
  }
  return JSON.parse(r.getContentText());
}

function nilai_(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  return null;
}
function data_(doc) {
  const o = {}; Object.keys(doc.fields || {}).forEach(function(k){o[k] = nilai_(doc.fields[k]);});
  o._name = doc.name; o._version = doc.updateTime; return o;
}
function ubah_(name,values,version) {
  const fields = {}; Object.keys(values).forEach(function(k) {
    fields[k] = typeof values[k] === 'number' ? {integerValue:String(values[k])} : {stringValue:String(values[k])};
  });
  return {update:{name:name,fields:fields},updateMask:{fieldPaths:Object.keys(values)},
    ...(version ? {currentDocument:{updateTime:version}} : {})};
}
function cari_(p,token,status,limit) {
  const rows = firestore_(p,token,':runQuery',{structuredQuery:{
    from:[{collectionId:'outbox'}],where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:status}}},limit:limit
  }});
  return rows.filter(function(x){return x.document;}).map(function(x){return data_(x.document);});
}

/** Uji Firebase saja; tidak mengirim WhatsApp. Jalankan dahulu. */
function cekKoneksi() {
  const p = konfigurasi_(), token = tokenFirebase_(p);
  firestore_(p,token,'/settings/school');
  cari_(p,token,'pending',1);
  console.log('Koneksi Firebase berhasil. Aturan pengirim dan database dapat diakses. Pengujian ini belum mengirim WhatsApp.');
}

/** Pasang satu pemicu per menit. Tidak melakukan deploy sebagai web app. */
function pasangPemicu() {
  cekKoneksi();
  hapusPemicu();
  ScriptApp.newTrigger('prosesAntrean').timeBased().everyMinutes(1).create();
  console.log('Pemicu terpasang. Antrean diproses pukul 06.00–14.59 pada zona waktu sekolah.');
}
function hapusPemicu() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'prosesAntrean') ScriptApp.deleteTrigger(t);
  });
}

/**
 * Claim Firestore dengan prasyarat versi + lock mencegah proses ganda.
 * Sekali batch 20 pesan. Tidak melakukan retry buta jika hasil API tidak pasti.
 */
function prosesAntrean() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
  try {
    const p = konfigurasi_(), token = tokenFirebase_(p);
    const config = data_(firestore_(p,token,'/settings/school'));
    if (!config.autoWhatsApp) return;
    const timezone = config.timezone || 'Asia/Jakarta';
    const hour = Number(Utilities.formatDate(new Date(),timezone,'HH'));
    if (hour < 6 || hour > 14) return;
    const now = new Date().toISOString();
    // Proses yang terhenti tidak dikirim ulang otomatis; hasil sebelumnya mungkin sudah diterima Meta.
    const stalled = cari_(p,token,'processing',20).filter(function(m){return Date.now()-Date.parse(m.claimedAt || m.updatedAt)>10*60*1000;});
    if (stalled.length) firestore_(p,token,':commit',{writes:stalled.map(function(m){return ubah_(m._name,{status:'uncertain',updatedAt:now,error:'Proses terhenti. Periksa penerimaan pesan sebelum mengirim ulang secara manual.'},m._version);})});
    const jobs = cari_(p,token,'pending',20);
    if (!jobs.length) return;
    const claims = firestore_(p,token,':commit',{writes:jobs.map(function(m){return ubah_(m._name,{status:'processing',claimedAt:now,updatedAt:now,attempts:(m.attempts||0)+1},m._version);})});
    jobs.forEach(function(m,i){m._claimedVersion=claims.writeResults[i].updateTime;});
    const docs = firestore_(p,token,':batchGet',{documents:jobs.map(function(m){return p.db+'/attendance/'+m.date+'_'+m.studentId;})});
    const attendance = {}; docs.forEach(function(d){if(d.found)attendance[d.found.name]=data_(d.found);});
    const valid=[], writes=[];
    jobs.forEach(function(m) {
      const r = attendance[p.db+'/attendance/'+m.date+'_'+m.studentId];
      const eventTime = r && (m.event === 'Masuk' ? r.inTime : r.outTime);
      const stale = Date.now()-Date.parse(m.createdAt)>24*60*60*1000;
      if (!r || eventTime!==m.time || r.status!==m.statusText || r.source!=='RFID USB' || stale || (m.attempts||0)>=3) {
        writes.push(ubah_(m._name,{status:'cancelled',updatedAt:now,error:stale?'Antrean lebih dari 24 jam.':'Catatan berubah, dikoreksi, atau batas percobaan tercapai.'},m._claimedVersion));
      } else valid.push(m);
    });
    if (valid.length) {
      const requests = valid.map(function(m) {
        return {url:'https://graph.facebook.com/'+p.META_API_VERSION+'/'+p.META_PHONE_NUMBER_ID+'/messages',
          method:'post',contentType:'application/json',muteHttpExceptions:true,
          headers:{Authorization:'Bearer '+p.META_ACCESS_TOKEN},payload:JSON.stringify({messaging_product:'whatsapp',to:m.phone,type:'template',template:{
            name:p.META_TEMPLATE_NAME,language:{code:p.META_TEMPLATE_LANGUAGE},
            components:[{type:'body',parameters:[m.schoolName,m.name,m.className,m.date,m.event,m.time,m.statusText].map(function(t){return {type:'text',text:t};})}]
          }})};
      });
      try {
        const responses = UrlFetchApp.fetchAll(requests);
        responses.forEach(function(response,i) {
          const m=valid[i],code=response.getResponseCode();let j={};try{j=JSON.parse(response.getContentText());}catch(ignore){}
          const id=j.messages && j.messages[0] && j.messages[0].id;
          const accepted=code>=200&&code<300&&id;
          // 5xx / respons aneh tidak boleh dicoba ulang otomatis karena hasil bisa ambigu.
          const uncertain=code>=500||(code>=200&&code<300&&!id);
          writes.push(ubah_(m._name,{status:accepted?'accepted':uncertain?'uncertain':'error',updatedAt:new Date().toISOString(),providerId:id||'',error:accepted?'':('Meta HTTP '+code+(j.error&&j.error.code?' · kode '+j.error.code:'')+'. '+(uncertain?'Hasil tidak pasti. Periksa sebelum kirim ulang.':'Periksa token, template, penerima, izin, saldo, atau batas akun di Meta.'))},m._claimedVersion));
        });
      } catch (error) {
        valid.forEach(function(m){writes.push(ubah_(m._name,{status:'uncertain',updatedAt:new Date().toISOString(),error:'Koneksi Meta terputus; penerimaan belum diketahui. Periksa sebelum kirim ulang.'},m._claimedVersion));});
      }
    }
    if (writes.length) firestore_(p,token,':commit',{writes:writes});
    console.log('Batch selesai: '+jobs.length+' antrean diperiksa. Status accepted adalah diterima API, bukan bukti pesan dibaca/diterima HP.');
  } finally {lock.releaseLock();}
}
