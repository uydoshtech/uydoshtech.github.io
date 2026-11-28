(() => {
  const R=CityRadarUI,$=id=>document.getElementById(id),create=/\/create-gathering\.html$/.test(location.pathname);
  const copy={
    ru:{title:'Собираю компанию',intro:'Придумай план — найдём тех, кто пойдёт с тобой.',name:'Название встречи',nameHint:'Мафия у меня дома',description:'Что будем делать?',descriptionHint:'Какая игра или куда идём? Что взять с собой? Не указывайте здесь точный домашний адрес.',category:'Категория',date:'Дата и время · Ташкент (UTC+5)',venue:'Район или публичное место',venueHint:'Ташкент, Юнусабад',private:'Точный адрес и детали для участников',privateHint:'Увидят только принятые участники.',capacity:'Всего мест, включая вас',price:'Стоимость участия, сум',priceHint:'0 — бесплатно, пусто — пока неизвестно',publish:'Опубликовать встречу',login:'Откройте Mini App в Telegram, чтобы создать встречу или подать заявку.',join:'Хочу с вами',pending:'Заявка отправлена. Ждём решения организатора.',approved:'Вы в компании! До встречи.',rejected:'Организатор отклонил заявку.',leave:'Отозвать заявку / выйти',closed:'Встреча завершена или удалена.',full:'Свободных мест пока нет',requests:'Заявки и участники',empty:'Заявок пока нет. Поделитесь ссылкой на встречу.',approve:'Принять',reject:'Отклонить',remove:'Убрать участника',confirmed:'Принят',waiting:'Ожидает',organizer:'Организатор',places:'Свободных мест',refresh:'Обновить',shared:'Ссылка скопирована',share:'Поделиться встречей',address:'Место встречи · для участников',removeConfirm:'Удалить встречу из афиши?',error:'Не удалось выполнить действие. Обновите страницу и попробуйте ещё раз.',saved:'Встреча удалена из афиши.',joinInfo:'Присоединение по заявке. Точный адрес откроется после одобрения.'},
    en:{title:'Find your people',intro:'Make a plan and find someone to join you.',name:'Gathering title',nameHint:'Mafia night at my place',description:'What is the plan?',descriptionHint:'What will you play or where will you go? Keep your exact home address private.',category:'Category',date:'Date and time · Tashkent (UTC+5)',venue:'Area or public venue',venueHint:'Tashkent, Yunusabad',private:'Exact address and participant details',privateHint:'Only approved participants can see this.',capacity:'Total places, including you',price:'Price per person, UZS',priceHint:'0 = free; leave empty if unknown',publish:'Publish gathering',login:'Open the Mini App in Telegram to create a gathering or request to join.',join:'Count me in',pending:'Request sent. Waiting for the organizer.',approved:'You are in! See you there.',rejected:'The organizer declined your request.',leave:'Withdraw request / leave',closed:'This gathering has ended or been removed.',full:'No places available',requests:'Requests and participants',empty:'No requests yet. Share your gathering link.',approve:'Accept',reject:'Decline',remove:'Remove participant',confirmed:'Accepted',waiting:'Pending',organizer:'Organizer',places:'Places available',refresh:'Refresh',shared:'Link copied',share:'Share gathering',address:'Meeting place · participants only',removeConfirm:'Remove this gathering from the feed?',error:'Could not complete the action. Refresh and try again.',saved:'Gathering removed from the feed.',joinInfo:'The organizer approves requests. The exact address is shown after approval.'},
    uz:{title:'Birga boramiz',intro:'Reja tuzing va sizga qo‘shiladiganlarni toping.',name:'Uchrashuv nomi',nameHint:'Uyimda mafiya o‘yini',description:'Nima qilamiz?',descriptionHint:'Qaysi o‘yin yoki qayerga boramiz? Aniq uy manzilini bu yerga yozmang.',category:'Turkum',date:'Sana va vaqt · Toshkent (UTC+5)',venue:'Tuman yoki jamoat joyi',venueHint:'Toshkent, Yunusobod',private:'Aniq manzil va ishtirokchilar uchun tafsilotlar',privateHint:'Faqat tasdiqlangan ishtirokchilar ko‘radi.',capacity:'Jami joylar, siz bilan birga',price:'Ishtirok narxi, so‘m',priceHint:'0 — bepul, noma’lum bo‘lsa bo‘sh qoldiring',publish:'Uchrashuvni e’lon qilish',login:'Uchrashuv yaratish yoki ariza yuborish uchun Telegram Mini App’ni oching.',join:'Qo‘shilmoqchiman',pending:'Ariza yuborildi. Tashkilotchi javobini kuting.',approved:'Siz qabul qilindingiz!',rejected:'Tashkilotchi arizani rad etdi.',leave:'Arizani bekor qilish / chiqish',closed:'Uchrashuv tugagan yoki o‘chirilgan.',full:'Bo‘sh joy yo‘q',requests:'Arizalar va ishtirokchilar',empty:'Hozircha arizalar yo‘q. Havolani ulashing.',approve:'Qabul qilish',reject:'Rad etish',remove:'Ishtirokchini chiqarish',confirmed:'Qabul qilindi',waiting:'Kutilmoqda',organizer:'Tashkilotchi',places:'Bo‘sh joylar',refresh:'Yangilash',shared:'Havola nusxalandi',share:'Uchrashuvni ulashish',address:'Uchrashuv joyi · ishtirokchilar uchun',removeConfirm:'Uchrashuv afishadan o‘chirilsinmi?',error:'Amal bajarilmadi. Sahifani yangilab qayta urinib ko‘ring.',saved:'Uchrashuv afishadan o‘chirildi.',joinInfo:'Qo‘shilish ariza orqali. Aniq manzil tasdiqlangandan keyin ko‘rinadi.'}
  };
  const t=key=>(copy[UyDosh.getLang?.()]||copy.ru)[key];
  let authenticated=false,busy=false,event=null;
  const id=new URLSearchParams(location.search).get('id');
  const note=text=>{$('radar-status').textContent=text;};
  function decorateButton(b,icon,tone){
    b.className=`${b.className||''} radar-gathering-action radar-gathering-action--${tone}`.trim();
    const symbol=R.node('span',null,'radar-action-icon');symbol.setAttribute('aria-hidden','true');
    symbol.innerHTML=icon==='check'?UyDosh.iconCheck?.()||'':icon==='trash'?UyDosh.iconTrash?.()||'':icon==='minus'?UyDosh.iconMinus?.()||'':UyDosh.iconChrome?.(icon)||'';
    b.prepend(symbol);return b;
  }
  function button(label,action,cls='',icon='refresh',tone='blue'){
    const b=decorateButton(R.node('button',label,cls),icon,tone);b.type='button';b.addEventListener('click',action);return b;
  }
  async function mutate(path,body){
    if(busy)return;busy=true;
    const buttons=[...document.querySelectorAll('#radar-list button')];buttons.forEach(b=>b.disabled=true);
    try{await UyDosh.communityEvent(path,{method:'POST',body});await load();}
    catch{note(t('error'));}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  function form(){
    const wrap=R.node('section',null,'radar-card');
    wrap.append(R.node('h1',t('title')),R.node('p',t('intro')));
    if(!authenticated){wrap.append(R.node('p',t('login')));$('radar-list').replaceChildren(wrap);return;}
    const f=R.node('form',null,'radar-form');wrap.append(f);
    const field=(label,tag,type,max,hint)=>{
      const l=R.node('label',label),i=R.node(tag);if(type)i.type=type;if(max)i.maxLength=max;if(hint)i.placeholder=hint;
      l.append(i);f.append(l);return i;
    };
    const name=field(t('name'),'input','text',200,t('nameHint'));name.required=true;name.minLength=3;
    const description=field(t('description'),'textarea',null,3000,t('descriptionHint'));description.required=true;description.minLength=10;
    const category=field(t('category'),'select');for(const c of R.categories){const o=R.node('option',R.category(c));o.value=c;category.append(o);}category.value='board_games_and_social';
    const date=field(t('date'),'input','datetime-local');date.required=true;
    const venue=field(t('venue'),'input','text',200,t('venueHint'));venue.required=true;venue.minLength=2;
    const privateLocation=field(t('private'),'textarea',null,500,t('privateHint'));
    const capacity=field(t('capacity'),'input','number');capacity.min=2;capacity.max=50;capacity.step=1;capacity.value=6;capacity.required=true;
    const price=field(t('price'),'input','number');price.min=0;price.max=1000000000;price.step='any';price.placeholder=t('priceHint');
    f.append(R.node('p',t('joinInfo'),'radar-muted'));
    const submit=decorateButton(R.node('button',t('publish')),'paperPlane','purple');submit.type='submit';f.append(submit);
    const requestId=crypto.randomUUID();
    f.addEventListener('submit',async e=>{
      e.preventDefault();if(busy||!f.reportValidity())return;busy=true;submit.disabled=true;note(R.t('loading'));
      try{
        const starts_at=`${date.value}:00+05:00`;
        const result=await UyDosh.communityEvent('',{method:'POST',body:{request_id:requestId,title:name.value.trim(),description:description.value.trim(),category:category.value,starts_at,venue:venue.value.trim(),private_location:privateLocation.value.trim()||null,capacity:Number(capacity.value),price:price.value===''?null:{amount:Number(price.value),currency:'UZS'}}});
        location.href=`/telegram/gathering.html?id=${encodeURIComponent(result.id)}`;
      }catch{note(t('error'));busy=false;submit.disabled=false;}
    });
    $('radar-list').replaceChildren(wrap);
  }
  function render(){
    const panel=R.node('section');panel.append(R.card(event,true));
    panel.append(R.node('p',event.description,'radar-gathering-description'));
    panel.append(R.node('p',`${t('organizer')}: ${event.owner_name}`),R.node('p',`${t('places')}: ${event.spots_left} / ${event.capacity-1}`));
    if(event.private_location)panel.append(R.node('h2',t('address')),R.node('p',event.private_location,'radar-gathering-description'));
    const actions=R.node('div',null,'radar-actions');panel.append(actions);
    actions.append(button(t('refresh'),load));
    actions.append(button(t('share'),async()=>{try{await navigator.clipboard.writeText(location.href);note(t('shared'));}catch{note(location.href);}},'','paperPlane','purple'));
    const open=event.status==='published'&&Date.parse(event.starts_at)>Date.now();
    if(!open)panel.append(R.node('p',t('closed')));
    else if(!authenticated)panel.append(R.node('p',t('login')));
    else if(!event.is_owner){
      if(['pending','approved'].includes(event.my_status)){
        panel.append(R.node('p',t(event.my_status)));
        actions.append(button(t('leave'),()=>mutate(`/${id}/leave`,{}),'','minus','red'));
      }else if(event.my_status==='rejected')panel.append(R.node('p',t('rejected')));
      else if(event.spots_left>0){panel.append(R.node('p',t('joinInfo')));actions.append(button(t('join'),()=>mutate(`/${id}/join`,{}),'','users','purple'));}
      else panel.append(R.node('p',t('full')));
    }
    if(event.can_manage){
      panel.append(R.node('h2',t('requests')));
      if(!event.requests.length)panel.append(R.node('p',t('empty')));
      for(const r of event.requests){
        const row=R.node('article',null,'radar-card');row.append(R.node('strong',r.name),R.node('p',t(r.status==='approved'?'confirmed':'waiting')));
        if(open){const controls=R.node('div',null,'radar-actions');
          if(r.status==='pending')controls.append(button(t('approve'),()=>mutate(`/${id}/requests/${r.user_id}`,{decision:'approved'}),'','check','green'));
          controls.append(button(t(r.status==='approved'?'remove':'reject'),()=>mutate(`/${id}/requests/${r.user_id}`,{decision:'rejected'}),'','minus','red'));row.append(controls);}
        panel.append(row);
      }
    }
    if(event.can_delete||event.can_manage){
      if(event.status==='published')panel.append(button(R.t('deleteEvent'),async()=>{
        if(busy||!confirm(t('removeConfirm')))return;busy=true;
        try{await UyDosh.communityEvent(`/${id}/withdraw`,{method:'POST',body:{expected_revision:event.revision}});event=null;$('radar-list').replaceChildren();note(t('saved'));}
        catch{note(t('error'));}finally{busy=false;}
      },'radar-delete-event','trash','red'));
    }
    $('radar-list').replaceChildren(panel);
  }
  async function load(){
    note(R.t('loading'));$('radar-retry').hidden=true;
    try{
      if(create){form();note('');return;}
      if(!/^[1-9]\d*$/.test(id||''))throw {status:404};
      event=await (authenticated?UyDosh.communityEvent('/'+id):UyDosh.communityEventPublic(id));render();note('');
    }catch(e){note(e.status===404?R.t('missing'):t('error'));$('radar-retry').hidden=e.status===404;}
  }
  $('radar-retry').addEventListener('click',load);
  (async()=>{UyDosh.initTelegramMiniApp?.();try{authenticated=!!await UyDosh.ensureTelegramMiniAppSession?.();}catch{}await load();})();
})();
