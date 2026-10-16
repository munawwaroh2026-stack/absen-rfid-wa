(function (root) {
  'use strict';
  const defaults = {
    schoolName: 'SMP AL-MIFTAH KETAPANG', color: '#087f8c', logo: '',
    timezone: 'Asia/Jakarta', inStart: '07:00', lateAfter: '07:15', inEnd: '08:00',
    outStart: '10:00', outEnd: '12:00', schoolDays: [1,2,3,4,5,6], holidays: [],
    autoWhatsApp: false, voice: true
  };
  function parts(date = new Date(), timezone = defaults.timezone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(date).map(x => [x.type,x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}`, minutes:Number(p.hour)*60+Number(p.minute) };
  }
  const minutes = t => Number(t.slice(0,2))*60+Number(t.slice(3,5));
  function validDate(d) {if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const n=new Date(d+'T12:00:00Z');return !isNaN(n)&&n.toISOString().slice(0,10)===d;}
  function rfid(value) {
    const v = String(value ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,64}$/.test(v)) throw Error('ID RFID harus 1–64 karakter huruf/angka, tanpa spasi.');
    return v;
  }
  function phone(value) {
    let v=String(value ?? '').trim();
    if (!v) return '';
    v=v.replace(/[\s()+.-]/g,'');
    if(v.startsWith('0'))v='62'+v.slice(1);
    if(!/^\d{8,15}$/.test(v))throw Error('Nomor WhatsApp tidak valid. Contoh: 081234567890.');
    return v;
  }
  function schoolDay(date,settings) {
    return settings.schoolDays.includes(new Date(date+'T12:00:00Z').getUTCDay()) && !settings.holidays.includes(date);
  }
  function validateSettings(s) {
    if(!s.schoolName.trim() || s.schoolName.length>100)throw Error('Nama sekolah harus diisi, maksimal 100 karakter.');
    for(const k of ['inStart','lateAfter','inEnd','outStart','outEnd'])if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k]))throw Error('Format jam tidak valid.');
    if(!(s.inStart<=s.lateAfter && s.lateAfter<=s.inEnd && s.inEnd<s.outStart && s.outStart<s.outEnd))throw Error('Urutan waktu harus: mulai masuk ≤ batas terlambat ≤ akhir masuk < mulai pulang < akhir pulang.');
    if(!s.schoolDays.length)throw Error('Pilih minimal satu hari sekolah.');
    if(!/^#[\da-f]{6}$/i.test(s.color))throw Error('Warna tidak valid.');
    new Intl.DateTimeFormat('id',{timeZone:s.timezone}).format();
    return s;
  }
  function decideScan(student,old,settings,now,requested='auto') {
    const p=parts(now,settings.timezone);
    if(!schoolDay(p.date,settings))throw Error('Hari ini bukan hari sekolah. Periksa pengaturan hari atau libur.');
    if(student.inactiveOn && student.inactiveOn<=p.date)throw Error('Siswa sudah diarsipkan.');
    let mode=requested;
    if(mode==='auto') {
      if(p.minutes>=minutes(settings.inStart) && p.minutes<=minutes(settings.inEnd))mode='in';
      else if(p.minutes>=minutes(settings.outStart) && p.minutes<=minutes(settings.outEnd))mode='out';
      else throw Error(`Di luar jadwal. Masuk ${settings.inStart}–${settings.inEnd}, pulang ${settings.outStart}–${settings.outEnd}.`);
    }
    const start=mode==='in'?settings.inStart:settings.outStart;
    const end=mode==='in'?settings.inEnd:settings.outEnd;
    if(p.minutes<minutes(start)||p.minutes>minutes(end))throw Error(`Absen ${mode==='in'?'masuk':'pulang'} hanya ${start}–${end}.`);
    if(old && ['Izin','Sakit'].includes(old.status))throw Error('Siswa tercatat izin/sakit. Koreksi status dahulu di Rekap.');
    if(mode==='in'&&old?.inTime)throw Error('Absen masuk sudah tercatat. Tidak ada data atau notifikasi ganda.');
    if(mode==='out'&&!old?.inTime)throw Error('Absen masuk belum tercatat. Hubungi petugas untuk koreksi.');
    if(mode==='out'&&old?.outTime)throw Error('Absen pulang sudah tercatat. Tidak ada data atau notifikasi ganda.');
    const id=`${p.date}_${student.id}`;
    const record={...(old||{}),id,studentId:student.id,name:student.name,className:student.className,rfid:student.rfid,
      date:p.date, status:mode==='in'?(p.minutes>minutes(settings.lateAfter)?'Terlambat':'Hadir'):old.status,
      inTime:mode==='in'?p.time:old.inTime,outTime:mode==='out'?p.time:(old?.outTime||''),
      note:old?.note||'',updatedAt:now.toISOString(),source:'RFID USB'};
    return {record,mode,eventId:`${id}_${mode}`,time:p.time};
  }
  function eligible(s,date) {return (!s.enrolledOn||s.enrolledOn<=date)&&(!s.inactiveOn||s.inactiveOn>date);}
  function profileAt(s,date) {
    const h=(s.history||[]).filter(x=>x.from<=date).sort((a,b)=>a.from.localeCompare(b.from)).at(-1);
    return h?{...s,name:h.name,className:h.className}:s;
  }
  function dayRows(students,records,date,settings,now=new Date()) {
    const p=parts(now,settings.timezone), map=new Map(records.filter(r=>r.date===date).map(r=>[r.studentId,r]));
    const roster=new Map(students.filter(s=>eligible(s,date)).map(s=>[s.id,profileAt(s,date)]));
    for(const r of map.values())if(!roster.has(r.studentId))roster.set(r.studentId,{id:r.studentId,name:r.name,className:r.className,rfid:r.rfid,phone:''});
    return [...roster.values()].map(s=>{
      const r=map.get(s.id);
      const status=r?.status||(schoolDay(date,settings)?(date<p.date||(date===p.date&&p.minutes>minutes(settings.inEnd))?'Alpa':'Belum absen'):'Libur');
      return {...s,studentId:s.id,...r,date,status,inTime:r?.inTime||'',outTime:r?.outTime||'',note:r?.note||''};
    }).sort((a,b)=>a.className.localeCompare(b.className,'id',{numeric:true})||a.name.localeCompare(b.name,'id'));
  }
  function dateRange(from,to) {
    if(!validDate(from)||!validDate(to)||from>to)throw Error('Rentang tanggal tidak valid.');
    const a=[];let d=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z');
    while(d<=end){a.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);if(a.length>31)throw Error('Rekap maksimal 31 hari per pengambilan.');}
    return a;
  }
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  root.AttendanceCore={defaults,parts,minutes,validDate,rfid,phone,schoolDay,validateSettings,decideScan,dayRows,dateRange,escape,eligible,profileAt};
})(globalThis);
