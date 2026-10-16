(function(root){
 'use strict';
 const C=root.AttendanceCore;
 function pack(v){
   if(v===null||v===undefined)return {nullValue:null};
   if(typeof v==='boolean')return {booleanValue:v};
   if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
   if(Array.isArray(v))return {arrayValue:{values:v.map(pack)}};
   if(typeof v==='object')return {mapValue:{fields:fields(v)}};
   return {stringValue:String(v)};
 }
 const fields=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined).map(([k,v])=>[k,pack(v)]));
 function unpack(v){
   if('stringValue'in v)return v.stringValue;
   if('integerValue'in v)return Number(v.integerValue);
   if('doubleValue'in v)return v.doubleValue;
   if('booleanValue'in v)return v.booleanValue;
   if('arrayValue'in v)return (v.arrayValue.values||[]).map(unpack);
   if('mapValue'in v)return decode(v.mapValue.fields||{});
   if('timestampValue'in v)return v.timestampValue;
   return null;
 }
 const decode=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,unpack(v)]));
 function explain(e){
   const s=String(e);
   if(/PERMISSION_DENIED|403/.test(s))return 'Akses Firestore ditolak. Pastikan UID admin sudah ditempel ke firestore.rules lalu Publish.';
   if(/NOT_FOUND|404/.test(s))return 'Database tidak ditemukan. Buat Firestore Standard (default), lalu periksa projectId di app-config.js.';
   if(/RESOURCE_EXHAUSTED|429/.test(s))return 'Kuota Firebase habis atau terlalu banyak permintaan. Cek tab Usage lalu coba lagi nanti.';
   if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(s))return 'Email atau kata sandi salah.';
   if(/Failed to fetch|NetworkError|fetch failed/.test(s))return 'Koneksi internet terputus. Absen belum dinyatakan berhasil. Sambungkan lalu tempel ulang kartu.';
   return s.replace(/^Error:\s*/,'');
 }
 class FirebaseStore{
  constructor(config){this.config=config;this.demo=false;this.session=null;this.refreshing=null;this.db=`projects/${config.projectId}/databases/${config.databaseId||'(default)'}/documents`;this.url=`https://firestore.googleapis.com/v1/${this.db}`;}
  async login(email,password){
    const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(this.config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(20000)});
    const j=await r.json();if(!r.ok)throw Error(explain(j.error?.message));
    this.session={idToken:j.idToken,refreshToken:j.refreshToken,uid:j.localId,email:j.email,expires:Date.now()+Number(j.expiresIn)*1000};this.persist();
  }
  persist(){sessionStorage.setItem('almiftah-session',JSON.stringify({...this.session,projectId:this.config.projectId}));}
  restore(){try{const s=JSON.parse(sessionStorage.getItem('almiftah-session'));if(s?.projectId===this.config.projectId)this.session=s;}catch{}return !!this.session;}
  logout(){this.session=null;sessionStorage.removeItem('almiftah-session');}
  async token(){
    if(!this.session)throw Error('Silakan masuk kembali.');
    if(this.session.expires>Date.now()+90000)return this.session.idToken;
    if(!this.refreshing)this.refreshing=(async()=>{
      const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.session.refreshToken}),signal:AbortSignal.timeout(20000)});
      const j=await r.json();if(!r.ok){this.logout();throw Error('Sesi berakhir. Silakan masuk kembali.');}
      this.session.idToken=j.id_token;this.session.refreshToken=j.refresh_token;this.session.expires=Date.now()+Number(j.expires_in)*1000;this.persist();return j.id_token;
    })().finally(()=>this.refreshing=null);
    return this.refreshing;
  }
  async api(path='',method='GET',body,missing=false){
    const token=await this.token();let r;
    try{r=await fetch(this.url+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});}catch(e){throw Error(explain(e));}
    if(missing&&r.status===404)return null;
    const j=await r.json();if(!r.ok){const e=Error(explain(j.error?.status+': '+j.error?.message));e.status=j.error?.status;e.http=r.status;throw e;}return j;
  }
  async get(path){const j=await this.api('/'+path,'GET',undefined,true);return j?{...decode(j.fields),_version:j.updateTime}:null;}
  write(path,data,version,create=false){const clean={...data};delete clean._version;return {update:{name:this.db+'/'+path,fields:fields(clean)},...(create?{currentDocument:{exists:false}}:version?{currentDocument:{updateTime:version}}:{})};}
  async commit(writes){return this.api(':commit','POST',{writes});}
  async put(path,data,version){await this.commit([this.write(path,data,version)]);}
  async query(collection,where){
    const query={from:[{collectionId:collection}],...(where?{where}:{})};
    const j=await this.api(':runQuery','POST',{structuredQuery:query});
    return j.filter(x=>x.document).map(x=>({...decode(x.document.fields),_version:x.document.updateTime}));
  }
  async getStudents(){return this.query('students');}
  async getRecords(from,to=from){
    const f=(op,value)=>({fieldFilter:{field:{fieldPath:'date'},op,value:{stringValue:value}}});
    return this.query('attendance',from===to?f('EQUAL',from):{compositeFilter:{op:'AND',filters:[f('GREATER_THAN_OR_EQUAL',from),f('LESS_THAN_OR_EQUAL',to)]}});
  }
  async saveStudents(list){
    let done=0;
    for(let i=0;i<list.length;i+=100){const batch=list.slice(i,i+100);await this.commit(batch.map(s=>this.write('students/'+s.id,s,null,true)));done+=batch.length;}
    return done;
  }
  async saveStudent(s,create=false){const old=create?null:await this.get('students/'+s.id);await this.commit([this.write('students/'+s.id,s,old?._version,create||!old)]);}
  async saveRecord(record,old){const d={...record};delete d._version;await this.commit([this.write('attendance/'+d.id,d,old?._version,!old)]);}
  async scan(student,settings,now,mode){
    for(let attempt=0;attempt<3;attempt++){
      const date=C.parts(now,settings.timezone).date;
      const old=await this.get('attendance/'+date+'_'+student.id);
      const result=C.decideScan(student,old,settings,now,mode);
      const writes=[this.write('attendance/'+result.record.id,result.record,old?._version,!old)];
      if(settings.autoWhatsApp&&student.phone&&student.waConsent)writes.push(this.write('outbox/'+result.eventId,makeMessage(student,settings,result),null,true));
      try{await this.commit(writes);return result;}catch(e){if(!['FAILED_PRECONDITION','ABORTED','ALREADY_EXISTS'].includes(e.status))throw e;}
    }
    throw Error('Data berubah dari perangkat lain. Tempelkan ulang kartu untuk mengecek status.');
  }
  async getMessages(date){return this.query('outbox',{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:date}}});}
 }
 function makeMessage(s,settings,result){return {id:result.eventId,date:result.record.date,studentId:s.id,name:s.name,className:s.className,phone:s.phone,schoolName:settings.schoolName,event:result.mode==='in'?'Masuk':'Pulang',time:result.time,statusText:result.record.status,status:'pending',attempts:0,createdAt:result.record.updatedAt,updatedAt:result.record.updatedAt,error:'',providerId:''};}
 class DemoStore{
  constructor(){this.demo=true;this.session={email:'Petugas demo'};try{this.data=JSON.parse(localStorage.getItem('almiftah-demo-v1'));}catch{}if(!this.data)this.reset();}
  persist(){localStorage.setItem('almiftah-demo-v1',JSON.stringify(this.data));}
  reset(){
    const today=C.parts().date;
    const names=['Ahmad Fikri','Aisyah Putri','Muhammad Rizki','Siti Amina','Fajar Maulana','Nur Azizah','Hasan Basri','Zahra Safira','Rafi Pratama','Nabila Rahma','Farhan Akbar','Dinda Salma'];
    this.data={settings:{...C.defaults},students:names.map((name,i)=>({id:'000123'+String(i+1).padStart(4,'0'),rfid:'000123'+String(i+1).padStart(4,'0'),name,className:['VII A','VII B','VIII A'][Math.floor(i/4)],phone:'',waConsent:false,enrolledOn:today,history:[{from:today,name,className:['VII A','VII B','VIII A'][Math.floor(i/4)]}],inactiveOn:''})),records:[],messages:[]};
    this.data.students.slice(0,8).forEach((s,i)=>this.data.records.push({id:today+'_'+s.id,studentId:s.id,name:s.name,className:s.className,rfid:s.rfid,date:today,status:i===3?'Terlambat':i===6?'Izin':i===7?'Sakit':'Hadir',inTime:i>=6?'':i===3?'07:25:12':'07:0'+i+':20',outTime:'',note:i>=6?'Contoh keterangan':'',source:'Data contoh',updatedAt:new Date().toISOString()}));
    this.persist();
  }
  logout(){}
  async get(path){return path==='settings/school'?this.data.settings:this.data.records.find(r=>'attendance/'+r.id===path)||null;}
  async put(path,d){if(path==='settings/school')this.data.settings={...d};this.persist();}
  async getStudents(){return structuredClone(this.data.students);}
  async getRecords(from,to=from){return structuredClone(this.data.records.filter(r=>r.date>=from&&r.date<=to));}
  async saveStudents(list){for(const s of list)await this.saveStudent(s);return list.length;}
  async saveStudent(s){this.data.students=this.data.students.filter(x=>x.id!==s.id).concat(s);this.persist();}
  async saveRecord(r){this.data.records=this.data.records.filter(x=>x.id!==r.id).concat(r);this.persist();}
  async scan(s,settings,now,mode){const date=C.parts(now,settings.timezone).date,old=this.data.records.find(x=>x.id===date+'_'+s.id);const result=C.decideScan(s,old,settings,now,mode);await this.saveRecord(result.record);if(settings.autoWhatsApp&&s.phone&&s.waConsent){this.data.messages.push({...makeMessage(s,settings,result),status:'demo'});this.persist();}return result;}
  async getMessages(date){return structuredClone(this.data.messages.filter(m=>m.date===date));}
 }
 root.AttendanceBackend={FirebaseStore,DemoStore,fields,decode,explain};
})(globalThis);
